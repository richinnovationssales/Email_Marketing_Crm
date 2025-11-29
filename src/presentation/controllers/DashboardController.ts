import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DashboardManagement } from '../../core/use-cases/DashboardManagement';
import { DashboardRepository } from '../../infrastructure/repositories/DashboardRepository';
import { AuthRequest } from '../middlewares/authMiddleware';
import * as excel from 'exceljs';
import { UserRole } from '@prisma/client';

const dashboardRepository = new DashboardRepository();
const dashboardManagementUseCase = new DashboardManagement(dashboardRepository);

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
