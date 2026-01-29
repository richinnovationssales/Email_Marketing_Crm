// src/presentation/controllers/admin/AdminDomainController.ts
import { Response } from 'express';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { ClientRepository } from '../../../infrastructure/repositories/ClientRepository';
import { ActivityLogRepository } from '../../../infrastructure/repositories/ActivityLogRepository';

export class AdminDomainController {
  private clientRepository: ClientRepository;
  private activityLogRepository: ActivityLogRepository;

  constructor() {
    this.clientRepository = new ClientRepository();
    this.activityLogRepository = new ActivityLogRepository();
  }

  getDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;

      if (!clientId) {
        res.status(400).json({ error: 'Client ID is required' });
        return;
      }

      const client = await this.clientRepository.findById(clientId);

      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      res.json({
        clientId: client.id,
        clientName: client.name,
        registrationEmail: client.registrationEmail,
        mailgunDomain: client.mailgunDomain,
        mailgunFromEmail: client.mailgunFromEmail,
        mailgunFromName: client.mailgunFromName,
        mailgunVerified: client.mailgunVerified,
        mailgunVerifiedAt: client.mailgunVerifiedAt,
      });
    } catch (error) {
      console.error('Error fetching domain config:', error);
      res.status(500).json({ error: 'Failed to fetch domain configuration' });
    }
  };

  /**
   * PUT /admin/clients/:clientId/domain - Configure or update domain for a specific client (SUPER_ADMIN only)
   */
  updateDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;
      const adminId = req.user?.id;
      const adminRole = req.user?.role;

      if (!clientId) {
        res.status(400).json({ error: 'Client ID is required' });
        return;
      }

      if (!adminId) {
        res.status(400).json({ error: 'Admin ID not found in user context' });
        return;
      }

      const { mailgunDomain, mailgunFromEmail, mailgunFromName } = req.body;

      // Fetch current config for activity logging
      const currentClient = await this.clientRepository.findById(clientId);

      if (!currentClient) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      // Determine activity type
      const isNewConfig = !currentClient.mailgunDomain && mailgunDomain;
      const activityType = isNewConfig ? 'MAILGUN_DOMAIN_CONFIGURED' : 'MAILGUN_DOMAIN_UPDATED';

      // Update domain configuration
      const updatedClient = await this.clientRepository.update(clientId, {
        mailgunDomain: mailgunDomain || null,
        mailgunFromEmail: mailgunFromEmail || null,
        mailgunFromName: mailgunFromName || null,
        mailgunVerified: false, // Reset verification status on change
        mailgunVerifiedAt: null,
      });

      // Log the domain change (performed by admin)
      await this.activityLogRepository.logDomainChange(
        clientId,
        activityType,
        adminId,
        adminRole || 'SUPER_ADMIN',
        {
          previousDomain: currentClient.mailgunDomain,
          newDomain: mailgunDomain,
          previousFromEmail: currentClient.mailgunFromEmail,
          newFromEmail: mailgunFromEmail,
          previousFromName: currentClient.mailgunFromName,
          newFromName: mailgunFromName,
        },
        req.ip || undefined
      );

      res.json({
        message: 'Domain configuration updated successfully',
        config: {
          clientId: updatedClient?.id,
          mailgunDomain: updatedClient?.mailgunDomain,
          mailgunFromEmail: updatedClient?.mailgunFromEmail,
          mailgunFromName: updatedClient?.mailgunFromName,
          mailgunVerified: updatedClient?.mailgunVerified,
        },
      });
    } catch (error) {
      console.error('Error updating domain config:', error);
      res.status(500).json({ error: 'Failed to update domain configuration' });
    }
  };


  removeDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;
      const adminId = req.user?.id;
      const adminRole = req.user?.role;

      if (!clientId) {
        res.status(400).json({ error: 'Client ID is required' });
        return;
      }

      if (!adminId) {
        res.status(400).json({ error: 'Admin ID not found in user context' });
        return;
      }

      // Fetch current config for activity logging
      const currentClient = await this.clientRepository.findById(clientId);

      if (!currentClient) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      if (!currentClient.mailgunDomain) {
        res.status(400).json({ error: 'No domain configuration to remove' });
        return;
      }

      // Remove domain configuration
      await this.clientRepository.update(clientId, {
        mailgunDomain: null,
        mailgunFromEmail: null,
        mailgunFromName: null,
        mailgunVerified: false,
        mailgunVerifiedAt: null,
      });

      // Log the domain removal (performed by admin)
      await this.activityLogRepository.logDomainChange(
        clientId,
        'MAILGUN_DOMAIN_REMOVED',
        adminId,
        adminRole || 'SUPER_ADMIN',
        {
          previousDomain: currentClient.mailgunDomain,
          newDomain: null,
          previousFromEmail: currentClient.mailgunFromEmail,
          newFromEmail: null,
        },
        req.ip || undefined
      );

      res.json({ message: 'Domain configuration removed successfully' });
    } catch (error) {
      console.error('Error removing domain config:', error);
      res.status(500).json({ error: 'Failed to remove domain configuration' });
    }
  };

  getDomainHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { clientId } = req.params;

      if (!clientId) {
        res.status(400).json({ error: 'Client ID is required' });
        return;
      }

      // Verify client exists
      const client = await this.clientRepository.findById(clientId);

      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const history = await this.activityLogRepository.getDomainChangeHistory(clientId);

      res.json({
        clientId: client.id,
        clientName: client.name,
        history: history.map((log) => ({
          id: log.id,
          activityType: log.activityType,
          description: log.description,
          performedBy: log.performedBy,
          performedByRole: log.performedByRole,
          metadata: log.metadata ? JSON.parse(log.metadata) : null,
          createdAt: log.createdAt,
        })),
      });
    } catch (error) {
      console.error('Error fetching domain history:', error);
      res.status(500).json({ error: 'Failed to fetch domain change history' });
    }
  };
}
