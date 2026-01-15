// src/infrastructure/utils/cronGenerator.ts
// Converts user-friendly schedule configuration to cron expressions

export type RecurringFrequencyType = 'NONE' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface ScheduleConfig {
  frequency: RecurringFrequencyType;
  time?: string | null;        // HH:mm format
  daysOfWeek?: number[];       // 0-6 for Sunday-Saturday
  dayOfMonth?: number | null;  // 1-31
  customCron?: string;         // For CUSTOM frequency
}

// Default time when not specified by user (9:00 AM)
const DEFAULT_TIME = '09:00';

/**
 * Generates a cron expression from user-friendly schedule configuration
 * @param config Schedule configuration
 * @returns Cron expression string or null if frequency is NONE
 */
export function generateCronExpression(config: ScheduleConfig): string | null {
  if (config.frequency === 'NONE') {
    return null;
  }

  // Use default time if not specified
  const timeStr = config.time || DEFAULT_TIME;
  const [hour, minute] = timeStr.split(':').map(Number);

  switch (config.frequency) {
    case 'DAILY':
      // Run every day at specified time
      return `${minute} ${hour} * * *`;

    case 'WEEKLY':
      // Run on specified days of the week
      const weeklyDays = config.daysOfWeek?.length 
        ? config.daysOfWeek.join(',') 
        : '1'; // Default to Monday
      return `${minute} ${hour} * * ${weeklyDays}`;

    case 'BIWEEKLY':
      // Cron doesn't support biweekly natively
      // We use the same format as weekly; the scheduler handles the biweekly logic
      const biweeklyDays = config.daysOfWeek?.length 
        ? config.daysOfWeek.join(',') 
        : '1';
      return `${minute} ${hour} * * ${biweeklyDays}`;

    case 'MONTHLY':
      // Run on specified day of the month
      const dayOfMonth = config.dayOfMonth || 1;
      return `${minute} ${hour} ${dayOfMonth} * *`;

    case 'CUSTOM':
      // For custom frequency, use the provided cron string
      return config.customCron || `${minute} ${hour} * * *`;

    default:
      return null;
  }
}

/**
 * Validates a time string is in HH:mm format
 * @param time Time string to validate
 * @returns True if valid
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * Validates a cron expression
 * @param cronExpression Cron expression to validate
 * @returns True if valid
 */
export function isValidCronExpression(cronExpression: string): boolean {
  // Basic validation for standard 5-field cron
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  
  // Check each part has valid characters
  const fieldPatterns = [
    /^(\*|[0-5]?\d)(-[0-5]?\d)?(,[0-5]?\d(-[0-5]?\d)?)*$/,     // Minute (0-59)
    /^(\*|[01]?\d|2[0-3])(-([01]?\d|2[0-3]))?(,([01]?\d|2[0-3])(-([01]?\d|2[0-3]))?)*$/, // Hour (0-23)
    /^(\*|[1-9]|[12]\d|3[01])(-([1-9]|[12]\d|3[01]))?(,([1-9]|[12]\d|3[01])(-([1-9]|[12]\d|3[01]))?)*$/, // Day of month (1-31)
    /^(\*|[1-9]|1[0-2])(-([1-9]|1[0-2]))?(,([1-9]|1[0-2])(-([1-9]|1[0-2]))?)*$/, // Month (1-12)
    /^(\*|[0-6])(-[0-6])?(,[0-6](-[0-6])?)*$/                  // Day of week (0-6)
  ];
  
  return parts.every((part, index) => fieldPatterns[index].test(part));
}

/**
 * Converts a cron expression to a human-readable description
 * @param cronExpression Cron expression
 * @returns Human-readable description
 */
export function cronToHumanReadable(cronExpression: string): string {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) return 'Invalid schedule';
  
  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  
  if (dayOfMonth !== '*' && dayOfWeek === '*') {
    return `Monthly on day ${dayOfMonth} at ${time}`;
  }
  
  if (dayOfMonth === '*' && dayOfWeek !== '*') {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const days = dayOfWeek.split(',').map(d => dayNames[parseInt(d)]).join(', ');
    return `Weekly on ${days} at ${time}`;
  }
  
  if (dayOfMonth === '*' && dayOfWeek === '*') {
    return `Daily at ${time}`;
  }
  
  return `Custom schedule at ${time}`;
}
