import { CampaignRepository } from '../../../infrastructure/repositories/CampaignRepository';
import { GreetingRepository } from '../../../infrastructure/repositories/GreetingRepository';
import { Campaign, CampaignSummary } from '../../entities/Campaign';
import {
  createCampaignSchema,
  updateCampaignSchema,
  updateRecurringScheduleSchema,
  CreateCampaignInput,
  UpdateCampaignInput,
  UpdateRecurringScheduleInput
} from '../../../presentation/validators/campaignValidators';
import { ZodError } from 'zod';
import { CampaignStatus, Prisma } from '@prisma/client';

// Prisma error code for foreign key violation. The greeting was deleted between
// resolveGreeting() reading it and the create/update writing the FK.
const FK_VIOLATION = 'P2003';

function isGreetingFkViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === FK_VIOLATION &&
    typeof error.meta?.field_name === 'string' &&
    error.meta.field_name.toLowerCase().includes('greeting')
  );
}

export class CampaignManagement {
  private greetingRepository = new GreetingRepository();

  constructor(private campaignRepository: CampaignRepository) { }

  /**
   * If a greetingId is supplied, capture its current template into greetingSnapshot
   * so future admin edits/deletes don't mutate this campaign.
   */
  private async resolveGreeting<T extends { greetingId?: string | null; greetingSnapshot?: string | null }>(
    data: T
  ): Promise<T> {
    if (!data.greetingId) {
      return data;
    }
    const greeting = await this.greetingRepository.findById(data.greetingId);
    if (!greeting) {
      // Picked greeting was deleted between fetch and save — fall back to the typed snapshot.
      return { ...data, greetingId: null };
    }
    return { ...data, greetingSnapshot: greeting.template };
  }

  /**
   * Create a new campaign with validation
   * @throws ZodError if validation fails
   */
  async create(data: unknown, clientId: string, userId: string, initialStatus?: CampaignStatus): Promise<Campaign> {
    const validatedData = createCampaignSchema.parse(data);
    const enriched = await this.resolveGreeting(validatedData);
    try {
      return await this.campaignRepository.create(enriched, clientId, userId, initialStatus);
    } catch (error) {
      if (isGreetingFkViolation(error)) {
        // Greeting was deleted between read and write; snapshot is already in
        // `enriched` so the campaign keeps its rendered text.
        return this.campaignRepository.create(
          { ...enriched, greetingId: null },
          clientId,
          userId,
          initialStatus
        );
      }
      throw error;
    }
  }

  async findAll(clientId: string): Promise<CampaignSummary[]> {
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
    const enriched = await this.resolveGreeting(validatedData);
    try {
      return await this.campaignRepository.update(id, enriched as Partial<Campaign>, clientId);
    } catch (error) {
      if (isGreetingFkViolation(error)) {
        return this.campaignRepository.update(
          id,
          { ...enriched, greetingId: null } as Partial<Campaign>,
          clientId
        );
      }
      throw error;
    }
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
