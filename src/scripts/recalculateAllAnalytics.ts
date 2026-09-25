// src/scripts/recalculateAllAnalytics.ts
//
// Recompute the CampaignAnalytics cache for every campaign of every client
// from the EmailEvent table, using the send-based counting logic.
//
// Run once after applying the email-event idempotency migration and deploying:
//   Development:  npx ts-node src/scripts/recalculateAllAnalytics.ts
//   Production:   node dist/scripts/recalculateAllAnalytics.js
//
// Options:
//   --dry-run         print what would change, write nothing
//   --client=<id>     only this client's campaigns
//
// Safe to re-run: it only overwrites cached totals with values derived from events.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { EmailEventRepository } from '../infrastructure/repositories/EmailEventRepository';
import { CampaignAnalyticsService } from '../infrastructure/services/CampaignAnalyticsService';

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const clientArg = process.argv.find((a) => a.startsWith('--client='));
  const clientId = clientArg ? clientArg.split('=')[1] : undefined;

  const repo = new EmailEventRepository();
  const service = new CampaignAnalyticsService();

  const campaigns = await prisma.campaign.findMany({
    where: clientId ? { clientId } : undefined,
    select: { id: true, name: true, clientId: true, analytics: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Recalculating ${campaigns.length} campaign(s)`);

  let changed = 0;
  let failed = 0;

  for (const c of campaigns) {
    try {
      const before = c.analytics;
      const after = dryRun
        ? await repo.getAggregatedCounts(c.id)
        : await service.updateAnalyticsFromEvents(c.id);

      const differs =
        !before ||
        before.totalSent !== after.totalSent ||
        before.totalDelivered !== after.totalDelivered ||
        before.totalBounced !== after.totalBounced ||
        before.totalOpened !== after.totalOpened ||
        before.totalClicked !== after.totalClicked;

      if (differs) {
        changed++;
        console.log(
          `${c.id} "${c.name}": ` +
            `sent ${before?.totalSent ?? '-'} -> ${after.totalSent}, ` +
            `delivered ${before?.totalDelivered ?? '-'} -> ${after.totalDelivered}, ` +
            `bounced ${before?.totalBounced ?? '-'} -> ${after.totalBounced}`
        );
      }
    } catch (error) {
      failed++;
      console.error(`${c.id} "${c.name}": FAILED`, error);
    }
  }

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}Done. ${campaigns.length} campaign(s), ${changed} changed, ${failed} failed.`
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit();
  });
