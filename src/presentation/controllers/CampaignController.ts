import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { CampaignManagement } from '../../core/use-cases/client/CampaignManagement';
import { CampaignRepository } from '../../infrastructure/repositories/CampaignRepository';
import { AuthRequest } from '../middlewares/authMiddleware';
import { CampaignApproval } from '../../core/use-cases/client/CampaignApproval';
import { SendCampaign } from '../../core/use-cases/client/SendCampaign';
import { ContactGroupRepository } from '../../infrastructure/repositories/ContactGroupRepository';
import { EmailService } from '../../infrastructure/services/EmailService';

const campaignRepository = new CampaignRepository();
const contactGroupRepository = new ContactGroupRepository();
const emailService = new EmailService();
const campaignManagementUseCase = new CampaignManagement(campaignRepository);
const campaignApprovalUseCase = new CampaignApproval(campaignRepository);
const sendCampaignUseCase = new SendCampaign(campaignRepository, contactGroupRepository, emailService);

export class CampaignController {
  async createCampaign(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const campaign = await campaignManagementUseCase.create(req.body, req.user.clientId);
      res.status(StatusCodes.CREATED).json(campaign);
    } catch (error) {
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
}
