// src/presentation/validators/campaignValidators.ts
// Zod validation schemas for campaign input validation

import { z } from 'zod';

// Recurring frequency enum matching Prisma schema
export const RecurringFrequencyEnum = z.enum([
  'NONE', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM'
]);

// Time format validation regex (HH:mm, 24-hour format)
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// IANA timezone validation (basic check)
const timezoneRegex = /^[A-Za-z_]+\/[A-Za-z_]+$/;

/**
 * Schema for creating a new campaign
 */
export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255, 'Name too long'),
  subject: z.string().min(1, 'Email subject is required').max(500, 'Subject too long'),
  content: z.string().min(1, 'Email content is required'),
  groupIds: z.array(z.string().cuid()).optional(),
  
  // Recurring schedule fields
  isRecurring: z.boolean().default(false),
  recurringFrequency: RecurringFrequencyEnum.optional().default('NONE'),
  recurringTime: z.string()
    .regex(timeRegex, 'Time must be in HH:mm format (24-hour)')
    .optional()
    .nullable(),
  recurringTimezone: z.string()
    .regex(timezoneRegex, 'Timezone must be in IANA format (e.g., Asia/Kolkata)')
    .optional()
    .nullable(),
  recurringDaysOfWeek: z.array(
    z.number().int().min(0, 'Day must be 0-6').max(6, 'Day must be 0-6')
  ).optional().default([]),
  recurringDayOfMonth: z.number()
    .int()
    .min(1, 'Day of month must be 1-31')
    .max(31, 'Day of month must be 1-31')
    .optional()
    .nullable(),
  recurringStartDate: z.string().datetime().optional().nullable(),
  recurringEndDate: z.string().datetime().optional().nullable(),
  
  // For CUSTOM frequency, allow cron string
  customCronExpression: z.string().optional(),
}).refine((data) => {
  // If not recurring, no further validation needed
  if (!data.isRecurring) {
    return true;
  }
  
  // Recurring campaigns must have a frequency other than NONE
  if (!data.recurringFrequency || data.recurringFrequency === 'NONE') {
    return false;
  }
  
  return true;
}, {
  message: 'Recurring campaigns require a frequency (DAILY, WEEKLY, BIWEEKLY, MONTHLY, or CUSTOM)',
  path: ['recurringFrequency']
}).refine((data) => {
  // Weekly/Biweekly campaigns need at least one day selected
  if (data.isRecurring && 
      ['WEEKLY', 'BIWEEKLY'].includes(data.recurringFrequency || '') &&
      (!data.recurringDaysOfWeek || data.recurringDaysOfWeek.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Weekly/Biweekly campaigns require at least one day of the week selected',
  path: ['recurringDaysOfWeek']
}).refine((data) => {
  // Monthly campaigns need a day of month
  if (data.isRecurring && 
      data.recurringFrequency === 'MONTHLY' &&
      !data.recurringDayOfMonth) {
    return false;
  }
  return true;
}, {
  message: 'Monthly campaigns require a day of the month (1-31)',
  path: ['recurringDayOfMonth']
}).refine((data) => {
  // End date must be after start date if both are provided
  if (data.recurringStartDate && data.recurringEndDate) {
    return new Date(data.recurringEndDate) > new Date(data.recurringStartDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['recurringEndDate']
});

/**
 * Schema for updating an existing campaign
 */
export const updateCampaignSchema = createCampaignSchema.partial();

/**
 * Schema specifically for updating recurring schedule
 */
export const updateRecurringScheduleSchema = z.object({
  isRecurring: z.boolean(),
  recurringFrequency: RecurringFrequencyEnum,
  recurringTime: z.string()
    .regex(timeRegex, 'Time must be in HH:mm format (24-hour)')
    .optional()
    .nullable(),
  recurringTimezone: z.string()
    .regex(timezoneRegex, 'Timezone must be in IANA format')
    .optional()
    .nullable(),
  recurringDaysOfWeek: z.array(
    z.number().int().min(0).max(6)
  ).optional().default([]),
  recurringDayOfMonth: z.number()
    .int()
    .min(1)
    .max(31)
    .optional()
    .nullable(),
  recurringStartDate: z.string().datetime().optional().nullable(),
  recurringEndDate: z.string().datetime().optional().nullable(),
  customCronExpression: z.string().optional(),
}).refine((data) => {
  if (!data.isRecurring) return true;
  if (!data.recurringFrequency || data.recurringFrequency === 'NONE') return false;
  return true;
}, {
  message: 'Recurring campaigns require a frequency',
  path: ['recurringFrequency']
}).refine((data) => {
  if (data.isRecurring && 
      ['WEEKLY', 'BIWEEKLY'].includes(data.recurringFrequency) &&
      (!data.recurringDaysOfWeek || data.recurringDaysOfWeek.length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Weekly/Biweekly campaigns require days of week',
  path: ['recurringDaysOfWeek']
}).refine((data) => {
  if (data.isRecurring && 
      data.recurringFrequency === 'MONTHLY' &&
      !data.recurringDayOfMonth) {
    return false;
  }
  return true;
}, {
  message: 'Monthly campaigns require day of month',
  path: ['recurringDayOfMonth']
});

// Type exports
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type UpdateRecurringScheduleInput = z.infer<typeof updateRecurringScheduleSchema>;
