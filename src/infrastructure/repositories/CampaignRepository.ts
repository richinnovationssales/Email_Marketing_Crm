import { Campaign } from '../../core/entities/Campaign';
import prisma from '../../infrastructure/database/prisma';

export class CampaignRepository {
  async create(data: Campaign, clientId: string, userId: string): Promise<Campaign> {
    return await prisma.campaign.create({
      data: {
        ...data,
        clientId,
        createdById: userId
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
        }
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
        }
      }
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
        }
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
        }
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

  async findRecurring(): Promise<Campaign[]> {
    return await prisma.campaign.findMany({ where: { isRecurring: true, status: 'APPROVED' } });
  }
}


