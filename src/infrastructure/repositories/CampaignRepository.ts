import { Campaign } from '../../core/entities/Campaign';
import { CampaignStatus } from '@prisma/client';
import prisma from '../../infrastructure/database/prisma';
import { generateCronExpression, RecurringFrequencyType } from '../utils/cronGenerator';
import { CreateCampaignInput, UpdateRecurringScheduleInput } from '../../presentation/validators/campaignValidators';

export class CampaignRepository {
  async create(data: CreateCampaignInput, clientId: string, userId: string, initialStatus?: CampaignStatus): Promise<Campaign> {
    // Generate cron expression if recurring
    const recurringSchedule = data.isRecurring 
      ? generateCronExpression({
          frequency: (data.recurringFrequency || 'NONE') as RecurringFrequencyType,
          time: data.recurringTime,
          daysOfWeek: data.recurringDaysOfWeek,
          dayOfMonth: data.recurringDayOfMonth,
          customCron: data.customCronExpression
        })
      : null;

    return await prisma.campaign.create({
      data: {
        name: data.name,
        subject: data.subject,
        content: data.content,
        status: initialStatus || 'DRAFT',
        isRecurring: data.isRecurring,
        recurringSchedule,
        recurringFrequency: data.recurringFrequency || 'NONE',
        recurringTime: data.recurringTime || null,
        recurringTimezone: data.recurringTimezone || null,
        recurringDaysOfWeek: data.recurringDaysOfWeek || [],
        recurringDayOfMonth: data.recurringDayOfMonth || null,
        recurringStartDate: data.recurringStartDate ? new Date(data.recurringStartDate) : null,
        recurringEndDate: data.recurringEndDate ? new Date(data.recurringEndDate) : null,
        clientId,
        createdById: userId,
        groups: data.groupIds ? {
          connect: data.groupIds.map(id => ({ id }))
        } : undefined
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        },
        groups: true
      }
    });
  }

  async findAll(clientId: string): Promise<Campaign[]> {
    return await prisma.campaign.findMany({
      where: { clientId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        },
        groups: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string, clientId: string): Promise<Campaign | null> {
    return await prisma.campaign.findFirst({
      where: { id, clientId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        },
        groups: true,
        analytics: true
      }
    });
  }

  async update(id: string, data: Partial<Campaign>, clientId: string): Promise<Campaign | null> {
    // First, verify the campaign belongs to the client
    const campaign = await prisma.campaign.findFirst({ where: { id, clientId } });
    if (!campaign) {
      return null;
    }
    return await prisma.campaign.update({ where: { id }, data });
  }

  async delete(id: string, clientId: string): Promise<Campaign | null> {
    // First, verify the campaign belongs to the client
    const campaign = await prisma.campaign.findFirst({ where: { id, clientId } });
    if (!campaign) {
      return null;
    }
    return await prisma.campaign.delete({ where: { id } });
  }

  /**
   * Update recurring schedule for a campaign
   * Only allows updates for DRAFT or APPROVED campaigns
   */
  async updateRecurringSchedule(
    id: string, 
    scheduleData: UpdateRecurringScheduleInput, 
    clientId: string
  ): Promise<Campaign | null> {
    // Verify campaign exists and is in a modifiable state
    const campaign = await prisma.campaign.findFirst({ 
      where: { 
        id, 
        clientId,
        status: { in: ['DRAFT', 'APPROVED'] }
      }
    });
    
    if (!campaign) {
      return null;
    }

    // Generate new cron expression
    const recurringSchedule = scheduleData.isRecurring 
      ? generateCronExpression({
          frequency: scheduleData.recurringFrequency as RecurringFrequencyType,
          time: scheduleData.recurringTime,
          daysOfWeek: scheduleData.recurringDaysOfWeek,
          dayOfMonth: scheduleData.recurringDayOfMonth,
          customCron: scheduleData.customCronExpression
        })
      : null;

    return await prisma.campaign.update({
      where: { id },
      data: {
        isRecurring: scheduleData.isRecurring,
        recurringSchedule,
        recurringFrequency: scheduleData.recurringFrequency,
        recurringTime: scheduleData.recurringTime || null,
        recurringTimezone: scheduleData.recurringTimezone || null,
        recurringDaysOfWeek: scheduleData.recurringDaysOfWeek || [],
        recurringDayOfMonth: scheduleData.recurringDayOfMonth || null,
        recurringStartDate: scheduleData.recurringStartDate ? new Date(scheduleData.recurringStartDate) : null,
        recurringEndDate: scheduleData.recurringEndDate ? new Date(scheduleData.recurringEndDate) : null
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        },
        groups: true
      }
    });
  }

  async findPending(clientId: string): Promise<Campaign[]> {
    return await prisma.campaign.findMany({
      where: { clientId, status: 'PENDING_APPROVAL' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        },
        groups: true
      }
    });
  }

  async getGroups(campaignId: string, clientId: string): Promise<any[]> {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, clientId },
      include: {
        groups: true,
      },
    });
    return campaign ? campaign.groups : [];
  }

  /**
   * Atomically transition a campaign from one status to another.
   * Returns true if the transition succeeded (row was updated), false if the
   * campaign was already in a different status (claimed by another process).
   */
  async atomicStatusTransition(
    id: string,
    fromStatus: CampaignStatus,
    toStatus: CampaignStatus,
    clientId: string
  ): Promise<boolean> {
    const result = await prisma.campaign.updateMany({
      where: { id, clientId, status: fromStatus },
      data: { status: toStatus },
    });
    return result.count > 0;
  }

  async findRecurring(): Promise<Campaign[]> {
    return await prisma.campaign.findMany({ 
      where: { 
        isRecurring: true, 
        status: 'APPROVED',
        recurringFrequency: { not: 'NONE' }
      },
      include: {
        groups: {
          include: {
            contactGroups: {
              include: {
                contact: true
              }
            }
          }
        }
      }
    });
  }
}
