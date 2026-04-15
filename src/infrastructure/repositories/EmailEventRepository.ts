// src/infrastructure/repositories/EmailEventRepository.ts
import { PrismaClient, EmailEventType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateEmailEventData {
  clientId: string;
  campaignId?: string;
  contactEmail: string;
  eventType: EmailEventType;
  mailgunId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

export interface EmailEventFilters {
  clientId?: string;
  campaignId?: string;
  eventType?: EmailEventType;
  contactEmail?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface EventCountResult {
  eventType: EmailEventType;
  count: number;
}

export class EmailEventRepository {

  async create(data: CreateEmailEventData) {
    return prisma.emailEvent.create({
      data: {
        clientId: data.clientId,
        campaignId: data.campaignId,
        contactEmail: data.contactEmail,
        eventType: data.eventType,
        mailgunId: data.mailgunId,
        errorMessage: data.errorMessage,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        timestamp: data.timestamp || new Date(),
      },
    });
  }

  async createMany(dataArray: CreateEmailEventData[]) {
    if (dataArray.length === 0) return;
    const now = new Date();
    return prisma.emailEvent.createMany({
      data: dataArray.map(d => ({
        clientId: d.clientId,
        campaignId: d.campaignId,
        contactEmail: d.contactEmail,
        eventType: d.eventType,
        mailgunId: d.mailgunId,
        errorMessage: d.errorMessage,
        metadata: d.metadata ? JSON.stringify(d.metadata) : null,
        timestamp: d.timestamp || now,
      })),
    });
  }


  async findMany(filters: EmailEventFilters, limit = 100, offset = 0) {
    const where: Prisma.EmailEventWhereInput = {};

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.campaignId) where.campaignId = filters.campaignId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.contactEmail) where.contactEmail = filters.contactEmail;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return prisma.emailEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        campaign: {
          select: { id: true, name: true, subject: true },
        },
      },
    });
  }


  async countByCampaign(campaignId: string): Promise<EventCountResult[]> {
    const result = await prisma.emailEvent.groupBy({
      by: ['eventType'],
      where: { campaignId },
      _count: { eventType: true },
    });

    return result.map((r) => ({
      eventType: r.eventType,
      count: r._count.eventType,
    }));
  }

  async countByClient(clientId: string, startDate?: Date, endDate?: Date): Promise<EventCountResult[]> {
    const where: Prisma.EmailEventWhereInput = { clientId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const result = await prisma.emailEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { eventType: true },
    });

    return result.map((r) => ({
      eventType: r.eventType,
      count: r._count.eventType,
    }));
  }

  /**
   * Get unique opens/clicks for a campaign (count distinct emails)
   */
  async getUniqueCounts(campaignId: string, eventType: EmailEventType): Promise<number> {
    const result = await prisma.emailEvent.findMany({
      where: { campaignId, eventType },
      select: { contactEmail: true },
      distinct: ['contactEmail'],
    });

    return result.length;
  }

  /**
   * Check if event already exists (for deduplication)
   */
  async exists(mailgunId: string, eventType: EmailEventType): Promise<boolean> {
    const count = await prisma.emailEvent.count({
      where: { mailgunId, eventType },
    });
    return count > 0;
  }

  /**
   * Get recent events for dashboard
   */
  async getRecentEvents(clientId: string, limit = 10) {
    return prisma.emailEvent.findMany({
      where: { clientId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Find emails that already have a SENT event for a campaign.
   * Used to prevent duplicate sends on retry after partial failure.
   *
   * @param sinceDate - Only consider SENT events after this date.
   *   For recurring campaigns, pass campaign.sentAt so that previous cycles
   *   are ignored and only the current (partial) cycle's sends are filtered.
   */
  async findSentRecipientsForCampaign(
    campaignId: string,
    clientId: string,
    sinceDate?: Date | null
  ): Promise<string[]> {
    const where: Prisma.EmailEventWhereInput = {
      campaignId,
      clientId,
      eventType: 'SENT',
    };

    if (sinceDate) {
      where.timestamp = { gt: sinceDate };
    }

    const events = await prisma.emailEvent.findMany({
      where,
      select: { contactEmail: true },
      distinct: ['contactEmail'],
    });
    return events.map(e => e.contactEmail);
  }

  /**
   * Get events for a campaign using cursor-based pagination (memory-safe for large datasets)
   */
  async findByCampaignBatched(
    campaignId: string,
    batchSize: number = 5000,
    callback: (events: { id: string; contactEmail: string; eventType: EmailEventType; timestamp: Date; errorMessage: string | null }[]) => Promise<void>
  ) {
    let cursor: string | undefined;
    while (true) {
      const events = await prisma.emailEvent.findMany({
        where: { campaignId },
        select: {
          id: true,
          contactEmail: true,
          eventType: true,
          timestamp: true,
          errorMessage: true,
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (events.length === 0) break;
      await callback(events);
      cursor = events[events.length - 1].id;
      if (events.length < batchSize) break;
    }
  }

  /**
   * Get all event counts + unique opens/clicks for a campaign in a single DB query.
   * Much more efficient than separate groupBy + distinct queries for large datasets.
   */
  async getAggregatedCounts(campaignId: string): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    totalComplaints: number;
    uniqueOpens: number;
    uniqueClicks: number;
  }> {
    type AggRow = {
      event_type: string;
      total: bigint;
      unique_contacts: bigint;
    };

    const rows = await prisma.$queryRaw<AggRow[]>`
      SELECT
        "eventType"          AS event_type,
        COUNT(*)             AS total,
        COUNT(DISTINCT "contactEmail") AS unique_contacts
      FROM "EmailEvent"
      WHERE "campaignId" = ${campaignId}
      GROUP BY "eventType"
    `;

    // Net bounces: count contacts that bounced/failed but were NEVER successfully delivered.
    // Mailgun retries soft bounces — if it eventually delivers, that contact is NOT a real bounce.
    type NetBounceRow = { net_bounces: bigint };
    const netBounceRows = await prisma.$queryRaw<NetBounceRow[]>`
      SELECT COUNT(*) AS net_bounces
      FROM (
        SELECT DISTINCT "contactEmail"
        FROM "EmailEvent"
        WHERE "campaignId" = ${campaignId}
          AND "eventType" IN ('BOUNCED', 'FAILED')
          AND "contactEmail" NOT IN (
            SELECT DISTINCT "contactEmail"
            FROM "EmailEvent"
            WHERE "campaignId" = ${campaignId}
              AND "eventType" = 'DELIVERED'
          )
      ) AS undelivered_bounces
    `;

    const result = {
      totalSent: 0, totalDelivered: 0, totalOpened: 0,
      totalClicked: 0, totalBounced: 0, totalUnsubscribed: 0,
      totalComplaints: 0, uniqueOpens: 0, uniqueClicks: 0,
    };

    for (const row of rows) {
      const total = Number(row.total);
      const unique = Number(row.unique_contacts);
      switch (row.event_type) {
        case 'SENT':        result.totalSent        = total; break;
        case 'DELIVERED':   result.totalDelivered   = total; break;
        case 'OPENED':      result.totalOpened      = total; result.uniqueOpens   = unique; break;
        case 'CLICKED':     result.totalClicked     = total; result.uniqueClicks  = unique; break;
        case 'BOUNCED':
        case 'FAILED':      break; // handled by net bounce query
        case 'COMPLAINED':  result.totalComplaints  = total; break;
        case 'UNSUBSCRIBED': result.totalUnsubscribed = total; break;
      }
    }

    // Use net bounces: only contacts that bounced and were never delivered
    result.totalBounced = Number(netBounceRows[0]?.net_bounces ?? 0);

    return result;
  }

  /**
   * Count unique contacts (distinct contactEmail) who received a SENT event
   * for any of the given campaign IDs. Used to compute "contacts reached" for
   * a date-range export without loading all event rows into memory.
   */
  async countUniqueContactsByCampaigns(campaignIds: string[], clientId: string): Promise<number> {
    if (campaignIds.length === 0) return 0;
    type Row = { unique_contacts: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT COUNT(DISTINCT "contactEmail") AS unique_contacts
      FROM "EmailEvent"
      WHERE "clientId" = ${clientId}
        AND "campaignId" = ANY(${campaignIds}::text[])
        AND "eventType" = 'SENT'
    `;
    return Number(rows[0]?.unique_contacts ?? 0);
  }

  /**
   * Get events timeline for a campaign
   */
  async getCampaignTimeline(campaignId: string) {
    return prisma.emailEvent.findMany({
      where: { campaignId },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        eventType: true,
        contactEmail: true,
        timestamp: true,
        errorMessage: true,
      },
    });
  }
}
