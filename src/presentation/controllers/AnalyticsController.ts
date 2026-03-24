// src/presentation/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { MailgunAnalyticsService } from '../../infrastructure/services/MailgunAnalyticsService';
import { CampaignAnalyticsService } from '../../infrastructure/services/CampaignAnalyticsService';
import { EmailEventRepository } from '../../infrastructure/repositories/EmailEventRepository';
import prisma from '../../infrastructure/database/prisma';

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

      const analytics = await campaignAnalyticsService.getCampaignAnalytics(id);

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
   * Recalculate analytics for a single campaign from raw email events
   * POST /analytics/campaigns/:id/recalculate
   */
  async recalculateCampaignAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await campaignAnalyticsService.updateAnalyticsFromEvents(id);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      console.error('Error recalculating campaign analytics:', error);
      return res.status(500).json({ error: 'Failed to recalculate analytics' });
    }
  }

  /**
   * Recalculate analytics for ALL campaigns of the current client from raw email events.
   * Processes campaigns in parallel batches to avoid blocking on large event tables.
   * POST /analytics/recalculate-all
   */
  async recalculateAllAnalytics(req: Request, res: Response) {
    try {
      const clientId = (req as any).user?.clientId;
      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      // Fetch only campaign IDs — no need to load full records
      const campaigns = await prisma.campaign.findMany({
        where: { clientId },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });

      const CONCURRENCY = 5; // process 5 campaigns at a time
      const results: { campaignId: string; name: string; status: string; error?: string }[] = [];

      // Chunk campaigns into batches of CONCURRENCY
      for (let i = 0; i < campaigns.length; i += CONCURRENCY) {
        const batch = campaigns.slice(i, i + CONCURRENCY);

        const batchResults = await Promise.allSettled(
          batch.map((c) =>
            campaignAnalyticsService.updateAnalyticsFromEvents(c.id).then(() => ({
              campaignId: c.id,
              name: c.name,
              status: 'updated' as const,
            }))
          )
        );

        for (let j = 0; j < batchResults.length; j++) {
          const r = batchResults[j];
          if (r.status === 'fulfilled') {
            results.push(r.value);
          } else {
            results.push({
              campaignId: batch[j].id,
              name: batch[j].name,
              status: 'error',
              error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
            });
          }
        }
      }

      const updated = results.filter((r) => r.status === 'updated').length;
      const failed  = results.filter((r) => r.status === 'error').length;

      return res.status(200).json({
        success: true,
        total: campaigns.length,
        updated,
        failed,
        results,
      });
    } catch (error) {
      console.error('Error recalculating all analytics:', error);
      return res.status(500).json({ error: 'Failed to recalculate analytics' });
    }
  }

  /**
   * Get campaign event timeline
   * GET /analytics/campaigns/:id/timeline
   */
  async getCampaignTimeline(req: Request, res: Response) {
    try {
      const { id } = req.params;

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
}
