// src/infrastructure/services/MailgunAnalyticsService.ts
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import { PrismaClient } from '@prisma/client';
import { EmailEventRepository } from '../repositories/EmailEventRepository';
import { SuppressionListService } from './SuppressionListService';

const prisma = new PrismaClient();

export interface AnalyticsOverview {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  deliveryRate: number;
}

export interface CampaignAnalyticsSummary {
  campaignId: string;
  campaignName: string;
  subject: string;
  sentAt: Date | null;
  analytics: AnalyticsOverview | null;
}

export interface ClientAnalyticsSummary {
  clientId: string;
  clientName: string;
  totalCampaigns: number;
  activeCampaigns: number;
  analytics: AnalyticsOverview;
  suppressionCounts: {
    bounces: number;
    unsubscribes: number;
    complaints: number;
  };
  recentEvents: Array<{
    eventType: string;
    contactEmail: string;
    timestamp: Date;
    campaignName?: string;
  }>;
}

export class MailgunAnalyticsService {
  private mg: ReturnType<Mailgun['client']>;
  private domain: string;
  private emailEventRepository: EmailEventRepository;
  private suppressionListService: SuppressionListService;

  constructor() {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;

    if (!apiKey || !domain) {
      throw new Error('Missing MAILGUN_API_KEY or MAILGUN_DOMAIN environment variables');
    }

    this.domain = domain;
    this.emailEventRepository = new EmailEventRepository();
    this.suppressionListService = new SuppressionListService();

    const mailgun = new Mailgun(FormData);
    this.mg = mailgun.client({
      username: 'api',
      key: apiKey,
      url: process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net',
    });
  }

  /**
   * Get analytics overview for a client (from database)
   */
  async getClientAnalyticsOverview(
    clientId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AnalyticsOverview> {
    const eventCounts = await this.emailEventRepository.countByClient(clientId, startDate, endDate);

    let totalSent = 0;
    let totalDelivered = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalBounced = 0;
    let totalComplaints = 0;

    for (const item of eventCounts) {
      switch (item.eventType) {
        case 'SENT':
          totalSent = item.count;
          break;
        case 'DELIVERED':
          totalDelivered = item.count;
          break;
        case 'OPENED':
          totalOpened = item.count;
          break;
        case 'CLICKED':
          totalClicked = item.count;
          break;
        case 'BOUNCED':
        case 'FAILED':
          totalBounced += item.count;
          break;
        case 'COMPLAINED':
          totalComplaints = item.count;
          break;
      }
    }

    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const clickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalComplaints,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
    };
  }

  /**
   * Get full client analytics summary (for admin dashboard)
   */
  async getClientAnalyticsSummary(clientId: string): Promise<ClientAnalyticsSummary> {
    // Get client info
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true },
    });

    if (!client) {
      throw new Error('Client not found');
    }

    // Get campaign counts
    const campaignStats = await prisma.campaign.groupBy({
      by: ['status'],
      where: { clientId },
      _count: { status: true },
    });

    const totalCampaigns = campaignStats.reduce((sum, s) => sum + s._count.status, 0);
    const activeCampaigns = campaignStats.find((s) => s.status === 'SENT')?._count.status || 0;

    // Get analytics overview
    const analytics = await this.getClientAnalyticsOverview(clientId);

    // Get suppression counts
    const suppressionCounts = await this.suppressionListService.getSuppressionCounts(clientId);

    // Get recent events
    const recentEventsRaw = await this.emailEventRepository.getRecentEvents(clientId, 10);
    const recentEvents = recentEventsRaw.map((e) => ({
      eventType: e.eventType,
      contactEmail: e.contactEmail,
      timestamp: e.timestamp,
      campaignName: e.campaign?.name,
    }));

    return {
      clientId: client.id,
      clientName: client.name,
      totalCampaigns,
      activeCampaigns,
      analytics,
      suppressionCounts,
      recentEvents,
    };
  }

  /**
   * Get all campaigns analytics for a client
   */
  async getAllCampaignsAnalytics(clientId: string): Promise<CampaignAnalyticsSummary[]> {
    const campaigns = await prisma.campaign.findMany({
      where: { clientId },
      include: { analytics: true },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      subject: c.subject,
      sentAt: c.sentAt,
      analytics: c.analytics
        ? {
            totalSent: c.analytics.totalSent,
            totalDelivered: c.analytics.totalDelivered,
            totalOpened: c.analytics.totalOpened,
            totalClicked: c.analytics.totalClicked,
            totalBounced: c.analytics.totalBounced,
            totalComplaints: c.analytics.totalComplaints,
            openRate: c.analytics.openRate,
            clickRate: c.analytics.clickRate,
            bounceRate: c.analytics.bounceRate,
            deliveryRate:
              c.analytics.totalSent > 0
                ? Math.round((c.analytics.totalDelivered / c.analytics.totalSent) * 10000) / 100
                : 0,
          }
        : null,
    }));
  }

  /**
   * Get global analytics for admin (across all clients)
   */
  async getGlobalAnalytics(startDate?: Date, endDate?: Date): Promise<AnalyticsOverview> {
    // Aggregate from all campaigns
    const aggregates = await prisma.campaignAnalytics.aggregate({
      _sum: {
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplaints: true,
      },
    });

    const totalSent = aggregates._sum.totalSent || 0;
    const totalDelivered = aggregates._sum.totalDelivered || 0;
    const totalOpened = aggregates._sum.totalOpened || 0;
    const totalClicked = aggregates._sum.totalClicked || 0;
    const totalBounced = aggregates._sum.totalBounced || 0;
    const totalComplaints = aggregates._sum.totalComplaints || 0;

    const openRate = totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0;
    const clickRate = totalDelivered > 0 ? (totalClicked / totalDelivered) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const deliveryRate = totalSent > 0 ? (totalDelivered / totalSent) * 100 : 0;

    return {
      totalSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalComplaints,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
    };
  }

  /**
   * Fetch events directly from Mailgun API (for verification/debugging)
   */
  async fetchMailgunEvents(
    options: {
      begin?: Date;
      end?: Date;
      eventTypes?: string[];
      limit?: number;
    } = {}
  ) {
    try {
      const queryParams: Record<string, any> = {
        limit: options.limit || 100,
      };

      if (options.begin) {
        queryParams.begin = Math.floor(options.begin.getTime() / 1000);
      }
      if (options.end) {
        queryParams.end = Math.floor(options.end.getTime() / 1000);
      }
      if (options.eventTypes && options.eventTypes.length > 0) {
        queryParams.event = options.eventTypes.join(' OR ');
      }

      const result = await this.mg.events.get(this.domain, queryParams);
      return result;
    } catch (error) {
      console.error('Error fetching Mailgun events:', error);
      throw error;
    }
  }

  /**
   * Fetch stats from Mailgun Stats API
   */
  async fetchMailgunStats(
    startDate: Date,
    endDate: Date,
    resolution: 'day' | 'hour' | 'month' = 'day'
  ) {
    try {
      // Note: The Mailgun SDK stats endpoint may vary
      // Using 'any' for event types to avoid SDK type mismatch
      const stats = await this.mg.stats.getDomain(this.domain, {
        event: ['delivered', 'opened', 'clicked', 'failed', 'complained'] as any,
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        resolution,
      });
      return stats;
    } catch (error) {
      console.error('Error fetching Mailgun stats:', error);
      throw error;
    }
  }
}
