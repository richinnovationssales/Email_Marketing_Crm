import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DashboardManagement } from '../../core/use-cases/DashboardManagement';
import { DashboardRepository } from '../../infrastructure/repositories/DashboardRepository';
import { EmailEventRepository } from '../../infrastructure/repositories/EmailEventRepository';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as excel from 'exceljs';
import { UserRole } from '@prisma/client';

const dashboardRepository = new DashboardRepository();
const dashboardManagementUseCase = new DashboardManagement(dashboardRepository);
const emailEventRepository = new EmailEventRepository();

// Event priority for contact details sheet (higher = more advanced status)
const EVENT_PRIORITY: Record<string, number> = {
  SENT: 1,
  DELIVERED: 2,
  OPENED: 3,
  CLICKED: 4,
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

export class DashboardController {
  async getAdminDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      const dashboard = await dashboardManagementUseCase.getAdminDashboard();
      res.json(dashboard);
    } catch (error) {
      console.error('Error fetching admin dashboard:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getClientDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const dashboard = await dashboardManagementUseCase.getClientDashboard(req.user.clientId);
      res.json(dashboard);
    } catch (error) {
      console.error('Error fetching client dashboard:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getEmployeeDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const dashboard = await dashboardManagementUseCase.getEmployeeDashboard(req.user.clientId);
      res.json(dashboard);
    } catch (error) {
      console.error('Error fetching employee dashboard:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  /**
   * Server-side export: generates the same 4-sheet Excel the frontend previously built client-side.
   * Processes email events in batches to handle millions of records without memory issues.
   */
  async exportClientDashboard(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }

      const clientId = req.user.clientId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      // 1. Fetch campaigns in the date range + lightweight client summary in parallel
      const [sentCampaigns, clientSummary] = await Promise.all([
        dashboardManagementUseCase.getSentCampaignsForExport(clientId, startDate, endDate),
        dashboardManagementUseCase.getClientSummary(clientId),
      ]);

      // 2. Build campaign stats from analytics (date-range filtered via sentCampaigns)
      const campaignStats = sentCampaigns.map((c: any) => {
        const delivered = c.analytics?.totalDelivered ?? 0;
        const opened = c.analytics?.uniqueOpens ?? 0;
        return {
          name: c.name,
          date: c.sentAt ? formatDate(new Date(c.sentAt)) : 'Not sent',
          delivered,
          opened,
        };
      });

      // 3. Aggregate daily performance
      const dailyMap: Record<string, { date: string; delivered: number; opened: number }> = {};
      for (const item of campaignStats) {
        if (!dailyMap[item.date]) {
          dailyMap[item.date] = { date: item.date, delivered: 0, opened: 0 };
        }
        dailyMap[item.date].delivered += item.delivered;
        dailyMap[item.date].opened += item.opened;
      }
      const dailyPerformance = Object.values(dailyMap).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // 4. Compute stats — all scoped to the date range via sentCampaigns
      const emailsSent = sentCampaigns.reduce((sum: number, c: any) => sum + (c.analytics?.totalSent ?? 0), 0);

      // Unique contacts reached in this period (distinct recipients with a SENT event)
      const campaignIdsInRange = sentCampaigns.map((c: any) => c.id);
      const contactsReached = await emailEventRepository.countUniqueContactsByCampaigns(campaignIdsInRange, clientId);

      const stats = {
        contacts: contactsReached,
        campaigns: sentCampaigns.length,
        emailsSent,
        emailsRemaining: clientSummary.emailsRemaining,
      };

      const totalDelivered = campaignStats.reduce((sum: number, c: any) => sum + c.delivered, 0);
      const totalOpened = campaignStats.reduce((sum: number, c: any) => sum + c.opened, 0);
      const openRate = totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(1) : '0';

      // 5. Build workbook (same 4-sheet structure as frontend export-utils.ts)
      const workbook = new excel.Workbook();

      // --- Sheet 1: Summary ---
      const wsSummary = workbook.addWorksheet('Summary');
      wsSummary.columns = [{ width: 22 }, { width: 30 }];
      wsSummary.addRow(['Dashboard Report']);
      wsSummary.addRow([]);
      const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      wsSummary.addRow(['Report Date', reportDate]);
      if (startDate && endDate) {
        wsSummary.addRow(['Date Range', `${formatDate(startDate)} to ${formatDate(endDate)}`]);
      } else {
        wsSummary.addRow(['Date Range', 'All Time']);
      }
      wsSummary.addRow([]);
      wsSummary.addRow(['Metric', 'Value']);
      wsSummary.addRow([startDate || endDate ? 'Contacts Reached' : 'Total Contacts', stats.contacts]);
      wsSummary.addRow([startDate || endDate ? 'Campaigns in Period' : 'Total Campaigns', stats.campaigns]);
      wsSummary.addRow(['Emails Sent', stats.emailsSent]);
      wsSummary.addRow(['Current Email Balance', stats.emailsRemaining]);
      wsSummary.addRow([]);
      wsSummary.addRow(['Performance Metrics', '']);
      wsSummary.addRow(['Total Delivered', totalDelivered]);
      wsSummary.addRow(['Total Opened', totalOpened]);
      wsSummary.addRow(['Open Rate', `${openRate}%`]);
      // Merge title row
      wsSummary.mergeCells('A1:B1');

      // --- Sheet 2: Campaign Statistics ---
      const wsCampaigns = workbook.addWorksheet('Campaign Statistics');
      wsCampaigns.columns = [
        { header: '#', width: 5 },
        { header: 'Campaign Name', width: 30 },
        { header: 'Date', width: 28 },
        { header: 'Delivered', width: 12 },
        { header: 'Opened', width: 12 },
        { header: 'Open Rate', width: 12 },
      ];
      campaignStats.forEach((c: any, i: number) => {
        wsCampaigns.addRow([
          i + 1,
          c.name,
          c.date,
          c.delivered,
          c.opened,
          c.delivered > 0 ? `${((c.opened / c.delivered) * 100).toFixed(1)}%` : '0%',
        ]);
      });

      // --- Sheet 3: Daily Performance ---
      const wsPerformance = workbook.addWorksheet('Daily Performance');
      wsPerformance.columns = [
        { header: 'Date', width: 14 },
        { header: 'Delivered', width: 12 },
        { header: 'Opened', width: 12 },
        { header: 'Open Rate', width: 12 },
      ];
      dailyPerformance.forEach((d) => {
        wsPerformance.addRow([
          d.date,
          d.delivered,
          d.opened,
          d.delivered > 0 ? `${((d.opened / d.delivered) * 100).toFixed(1)}%` : '0%',
        ]);
      });

      // --- Sheet 4: Contact Details (batched event processing) ---
      const wsDetails = workbook.addWorksheet('Contact Details');
      wsDetails.columns = [
        { header: 'Campaign', width: 25 },
        { header: 'Subject', width: 30 },
        { header: 'Sent At', width: 18 },
        { header: 'Contact Email', width: 30 },
        { header: 'Latest Status', width: 14 },
        { header: 'Status Time', width: 20 },
      ];

      // Process each campaign's events in batches to avoid loading millions of rows at once
      for (const campaign of sentCampaigns) {
        const contactMap = new Map<string, { eventType: string; timestamp: Date }>();

        await emailEventRepository.findByCampaignBatched(campaign.id, 5000, async (events) => {
          for (const event of events) {
            const existing = contactMap.get(event.contactEmail);
            const eventPriority = EVENT_PRIORITY[event.eventType] ?? 0;
            const existingPriority = existing ? (EVENT_PRIORITY[existing.eventType] ?? 0) : -1;

            if (eventPriority > existingPriority) {
              contactMap.set(event.contactEmail, { eventType: event.eventType, timestamp: event.timestamp });
            } else if (eventPriority === existingPriority && existing) {
              if (event.timestamp > existing.timestamp) {
                contactMap.set(event.contactEmail, { eventType: event.eventType, timestamp: event.timestamp });
              }
            }
          }
        });

        const campaignSentAt = campaign.sentAt ? formatDateTime(new Date(campaign.sentAt)) : 'Not sent';
        let isFirstRow = true;

        for (const [email, event] of contactMap) {
          wsDetails.addRow([
            isFirstRow ? campaign.name : '',
            isFirstRow ? campaign.subject : '',
            isFirstRow ? campaignSentAt : '',
            email,
            event.eventType,
            formatDateTime(event.timestamp),
          ]);
          isFirstRow = false;
        }
      }

      // 6. Stream response
      const dateStr = new Date().toISOString().split('T')[0];
      const rangeSuffix = startDate && endDate ? `_${formatDate(startDate)}_to_${formatDate(endDate)}` : '';
      const filename = `Dashboard_Report_${dateStr}${rangeSuffix}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Error exporting client dashboard:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getCampaignPerformanceReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, format } = req.query;
      const filters: any = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      // Superadmin can filter by client, otherwise, it's the user's client
      if (req.user?.role === UserRole.SUPER_ADMIN && req.query.clientId) {
        filters.clientId = req.query.clientId as string;
      } else if (req.user?.clientId) {
        filters.clientId = req.user.clientId;
      }

      const report = await dashboardManagementUseCase.getCampaignPerformanceReport(filters);

      if (format === 'excel') {
        const workbook = new excel.Workbook();
        const worksheet = workbook.addWorksheet('Campaign Performance');
        worksheet.columns = [
          { header: 'Campaign ID', key: 'id', width: 30 },
          { header: 'Campaign Name', key: 'name', width: 30 },
          { header: 'Subject', key: 'subject', width: 50 },
          { header: 'Client', key: 'client', width: 20 },
          { header: 'Created At', key: 'createdAt', width: 20 },
        ];
        report.forEach(item => {
          worksheet.addRow({
            ...item,
            // If you want to include a client name, ensure it's part of the item object, e.g. clientName: item.clientName
            // client: item.clientName, // Uncomment if item.clientName exists
          });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=campaign-performance.xlsx');
        await workbook.xlsx.write(res);
        res.end();
      } else {
        res.json(report);
      }
    } catch (error) {
      console.error('Error fetching campaign performance report:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
