import prisma from '../../infrastructure/database/prisma';

export interface DateRangeFilter {
  rangeType: 'monthly' | 'yearly' | 'custom';
  startDate: Date;
  endDate: Date;
}

export interface ExportSummary {
  totalCampaigns: number;
  sentCampaigns: number;
  draftCampaigns: number;
  totalContacts: number;
  totalGroups: number;
  totalEmailsSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalUnsubscribed: number;
  totalComplaints: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface CampaignExportRow {
  campaignId: string;
  campaignName: string;
  subject: string;
  status: string;
  createdAt: string;
  sentAt: string | null;
  groupNames: string;
  recipientCount: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

export interface EmailEventExportRow {
  eventId: string;
  campaignName: string;
  contactEmail: string;
  eventType: string;
  timestamp: string;
  errorMessage: string | null;
}

export interface ContactExportRow {
  contactId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  groupNames: string;
  createdAt: string;
}

export interface GroupExportRow {
  groupId: string;
  groupName: string;
  contactCount: number;
  campaignCount: number;
  createdAt: string;
}

export class ClientAnalyticsExportRepository {
  async getClientInfo(clientId: string) {
    return prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        remainingMessages: true,
        plan: { select: { name: true } },
      },
    });
  }

  async getSummary(clientId: string, filter: DateRangeFilter): Promise<ExportSummary> {
    const { startDate, endDate } = filter;

    // Campaign counts
    const campaignStats = await prisma.campaign.groupBy({
      by: ['status'],
      where: {
        clientId,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { status: true },
    });

    const totalCampaigns = campaignStats.reduce((sum, s) => sum + s._count.status, 0);
    const sentCampaigns = campaignStats.find((s) => s.status === 'SENT')?._count.status || 0;
    const draftCampaigns = campaignStats.find((s) => s.status === 'DRAFT')?._count.status || 0;

    // Contacts and groups
    const totalContacts = await prisma.contact.count({
      where: { clientId, createdAt: { gte: startDate, lte: endDate } },
    });
    const totalGroups = await prisma.group.count({
      where: { clientId, createdAt: { gte: startDate, lte: endDate } },
    });

    // Email event aggregates
    const eventCounts = await prisma.emailEvent.groupBy({
      by: ['eventType'],
      where: {
        clientId,
        timestamp: { gte: startDate, lte: endDate },
      },
      _count: { eventType: true },
    });

    let totalEmailsSent = 0;
    let totalDelivered = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalBounced = 0;
    let totalComplaints = 0;

    for (const item of eventCounts) {
      switch (item.eventType) {
        case 'SENT':
          totalEmailsSent = item._count.eventType;
          break;
        case 'DELIVERED':
          totalDelivered = item._count.eventType;
          break;
        case 'OPENED':
          totalOpened = item._count.eventType;
          break;
        case 'CLICKED':
          totalClicked = item._count.eventType;
          break;
        case 'BOUNCED':
        case 'FAILED':
          totalBounced += item._count.eventType;
          break;
        case 'COMPLAINED':
          totalComplaints = item._count.eventType;
          break;
      }
    }

    // Suppression list for unsubscribes
    const totalUnsubscribed = await prisma.suppressionList.count({
      where: { clientId, type: 'UNSUBSCRIBE', createdAt: { gte: startDate, lte: endDate } },
    });

    // Calculate rates
    const deliveryRate = totalEmailsSent > 0 ? Math.round((totalDelivered / totalEmailsSent) * 10000) / 100 : 0;
    const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 10000) / 100 : 0;
    const clickRate = totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 10000) / 100 : 0;
    const bounceRate = totalEmailsSent > 0 ? Math.round((totalBounced / totalEmailsSent) * 10000) / 100 : 0;

    return {
      totalCampaigns,
      sentCampaigns,
      draftCampaigns,
      totalContacts,
      totalGroups,
      totalEmailsSent,
      totalDelivered,
      totalOpened,
      totalClicked,
      totalBounced,
      totalUnsubscribed,
      totalComplaints,
      deliveryRate,
      openRate,
      clickRate,
      bounceRate,
    };
  }

  async getCampaigns(clientId: string, filter: DateRangeFilter): Promise<CampaignExportRow[]> {
    const { startDate, endDate } = filter;

    const campaigns = await prisma.campaign.findMany({
      where: {
        clientId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        groups: { select: { name: true } },
        analytics: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((c) => {
      const analytics = c.analytics;
      const totalSent = analytics?.totalSent || 0;
      const totalDelivered = analytics?.totalDelivered || 0;
      const totalOpened = analytics?.totalOpened || 0;
      const totalClicked = analytics?.totalClicked || 0;
      const totalBounced = analytics?.totalBounced || 0;

      return {
        campaignId: c.id,
        campaignName: c.name,
        subject: c.subject,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
        sentAt: c.sentAt?.toISOString() || null,
        groupNames: c.groups.map((g) => g.name).join(', '),
        recipientCount: totalSent,
        totalSent,
        totalDelivered,
        totalOpened,
        totalClicked,
        totalBounced,
        openRate: totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 10000) / 100 : 0,
        clickRate: totalDelivered > 0 ? Math.round((totalClicked / totalDelivered) * 10000) / 100 : 0,
        bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 10000) / 100 : 0,
      };
    });
  }

  async getEmailEvents(
    clientId: string,
    filter: DateRangeFilter,
    limit: number = 1000
  ): Promise<EmailEventExportRow[]> {
    const { startDate, endDate } = filter;

    const events = await prisma.emailEvent.findMany({
      where: {
        clientId,
        timestamp: { gte: startDate, lte: endDate },
      },
      include: {
        campaign: { select: { name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      eventId: e.id,
      campaignName: e.campaign?.name || 'N/A',
      contactEmail: e.contactEmail,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      errorMessage: e.errorMessage,
    }));
  }

  async getContacts(clientId: string, filter: DateRangeFilter): Promise<ContactExportRow[]> {
    const { startDate, endDate } = filter;

    const contacts = await prisma.contact.findMany({
      where: {
        clientId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        contactGroups: {
          include: { group: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((c) => ({
      contactId: c.id,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      groupNames: c.contactGroups.map((cg) => cg.group.name).join(', '),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async getGroups(clientId: string, filter: DateRangeFilter): Promise<GroupExportRow[]> {
    const { startDate, endDate } = filter;

    const groups = await prisma.group.findMany({
      where: {
        clientId,
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        _count: {
          select: {
            contactGroups: true,
            campaigns: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return groups.map((g) => ({
      groupId: g.id,
      groupName: g.name,
      contactCount: g._count.contactGroups,
      campaignCount: g._count.campaigns,
      createdAt: g.createdAt.toISOString(),
    }));
  }
}
