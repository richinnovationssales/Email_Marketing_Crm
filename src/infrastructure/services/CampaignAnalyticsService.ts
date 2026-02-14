// src/infrastructure/services/CampaignAnalyticsService.ts
import { PrismaClient, EmailEventType } from '@prisma/client';
import { EmailEventRepository, EventCountResult } from '../repositories/EmailEventRepository';

const prisma = new PrismaClient();

export interface CampaignAnalyticsData {
  campaignId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalUnsubscribed: number;
  totalComplaints: number;
  uniqueOpens: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export class CampaignAnalyticsService {
  private emailEventRepository: EmailEventRepository;

  constructor() {
    this.emailEventRepository = new EmailEventRepository();
  }

  /**
   * Get or create campaign analytics record
   */
  async getOrCreateAnalytics(campaignId: string) {
    let analytics = await prisma.campaignAnalytics.findUnique({
      where: { campaignId },
    });

    if (!analytics) {
      analytics = await prisma.campaignAnalytics.create({
        data: { campaignId },
      });
    }

    return analytics;
  }

  /**
   * Update campaign analytics from event counts
   */
  async updateAnalyticsFromEvents(campaignId: string): Promise<CampaignAnalyticsData> {
    const eventCounts = await this.emailEventRepository.countByCampaign(campaignId);
    const uniqueOpens = await this.emailEventRepository.getUniqueCounts(campaignId, 'OPENED');
    const uniqueClicks = await this.emailEventRepository.getUniqueCounts(campaignId, 'CLICKED');

    const counts = this.parseEventCounts(eventCounts);

    // Calculate rates
    const openRate = counts.totalDelivered > 0
      ? (uniqueOpens / counts.totalDelivered) * 100
      : 0;
    const clickRate = counts.totalDelivered > 0
      ? (uniqueClicks / counts.totalDelivered) * 100
      : 0;
    const bounceRate = counts.totalSent > 0
      ? (counts.totalBounced / counts.totalSent) * 100
      : 0;

    const analytics = await prisma.campaignAnalytics.upsert({
      where: { campaignId },
      update: {
        totalSent: counts.totalSent,
        totalDelivered: counts.totalDelivered,
        totalOpened: counts.totalOpened,
        totalClicked: counts.totalClicked,
        totalBounced: counts.totalBounced,
        totalUnsubscribed: counts.totalUnsubscribed,
        totalComplaints: counts.totalComplaints,
        uniqueOpens,
        uniqueClicks,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
      },
      create: {
        campaignId,
        totalSent: counts.totalSent,
        totalDelivered: counts.totalDelivered,
        totalOpened: counts.totalOpened,
        totalClicked: counts.totalClicked,
        totalBounced: counts.totalBounced,
        totalUnsubscribed: counts.totalUnsubscribed,
        totalComplaints: counts.totalComplaints,
        uniqueOpens,
        uniqueClicks,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        bounceRate: Math.round(bounceRate * 100) / 100,
      },
    });

    return {
      campaignId,
      totalSent: analytics.totalSent,
      totalDelivered: analytics.totalDelivered,
      totalOpened: analytics.totalOpened,
      totalClicked: analytics.totalClicked,
      totalBounced: analytics.totalBounced,
      totalUnsubscribed: analytics.totalUnsubscribed,
      totalComplaints: analytics.totalComplaints,
      uniqueOpens: analytics.uniqueOpens,
      uniqueClicks: analytics.uniqueClicks,
      openRate: analytics.openRate,
      clickRate: analytics.clickRate,
      bounceRate: analytics.bounceRate,
    };
  }

  /**
   * Increment a specific metric
   * @param originalMailgunEvent - the raw Mailgun event name, used to distinguish unsubscribes from complaints
   */
  async incrementMetric(campaignId: string, eventType: EmailEventType, originalMailgunEvent?: string) {
    const updateData: Record<string, { increment: number }> = {};
    const createData: Record<string, number> = {};

    switch (eventType) {
      case 'SENT':
        updateData.totalSent = { increment: 1 };
        createData.totalSent = 1;
        break;
      case 'DELIVERED':
        updateData.totalDelivered = { increment: 1 };
        createData.totalDelivered = 1;
        break;
      case 'OPENED':
        updateData.totalOpened = { increment: 1 };
        createData.totalOpened = 1;
        break;
      case 'CLICKED':
        updateData.totalClicked = { increment: 1 };
        createData.totalClicked = 1;
        break;
      case 'BOUNCED':
      case 'FAILED':
        updateData.totalBounced = { increment: 1 };
        createData.totalBounced = 1;
        break;
      case 'COMPLAINED':
        if (originalMailgunEvent === 'unsubscribed') {
          updateData.totalUnsubscribed = { increment: 1 };
          createData.totalUnsubscribed = 1;
        } else {
          updateData.totalComplaints = { increment: 1 };
          createData.totalComplaints = 1;
        }
        break;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.campaignAnalytics.upsert({
        where: { campaignId },
        update: updateData,
        create: {
          campaignId,
          ...createData,
        },
      });
    }
  }

  /**
   * Get campaign analytics with campaign details
   */
  async getCampaignAnalytics(campaignId: string) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        analytics: true,
        groups: {
          include: {
            contactGroups: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Recalculate analytics from events
    const freshAnalytics = await this.updateAnalyticsFromEvents(campaignId);

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        sentAt: campaign.sentAt,
      },
      analytics: freshAnalytics,
    };
  }

  /**
   * Get all campaigns analytics for a client
   */
  async getClientCampaignsAnalytics(clientId: string) {
    const campaigns = await prisma.campaign.findMany({
      where: {
        clientId,
        OR: [
          { status: 'SENT' },
          // Include recurring campaigns that have been sent at least once
          // (they stay in APPROVED status after each send)
          { isRecurring: true, sentAt: { not: null } },
        ],
      },
      include: { analytics: true },
      orderBy: { sentAt: 'desc' },
    });

    return campaigns.map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      subject: c.subject,
      sentAt: c.sentAt,
      analytics: c.analytics || {
        totalSent: 0,
        totalDelivered: 0,
        totalOpened: 0,
        totalClicked: 0,
        totalBounced: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
      },
    }));
  }

  /**
   * Parse event counts into structured data
   */
  private parseEventCounts(counts: EventCountResult[]) {
    const result = {
      totalSent: 0,
      totalDelivered: 0,
      totalOpened: 0,
      totalClicked: 0,
      totalBounced: 0,
      totalUnsubscribed: 0,
      totalComplaints: 0,
    };

    for (const item of counts) {
      switch (item.eventType) {
        case 'SENT':
          result.totalSent = item.count;
          break;
        case 'DELIVERED':
          result.totalDelivered = item.count;
          break;
        case 'OPENED':
          result.totalOpened = item.count;
          break;
        case 'CLICKED':
          result.totalClicked = item.count;
          break;
        case 'BOUNCED':
        case 'FAILED':
          result.totalBounced += item.count;
          break;
        case 'COMPLAINED':
          result.totalComplaints = item.count;
          break;
      }
    }

    return result;
  }
}
