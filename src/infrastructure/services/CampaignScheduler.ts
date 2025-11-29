import * as cron from 'node-cron';
import { SendCampaign } from '../../core/use-cases/client/SendCampaign';
import { CampaignRepository } from '../repositories/CampaignRepository';

export class CampaignScheduler {
  private task: cron.ScheduledTask | null = null;
  private recurringTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    private sendCampaignUseCase: SendCampaign,
    private campaignRepository: CampaignRepository
  ) { }

  start() {
    // This will run every minute to check for recurring campaigns to send.
    // In a production application, you might want to run this less frequently.
    this.task = cron.schedule('* * * * *', async () => {
      console.log('Checking for recurring campaigns to send...');
      const campaigns = await this.campaignRepository.findRecurring();
      for (const campaign of campaigns) {
        if (campaign.recurringSchedule && cron.validate(campaign.recurringSchedule) && !this.recurringTasks.has(campaign.id)) {
          const recurringTask = cron.schedule(campaign.recurringSchedule, () => {
            this.sendCampaignUseCase.execute(campaign.id, campaign.clientId);
          });
          this.recurringTasks.set(campaign.id, recurringTask);
        }
      }
    });
  }

  stop() {
    if (this.task) {
      this.task.stop();
    }
    this.recurringTasks.forEach(task => task.stop());
  }
}
