// src/presentation/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { MailgunAnalyticsService } from '../../infrastructure/services/MailgunAnalyticsService';
import { CampaignAnalyticsService } from '../../infrastructure/services/CampaignAnalyticsService';
import { EmailEventRepository } from '../../infrastructure/repositories/EmailEventRepository';
import prisma from '../../infrastructure/database/prisma';

const analyticsService = new MailgunAnalyticsService();
const campaignAnalyticsService = new CampaignAnalyticsService();
const emailEventRepository = new EmailEventRepository();

/** True when the campaign exists and belongs to the given client. */
async function campaignBelongsToClient(campaignId: string, clientId: string): Promise<boolean> {
  if (typeof campaignId !== 'string' || !campaignId) return false;
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, clientId },
    select: { id: true },
  });
  return campaign !== null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a date-range boundary from the query string.
 *
 * - Full timestamps (e.g. "2026-09-20T20:00:00.000Z", sent by the frontend for
 *   the viewer's local midnight) are used as-is.
 * - Date-only values ("2026-09-21") are read as UTC midnight. For the end
 *   boundary the whole day is included, so it becomes the next UTC midnight.
 *
 * The returned end is always exclusive. Returns null for an invalid value.
 */
function parseRangeBoundary(raw: unknown, kind: 'start' | 'end'): Date | undefined | null {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw !== 'string') return null;

  const value = raw.trim();
  const date = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value);
  if (isNaN(date.getTime())) return null;

  if (kind === 'end' && DATE_ONLY.test(value)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

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

      // Parse optional date filters: [startDate, endDate) on send time
      const startDate = parseRangeBoundary(req.query.startDate, 'start');
      const endDate = parseRangeBoundary(req.query.endDate, 'end');

      if (startDate === null || endDate === null) {
        return res.status(400).json({ error: 'Invalid startDate or endDate' });
      }
      if (startDate && endDate && startDate >= endDate) {
        return res.status(400).json({ error: 'startDate must be before endDate' });
      }

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

      // Tenant isolation: only the owning client may read (and recompute) it.
      // 404 rather than 403 so other tenants' campaign ids are not confirmed.
      if (!(await campaignBelongsToClient(id, clientId))) {
        return res.status(404).json({ error: 'Campaign not found' });
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
   * Recalculate analytics for a single campaign from raw email events.
   * Scoped to the authenticated client — verifies campaign ownership.
   * POST /analytics/campaigns/:id/recalculate
   */
  async recalculateCampaignAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const clientId = (req as any).user?.clientId;

      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      // Verify the campaign belongs to this client
      const campaign = await prisma.campaign.findFirst({
        where: { id, clientId },
        select: { id: true, name: true },
      });

      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found for this client' });
      }

      // Snapshot current values before recalculation
      const before = await prisma.campaignAnalytics.findUnique({
        where: { campaignId: id },
      });

      const after = await campaignAnalyticsService.updateAnalyticsFromEvents(id);

      return res.status(200).json({
        success: true,
        data: {
          campaignId: id,
          campaignName: campaign.name,
          before: before ? {
            totalSent: before.totalSent,
            totalDelivered: before.totalDelivered,
            totalOpened: before.totalOpened,
            totalClicked: before.totalClicked,
            totalBounced: before.totalBounced,
            totalUnsubscribed: before.totalUnsubscribed,
            totalComplaints: before.totalComplaints,
            uniqueOpens: before.uniqueOpens,
            uniqueClicks: before.uniqueClicks,
            openRate: before.openRate,
            clickRate: before.clickRate,
            bounceRate: before.bounceRate,
          } : null,
          after,
        },
      });
    } catch (error) {
      console.error('Error recalculating campaign analytics:', error);
      return res.status(500).json({ error: 'Failed to recalculate analytics' });
    }
  }

  /**
   * Recalculate analytics for ALL campaigns of the current client from raw email events.
   * Recomputes every metric from the EmailEvent table — the source of truth from webhooks.
   * Net bounces: contacts that bounced but were never delivered are counted; retried+delivered are not.
   * POST /analytics/recalculate-all
   */
  async recalculateAllAnalytics(req: Request, res: Response) {
    try {
      const clientId = (req as any).user?.clientId;
      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      // Fetch campaign IDs + current analytics snapshot for before/after comparison
      const campaigns = await prisma.campaign.findMany({
        where: { clientId },
        select: { id: true, name: true, analytics: true },
        orderBy: { createdAt: 'asc' },
      });

      const CONCURRENCY = 5;
      const results: {
        campaignId: string;
        name: string;
        status: string;
        before: { totalBounced: number; bounceRate: number; totalDelivered: number } | null;
        after: { totalBounced: number; bounceRate: number; totalDelivered: number } | null;
        error?: string;
      }[] = [];

      for (let i = 0; i < campaigns.length; i += CONCURRENCY) {
        const batch = campaigns.slice(i, i + CONCURRENCY);

        const batchResults = await Promise.allSettled(
          batch.map(async (c) => {
            const before = c.analytics;
            const after = await campaignAnalyticsService.updateAnalyticsFromEvents(c.id);
            return {
              campaignId: c.id,
              name: c.name,
              status: 'updated' as const,
              before: before ? {
                totalBounced: before.totalBounced,
                bounceRate: before.bounceRate,
                totalDelivered: before.totalDelivered,
              } : null,
              after: {
                totalBounced: after.totalBounced,
                bounceRate: after.bounceRate,
                totalDelivered: after.totalDelivered,
              },
            };
          })
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
              before: null,
              after: null,
              error: r.reason instanceof Error ? r.reason.message : 'Unknown error',
            });
          }
        }
      }

      const updated = results.filter((r) => r.status === 'updated').length;
      const failed  = results.filter((r) => r.status === 'error').length;
      const corrected = results.filter((r) =>
        r.before && r.after && r.before.totalBounced !== r.after.totalBounced
      ).length;

      return res.status(200).json({
        success: true,
        total: campaigns.length,
        updated,
        failed,
        corrected,
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
      const clientId = (req as any).user?.clientId;

      if (!clientId) {
        return res.status(401).json({ error: 'Client ID not found in token' });
      }

      // Tenant isolation: the timeline lists recipient emails.
      if (!(await campaignBelongsToClient(id, clientId))) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const timeline = await emailEventRepository.getCampaignTimeline(id, clientId);

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
