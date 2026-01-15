// src/presentation/controllers/CampaignController.ts
import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';
import { CampaignManagement } from '../../core/use-cases/client/CampaignManagement';
import { CampaignRepository } from '../../infrastructure/repositories/CampaignRepository';
import { AuthRequest } from '../middlewares/authMiddleware';
import { CampaignApproval } from '../../core/use-cases/client/CampaignApproval';
import { SendCampaign } from '../../core/use-cases/client/SendCampaign';
import { ContactGroupRepository } from '../../infrastructure/repositories/ContactGroupRepository';
import { EmailService } from '../../infrastructure/services/EmailService';
import { MailgunService } from '../../infrastructure/services/MailgunService';

const campaignRepository = new CampaignRepository();
const contactGroupRepository = new ContactGroupRepository();
const emailService = new EmailService();

// Initialize MailgunService only if USE_MAILGUN is enabled
let mailgunService: MailgunService | undefined;
try {
  if (process.env.USE_MAILGUN === 'true') {
    mailgunService = new MailgunService();
    console.log('MailgunService initialized for campaigns');
  }
} catch (error) {
  console.warn('Failed to initialize MailgunService, falling back to EmailService:', error);
}

const campaignManagementUseCase = new CampaignManagement(campaignRepository);
const campaignApprovalUseCase = new CampaignApproval(campaignRepository);
const sendCampaignUseCase = new SendCampaign(
  campaignRepository, 
  contactGroupRepository, 
  emailService,
  mailgunService
);

export class CampaignController {
  async createCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      if (!req.user?.id) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'User ID is missing' });
        return;
      }
      const campaign = await campaignManagementUseCase.create(req.body, req.user.clientId, req.user.id);
      console.log('Campaign created', campaign.id);
      // Handle Send Immediately
      if ( !campaign.isRecurring) {
        try {
          // Auto-approve first

          console.log('Auto-approving campaign', campaign.id);
          await campaignApprovalUseCase.approve(campaign.id, req.user.clientId);
          
          // Then send
          console.log('Sending campaign', campaign.id);
          await sendCampaignUseCase.execute(campaign.id, req.user.clientId);
          console.log('Campaign sent', campaign.id);
          // Re-fetch campaign to get updated status
          const updatedCampaign = await campaignManagementUseCase.findById(campaign.id, req.user.clientId);
          res.status(StatusCodes.CREATED).json(updatedCampaign);
          return;
        } catch (error) {
          console.error('Error in immediate send:', error);
          // If sending fails, we still return the created campaign but with a warning or error log
          // The campaign will be in APPROVED or DRAFT state depending on where it failed
           res.status(StatusCodes.CREATED).json({
            ...campaign,
            warning: 'Campaign created but failed to send immediately. Please check logs.'
           });
           return;
        }
      }
      console.log('Campaign created and returing outside', campaign.id);
      res.status(StatusCodes.CREATED).json(campaign);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(StatusCodes.BAD_REQUEST).json({ 
          message: 'Validation error', 
          errors: error.issues 
        });
        return;
      }
      console.error('Error creating campaign:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const campaigns = await campaignManagementUseCase.findAll(req.user.clientId);
      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getCampaignById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const campaign = await campaignManagementUseCase.findById(req.params.id, req.user.clientId);
      if (!campaign) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Campaign not found' });
        return;
      }
      res.json(campaign);
    } catch (error) {
      console.error('Error fetching campaign:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updateCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const campaign = await campaignManagementUseCase.update(req.params.id, req.body, req.user.clientId);
      if (!campaign) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Campaign not found' });
        return;
      }
      res.json(campaign);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(StatusCodes.BAD_REQUEST).json({ 
          message: 'Validation error', 
          errors: error.issues 
        });
        return;
      }
      console.error('Error updating campaign:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deleteCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const campaign = await campaignManagementUseCase.delete(req.params.id, req.user.clientId);
      if (!campaign) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Campaign not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async submitCampaignForApproval(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { campaignId } = req.params;
      const campaign = await campaignApprovalUseCase.submitForApproval(campaignId, req.user.clientId);
      res.json(campaign);
    } catch (error) {
      console.error('Error submitting campaign for approval:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async approveCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { campaignId } = req.params;
      const campaign = await campaignApprovalUseCase.approve(campaignId, req.user.clientId);
      res.json(campaign);
    } catch (error) {
      console.error('Error approving campaign:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async rejectCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { campaignId } = req.params;
      const campaign = await campaignApprovalUseCase.reject(campaignId, req.user.clientId);
      res.json(campaign);
    } catch (error) {
      console.error('Error rejecting campaign:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getPendingCampaigns(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const campaigns = await campaignApprovalUseCase.getPendingCampaigns(req.user.clientId);
      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching pending campaigns:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async sendCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { campaignId } = req.params;
      await sendCampaignUseCase.execute(campaignId, req.user.clientId);
      res.status(StatusCodes.OK).json({ message: 'Campaign sent successfully' });
    } catch (error) {
      console.error('Error sending campaign:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  /**
   * Update recurring schedule for a campaign
   * Only allows updates for DRAFT or APPROVED campaigns
   */
  async updateRecurringSchedule(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { campaignId } = req.params;
      const campaign = await campaignManagementUseCase.updateRecurringSchedule(
        campaignId, 
        req.body, 
        req.user.clientId
      );
      if (!campaign) {
        res.status(StatusCodes.NOT_FOUND).json({ 
          message: 'Campaign not found or cannot be modified (must be in DRAFT or APPROVED status)' 
        });
        return;
      }
      res.json(campaign);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(StatusCodes.BAD_REQUEST).json({ 
          message: 'Validation error', 
          errors: error.issues 
        });
        return;
      }
      console.error('Error updating recurring schedule:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
