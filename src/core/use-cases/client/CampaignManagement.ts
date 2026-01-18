import { CampaignRepository } from '../../../infrastructure/repositories/CampaignRepository';
import { Campaign } from '../../entities/Campaign';
import { 
  createCampaignSchema, 
  updateCampaignSchema,
  updateRecurringScheduleSchema,
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateRecurringScheduleInput
} from '../../../presentation/validators/campaignValidators';
import { ZodError } from 'zod';
import { CampaignStatus } from '@prisma/client';

export class CampaignManagement {
  constructor(private campaignRepository: CampaignRepository) { }

  /**
   * Create a new campaign with validation
   * @throws ZodError if validation fails
   */
  async create(data: unknown, clientId: string, userId: string, initialStatus?: CampaignStatus): Promise<Campaign> {
    const validatedData = createCampaignSchema.parse(data);
    return this.campaignRepository.create(validatedData, clientId, userId, initialStatus);
  }

  async findAll(clientId: string): Promise<Campaign[]> {
    return this.campaignRepository.findAll(clientId);
  }

  async findById(id: string, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.findById(id, clientId);
  }

  /**
   * Update a campaign with validation
   * @throws ZodError if validation fails
   */
  async update(id: string, data: unknown, clientId: string): Promise<Campaign | null> {
    const validatedData = updateCampaignSchema.parse(data);
    return this.campaignRepository.update(id, validatedData as Partial<Campaign>, clientId);
  }

  async delete(id: string, clientId: string): Promise<Campaign | null> {
    return this.campaignRepository.delete(id, clientId);
  }

  /**
   * Update recurring schedule for a campaign
   * Only allows updates for DRAFT or APPROVED campaigns
   * @throws ZodError if validation fails
   */
  async updateRecurringSchedule(
    id: string, 
    data: unknown, 
    clientId: string
  ): Promise<Campaign | null> {
    const validatedData = updateRecurringScheduleSchema.parse(data);
    return this.campaignRepository.updateRecurringSchedule(id, validatedData, clientId);
  }
}
