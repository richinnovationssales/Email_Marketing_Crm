import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  ClientAnalyticsExportRepository,
  DateRangeFilter,
} from '../../infrastructure/repositories/ClientAnalyticsExportRepository';

const exportRepository = new ClientAnalyticsExportRepository();

export class ClientAnalyticsExportController {
  /**
   * GET /analytics/export
   * Export comprehensive analytics data for the client within a date range.
   *
   * Query params:
   *   - rangeType: 'monthly' | 'yearly' | 'custom' (required)
   *   - month: 1-12 (required for monthly)
   *   - year: YYYY (required for monthly/yearly)
   *   - startDate: ISO date (required for custom)
   *   - endDate: ISO date (required for custom)
   *   - includeEvents: 'true' to include email events (optional, can be large)
   *   - eventLimit: number, max events to return (default 1000)
   */
  async getExportData(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.clientId;

      if (!clientId) {
        res.status(StatusCodes.UNAUTHORIZED).json({ error: 'Client ID not found in token' });
        return;
      }

      // Parse date range
      const rangeType = req.query.rangeType as string;
      if (!rangeType || !['monthly', 'yearly', 'custom'].includes(rangeType)) {
        res.status(StatusCodes.BAD_REQUEST).json({
          error: 'Invalid rangeType. Must be: monthly, yearly, or custom',
        });
        return;
      }

      let startDate: Date;
      let endDate: Date;

      if (rangeType === 'monthly') {
        const month = parseInt(req.query.month as string, 10);
        const year = parseInt(req.query.year as string, 10);

        if (isNaN(month) || month < 1 || month > 12 || isNaN(year)) {
          res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid month or year for monthly range',
          });
          return;
        }

        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month
      } else if (rangeType === 'yearly') {
        const year = parseInt(req.query.year as string, 10);

        if (isNaN(year)) {
          res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid year for yearly range',
          });
          return;
        }

        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      } else {
        // custom
        const startStr = req.query.startDate as string;
        const endStr = req.query.endDate as string;

        if (!startStr || !endStr) {
          res.status(StatusCodes.BAD_REQUEST).json({
            error: 'startDate and endDate are required for custom range',
          });
          return;
        }

        startDate = new Date(startStr);
        endDate = new Date(endStr);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          res.status(StatusCodes.BAD_REQUEST).json({
            error: 'Invalid date format. Use ISO format (YYYY-MM-DD)',
          });
          return;
        }

        // Set endDate to end of day
        endDate.setHours(23, 59, 59, 999);
      }

      const filter: DateRangeFilter = {
        rangeType: rangeType as 'monthly' | 'yearly' | 'custom',
        startDate,
        endDate,
      };

      // Fetch client info
      const clientInfo = await exportRepository.getClientInfo(clientId);
      if (!clientInfo) {
        res.status(StatusCodes.NOT_FOUND).json({ error: 'Client not found' });
        return;
      }

      // Fetch all data sections in parallel
      const [summary, campaigns, contacts, groups] = await Promise.all([
        exportRepository.getSummary(clientId, filter),
        exportRepository.getCampaigns(clientId, filter),
        exportRepository.getContacts(clientId, filter),
        exportRepository.getGroups(clientId, filter),
      ]);

      // Optional: Fetch email events
      let emailEvents;
      const includeEvents = req.query.includeEvents === 'true';
      if (includeEvents) {
        const eventLimit = parseInt(req.query.eventLimit as string, 10) || 1000;
        emailEvents = await exportRepository.getEmailEvents(clientId, filter, eventLimit);
      }

      const response = {
        exportedAt: new Date().toISOString(),
        dateRange: {
          rangeType: filter.rangeType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        client: {
          id: clientInfo.id,
          name: clientInfo.name,
          plan: clientInfo.plan.name,
          remainingMessages: clientInfo.remainingMessages,
        },
        summary,
        campaigns,
        contacts,
        groups,
        ...(includeEvents && { emailEvents }),
      };

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to export analytics data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
