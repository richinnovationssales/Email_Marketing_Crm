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
  createdAt: Date;
  updatedAt: Date;
}


