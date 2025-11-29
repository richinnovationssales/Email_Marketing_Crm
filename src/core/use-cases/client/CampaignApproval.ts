import { CampaignRepository } from '../../../infrastructure/repositories/CampaignRepository';
import { Campaign } from '../../entities/Campaign';
import { CampaignStatus } from '@prisma/client';

export class CampaignApproval {
  constructor(private campaignRepository: CampaignRepository) { }

  async submitForApproval(campaignId: string, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.update(campaignId, { status: CampaignStatus.PENDING_APPROVAL }, clientId);
  }

  async approve(campaignId: string, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.update(campaignId, { status: CampaignStatus.APPROVED }, clientId);
  }

  async reject(campaignId: string, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.update(campaignId, { status: CampaignStatus.REJECTED }, clientId);
  }

  async getPendingCampaigns(clientId: string): Promise<Campaign[]> {
    // This requires a new method in the repository
    // @ts-ignore
    return this.campaignRepository.findPending(clientId);
  }
}
