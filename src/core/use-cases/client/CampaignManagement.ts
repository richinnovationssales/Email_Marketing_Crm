import { CampaignRepository } from '../../../infrastructure/repositories/CampaignRepository';
import { Campaign } from '../../entities/Campaign';

export class CampaignManagement {
  constructor(private campaignRepository: CampaignRepository) { }

  async create(data: Campaign, clientId: string): Promise<Campaign> {
    return this.campaignRepository.create(data, clientId);
  }

  async findAll(clientId: string): Promise<Campaign[]> {
    return this.campaignRepository.findAll(clientId);
  }

  async findById(id: string, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.findById(id, clientId);
  }

  async update(id: string, data: Partial<Campaign>, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.update(id, data, clientId);
  }

  async delete(id: string, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.delete(id, clientId);
  }
}
