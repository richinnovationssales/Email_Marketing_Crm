import * as cron from 'node-cron';
import { SendCampaign } from '../../core/use-cases/client/SendCampaign';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { cronToHumanReadable } from '../utils/cronGenerator';

// Track biweekly execution (campaign ID -> last execution week number)
const biweeklyTracker = new Map<string, number>();

export class CampaignScheduler {
  private task: cron.ScheduledTask | null = null;
  private recurringTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    private sendCampaignUseCase: SendCampaign,
    private campaignRepository: CampaignRepository
  ) { }

  /**
   * Get the current week number of the year
   */
  private getWeekNumber(date: Date): number {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Check if campaign should be executed based on biweekly schedule
   */
  private shouldExecuteBiweekly(campaignId: string): boolean {
    const currentWeek = this.getWeekNumber(new Date());
    const lastExecutedWeek = biweeklyTracker.get(campaignId);
    
    // If never executed or at least 2 weeks have passed
    if (lastExecutedWeek === undefined || currentWeek - lastExecutedWeek >= 2) {
      biweeklyTracker.set(campaignId, currentWeek);
      return true;
    }
    return false;
  }

  /**
   * Check if campaign is within its active date range
   */
  private isWithinDateRange(
    startDate: Date | null, 
    endDate: Date | null
  ): boolean {
    const now = new Date();
    
    if (startDate && now < startDate) {
      return false; // Not started yet
    }
    
    if (endDate && now > endDate) {
      return false; // Already ended
    }
    
    return true;
  }

  start() {
    console.log('Starting campaign scheduler...');
    
    // This will run every minute to check for recurring campaigns
    this.task = cron.schedule('* * * * *', async () => {
      try {
        const campaigns = await this.campaignRepository.findRecurring();

        
        for (const campaign of campaigns) {
          // Skip if already scheduled
          if (this.recurringTasks.has(campaign.id)) {
            console.log('Campaign', campaign.id, 'is already scheduled');
            continue;
          }
          
          // Skip and Stop if outside date range (expired)
          if (!this.isWithinDateRange(
            campaign.recurringStartDate, 
            campaign.recurringEndDate
          )) {
            // If the campaign has clearly ended, mark it as STOPPED to prevent future queries
            if (campaign.recurringEndDate && new Date() > campaign.recurringEndDate) {
                console.log(`Campaign ${campaign.id} has reached its end date. Marking as STOPPED.`);
                try {
                  await this.campaignRepository.update(campaign.id, { status: 'STOPPED' }, campaign.clientId);
                } catch (err) {
                   console.error(`Failed to stop campaign ${campaign.id}`, err);
                }
            } else {
                console.log(`Campaign ${campaign.id} is outside its active date range (not started yet or ended)`);
            }
            continue;
          }
          
          // Skip if no valid schedule
          if (!campaign.recurringSchedule || !cron.validate(campaign.recurringSchedule)) {
            console.warn(`Campaign ${campaign.id} has invalid schedule: ${campaign.recurringSchedule}`);
            continue;
          }

          // Create schedule options with timezone if specified
          const scheduleOptions = {
            timezone: campaign.recurringTimezone || undefined
          };

          console.log(
            `Scheduling recurring campaign ${campaign.id} (${campaign.name}): ` +
            `${cronToHumanReadable(campaign.recurringSchedule)}` +
            (campaign.recurringTimezone ? ` (${campaign.recurringTimezone})` : '')
          );

          const recurringTask = cron.schedule(
            campaign.recurringSchedule, 
            async () => {
              try {
                // Check date range again at execution time
                if (!this.isWithinDateRange(
                  campaign.recurringStartDate, 
                  campaign.recurringEndDate
                )) {
                  console.log(`Campaign ${campaign.id} is now outside its active date range, stopping`);
                  this.stopCampaignTask(campaign.id);
                  return;
                }

                // Handle biweekly frequency
                if (campaign.recurringFrequency === 'BIWEEKLY') {
                  if (!this.shouldExecuteBiweekly(campaign.id)) {
                    console.log(`Skipping biweekly campaign ${campaign.id} (not this week)`);
                    return;
                  }
                }

                console.log(`Executing recurring campaign ${campaign.id} (${campaign.name})`);
                await this.sendCampaignUseCase.execute(campaign.id, campaign.clientId);
              } catch (error) {
                console.error(`Error executing recurring campaign ${campaign.id}:`, error);
              }
            },
            scheduleOptions
          );

          this.recurringTasks.set(campaign.id, recurringTask);
        }
      } catch (error) {
        console.error('Error in campaign scheduler:', error);
      }
    });

    console.log('Campaign scheduler started');
  }

  /**
   * Stop a specific campaign's scheduled task
   */
  stopCampaignTask(campaignId: string) {
    const task = this.recurringTasks.get(campaignId);
    if (task) {
      task.stop();
      this.recurringTasks.delete(campaignId);
      biweeklyTracker.delete(campaignId);
      console.log(`Stopped scheduled task for campaign ${campaignId}`);
    }
  }

  /**
   * Refresh a campaign's schedule (call after schedule update)
   */
  async refreshCampaignSchedule(campaignId: string) {
    this.stopCampaignTask(campaignId);
    // The next scheduler tick will pick up the updated schedule
  }

  stop() {
    console.log('Stopping campaign scheduler...');
    
    if (this.task) {
      this.task.stop();
    }
    
    this.recurringTasks.forEach((task, campaignId) => {
      task.stop();
      console.log(`Stopped scheduled task for campaign ${campaignId}`);
    });
    
    this.recurringTasks.clear();
    biweeklyTracker.clear();
    
    console.log('Campaign scheduler stopped');
  }
}
