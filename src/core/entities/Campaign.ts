import { CampaignStatus, RecurringFrequency } from '@prisma/client';

export { RecurringFrequency };

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  content: string;
  status: CampaignStatus;
  isRecurring: boolean;
  recurringSchedule: string | null;

  // Enhanced recurring scheduling
  recurringFrequency: RecurringFrequency;
  recurringTime: string | null;        // HH:mm format
  recurringTimezone: string | null;    // IANA timezone
  recurringDaysOfWeek: number[];       // 0-6 for Sun-Sat
  recurringDayOfMonth: number | null;  // 1-31
  recurringStartDate: Date | null;
  recurringEndDate: Date | null;

  clientId: string;
  mailgunMessageIds?: string | null;
  mailgunTags?: string[];
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignSummary {
  id: string;
  name: string;
  subject: string;
  status: CampaignStatus;
  isRecurring: boolean;
  recurringFrequency: RecurringFrequency;
  sentAt: Date | null;
  clientId: string;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
}



