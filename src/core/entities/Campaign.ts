import { CampaignStatus } from '@prisma/client';

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  status: CampaignStatus;
  isRecurring: boolean;
  recurringSchedule: string | null;
  clientId: string;
  mailgunMessageIds?: string | null;
  mailgunTags?: string[];
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}



