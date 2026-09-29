import { DashboardRepository } from '../../infrastructure/repositories/DashboardRepository';

export class DashboardManagement {
  constructor(private dashboardRepository: DashboardRepository) { }

  async getAdminDashboard() {
    return this.dashboardRepository.getAdminDashboard();
  }

  async getClientDashboard(clientId: string) {
    return this.dashboardRepository.getClientDashboard(clientId);
  }

  async getEmployeeDashboard(clientId: string) {
    return this.dashboardRepository.getEmployeeDashboard(clientId);
  }

  async getCampaignPerformanceReport(filters: { startDate?: Date, endDate?: Date, clientId?: string }) {
    return this.dashboardRepository.getCampaignPerformanceReport(filters);
  }

  async getSentCampaignsForExport(clientId: string, startDate?: Date, endDate?: Date) {
    return this.dashboardRepository.getSentCampaignsForExport(clientId, startDate, endDate);
  }

  async getClientSummary(clientId: string) {
    return this.dashboardRepository.getClientSummary(clientId);
  }
}
