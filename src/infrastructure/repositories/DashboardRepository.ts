import prisma from '../../infrastructure/database/prisma';

export class DashboardRepository {
  async getAdminDashboard() {
    // const tenantCount = await prisma.tenant.count();
    const userCount = await prisma.user.count();
    const campaignCount = await prisma.campaign.count();
    return {
      // tenantCount,
      userCount,
      campaignCount,
    };
  }

  async getClientDashboard(clientId: string) {
    const userCount = await prisma.user.count({ where: { clientId } });
    const campaignCount = await prisma.campaign.count({ where: { clientId } });
    const contactCount = await prisma.contact.count({ where: { clientId } });
    const groupCount = await prisma.group.count({ where: { clientId } });
    const templateCount = await prisma.template.count({ where: { clientId } });
    return {
      userCount,
      campaignCount,
      contactCount,
      groupCount,
      templateCount,
    };
  }

  async getEmployeeDashboard(clientId: string) {
    // For now, the employee dashboard will be the same as the client dashboard.
    // This can be changed later to show employee-specific data.
    return this.getClientDashboard(clientId);
  }

  async getCampaignPerformanceReport(filters: { startDate?: Date, endDate?: Date, clientId?: string }) {
    const where: any = {};
    if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: filters.startDate,
        lte: filters.endDate,
      };
    }
    return prisma.campaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        subject: true,
        createdAt: true,
        updatedAt: true,
        // tenant: {
        //   select: {
        //     name: true,
        //   },
        // },
      },
    });
  }
}
