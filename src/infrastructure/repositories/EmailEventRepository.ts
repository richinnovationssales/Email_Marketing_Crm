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
