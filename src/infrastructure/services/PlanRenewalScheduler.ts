import * as cron from 'node-cron';
import prisma from '../database/prisma';
import Logger from '../logging/logger';

/**
 * Runs at 00:00 on the 1st of every month in Asia/Dubai timezone (UTC+4).
 * Resets each active client's remainingMessages to their plan's emailLimit
 * and updates planStartDate / planRenewalDate for the new billing period.
 */
export class PlanRenewalScheduler {
  private task: cron.ScheduledTask | null = null;

  start() {
    // "0 0 1 * *" = midnight on 1st of every month
    this.task = cron.schedule(
      '0 0 1 * *',
      async () => {
        Logger.info('[PlanRenewal] Monthly plan renewal started (Asia/Dubai)');
        try {
          await this.renewAllPlans();
        } catch (error) {
          Logger.error('[PlanRenewal] Fatal error during plan renewal:', error);
        }
      },
      { timezone: 'Asia/Dubai' }
    );

    Logger.info('[PlanRenewal] Plan renewal scheduler started — fires 00:00 on 1st of month (Asia/Dubai)');
  }

  async renewAllPlans() {
    // Fetch all active, approved clients with their plan's emailLimit
    const clients = await prisma.client.findMany({
      where: { isActive: true, isApproved: true },
      include: { plan: true },
    });

    Logger.info(`[PlanRenewal] Processing ${clients.length} active client(s)`);

    const now = new Date();
    // Next renewal = 1st of next month at midnight UTC (scheduler already fired at Dubai midnight)
    const nextRenewal = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    let renewed = 0;
    let failed = 0;

    for (const client of clients) {
      try {
        const emailLimit = client.plan?.emailLimit ?? 0;

        await prisma.client.update({
          where: { id: client.id },
          data: {
            remainingMessages: emailLimit,
            planStartDate: now,
            planRenewalDate: nextRenewal,
          },
        });

        Logger.info(
          `[PlanRenewal] Client "${client.name}" (${client.id}) reset to ${emailLimit} messages. ` +
          `Next renewal: ${nextRenewal.toISOString()}`
        );
        renewed++;
      } catch (error) {
        Logger.error(`[PlanRenewal] Failed to renew client "${client.name}" (${client.id}):`, error);
        failed++;
      }
    }

    Logger.info(`[PlanRenewal] Done — renewed: ${renewed}, failed: ${failed}`);
  }

  stop() {
    if (this.task) {
      this.task.stop();
      Logger.info('[PlanRenewal] Plan renewal scheduler stopped');
    }
  }
}
