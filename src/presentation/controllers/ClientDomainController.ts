import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository';
import { ActivityLogRepository } from '../../infrastructure/repositories/ActivityLogRepository';

export class ClientDomainController {
  private clientRepository: ClientRepository;
  private activityLogRepository: ActivityLogRepository;

  constructor() {
    this.clientRepository = new ClientRepository();
    this.activityLogRepository = new ActivityLogRepository();
  }

  /**
   * GET /client/domain - Get current domain configuration
   */
  getDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const clientId = req.user?.clientId;

      if (!clientId) {
        res.status(400).json({ error: 'Client ID not found in user context' });
        return;
      }

      const client = await this.clientRepository.findById(clientId);

      if (!client) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      res.json({
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
   * PUT /client/domain - Configure or update domain (CLIENT_SUPER_ADMIN only)
   */
  //this is the function to update domain config
  updateDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const clientId = req.user?.clientId;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!clientId || !userId) {
        res.status(400).json({ error: 'Client ID or User ID not found in user context' });
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

      // Build update payload — only include fields that were explicitly provided
      const updateData: Record<string, any> = {};
      if (mailgunDomain !== undefined) updateData.mailgunDomain = mailgunDomain;
      if (mailgunFromEmail !== undefined) updateData.mailgunFromEmail = mailgunFromEmail;
      if (mailgunFromName !== undefined) updateData.mailgunFromName = mailgunFromName;

      // Reset verification only if the domain itself changed
      if (mailgunDomain !== undefined && mailgunDomain !== currentClient.mailgunDomain) {
        updateData.mailgunVerified = false;
        updateData.mailgunVerifiedAt = null;
      }

      // Update domain configuration
      const updatedClient = await this.clientRepository.update(clientId, updateData);

      // Log the domain change
      await this.activityLogRepository.logDomainChange(
        clientId,
        activityType,
        userId,
        userRole || 'CLIENT_SUPER_ADMIN',
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

  /**
   * DELETE /client/domain - Remove custom domain configuration
   */
  removeDomainConfig = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const clientId = req.user?.clientId;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!clientId || !userId) {
        res.status(400).json({ error: 'Client ID or User ID not found in user context' });
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

      // Log the domain removal
      await this.activityLogRepository.logDomainChange(
        clientId,
        'MAILGUN_DOMAIN_REMOVED',
        userId,
        userRole || 'CLIENT_SUPER_ADMIN',
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

  /**
   * GET /client/domain/history - Get domain change history
   */
  getDomainHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const clientId = req.user?.clientId;

      if (!clientId) {
        res.status(400).json({ error: 'Client ID not found in user context' });
        return;
      }

      const history = await this.activityLogRepository.getDomainChangeHistory(clientId);

      res.json({
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
