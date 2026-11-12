// src/presentation/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { MailgunAnalyticsService } from '../../infrastructure/services/MailgunAnalyticsService';
import { CampaignAnalyticsService } from '../../infrastructure/services/CampaignAnalyticsService';
import prisma from '../../infrastructure/database/prisma';
import { EmailEventRepository } from '../../infrastructure/repositories/EmailEventRepository';



const analyticsService = new MailgunAnalyticsService();
const campaignAnalyticsService = new CampaignAnalyticsService();
const emailEventRepository = new EmailEventRepository();

export class AnalyticsController {
  /**
   * Get analytics overview for current client
   * GET /analytics/overview
   */
  async getOverview(req: Request, res: Response) {
    try {
      const clientId = (req as any).user?.clientId;

      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      // Parse optional date filters
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : undefined;
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : undefined;

      const overview = await analyticsService.getClientAnalyticsOverview(
        clientId,
        startDate,
        endDate
      );

      return res.status(200).json({
        success: true,
        data: overview,
      });
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      return res.status(500).json({
        error: 'Failed to fetch analytics overview',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get all campaigns analytics for current client
   * GET /analytics/campaigns
   */
  async getAllCampaignsAnalytics(req: Request, res: Response) {
    try {
      const clientId = (req as any).user?.clientId;

      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      const campaigns = await analyticsService.getAllCampaignsAnalytics(clientId);

      return res.status(200).json({
        success: true,
        data: campaigns,
      });
    } catch (error) {
      console.error('Error fetching campaigns analytics:', error);
      return res.status(500).json({
        error: 'Failed to fetch campaigns analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get analytics for a specific campaign
   * GET /analytics/campaigns/:id
   */
  async getCampaignAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const clientId = (req as any).user?.clientId;

      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      const analytics = await campaignAnalyticsService.getCampaignAnalytics(id, clientId);

      return res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
      
      if (error instanceof Error && error.message === 'Campaign not found') {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      return res.status(500).json({
        error: 'Failed to fetch campaign analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get recent email events for current client
   * GET /analytics/events
   */
  async getRecentEvents(req: Request, res: Response) {
    try {
      const clientId = (req as any).user?.clientId;

      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      const limit = parseInt(req.query.limit as string) || 50;

      const events = await emailEventRepository.getRecentEvents(clientId, limit);

      return res.status(200).json({
        success: true,
        data: events,
      });
    } catch (error) {
      console.error('Error fetching recent events:', error);
      return res.status(500).json({
        error: 'Failed to fetch recent events',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get campaign event timeline
   * GET /analytics/campaigns/:id/timeline
   */
  async getCampaignTimeline(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const clientId = (req as any).user?.clientId;

      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      const campaign = await prisma.campaign.findFirst({ where: { id, clientId }, select: { id: true } });
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const timeline = await emailEventRepository.getCampaignTimeline(id);

      return res.status(200).json({
        success: true,
        data: timeline,
      });
    } catch (error) {
      console.error('Error fetching campaign timeline:', error);
      return res.status(500).json({
        error: 'Failed to fetch campaign timeline',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Rebuild analytics for all sent campaigns of current client
   * POST /analytics/recalculate-all
   */
  async recalculateAll(req: Request, res: Response) {
    try {
      const clientId = (req as any).user?.clientId;
      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      const count = await campaignAnalyticsService.recalculateAllForClient(clientId);
      return res.status(200).json({ success: true, data: { campaignsRecalculated: count } });
    } catch (error) {
      console.error('Error recalculating analytics:', error);
      return res.status(500).json({
        error: 'Failed to recalculate analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Rebuild analytics for one campaign
   * POST /analytics/campaigns/:id/recalculate
   */
  async recalculateCampaign(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const clientId = (req as any).user?.clientId;
      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      const result = await campaignAnalyticsService.getCampaignAnalytics(id, clientId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error && error.message === 'Campaign not found') {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      console.error('Error recalculating campaign analytics:', error);
      return res.status(500).json({
        error: 'Failed to recalculate campaign analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
