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
    const users = (await prisma.user.findMany({
      where: { clientId }, omit: {
        password: true,
      }
    })).filter((user) => user.role !== 'CLIENT_SUPER_ADMIN');
    const campaigns = await prisma.campaign.findMany({
      where: { clientId }, include: {
        emailEvents: true,
        groups: true,

      }
    });
    const contacts = await prisma.contact.findMany({
      where: { clientId }, include: {
        contactGroups: true,
        customFieldValues: true
      }
    });
    const groups = await prisma.group.findMany({
      where: { clientId }, include: {
        campaigns: true,
        contactGroups: true
      }
    });
    const templates = await prisma.template.findMany({ where: { clientId } });
    return {
      users,
      campaigns,
      contacts,
      groups,
      templates,
    };
  }

  async getEmployeeDashboard(clientId: string) {
    // For now, the employee dashboard will be the same as the client dashboard.
    // This can be changed later to show employee-specific data.
    return this.getClientDashboard(clientId);
  }

  async getCampaignPerformanceReport(filters: { startDate?: Date, endDate?: Date, clientId?: string }) {
    const where: any = { status: 'SENT' };
    if (filters.clientId) {
      where.clientId = filters.clientId;
    }
    // Filter by send date (not creation date) so the range matches what the user sees in reports
    if (filters.startDate || filters.endDate) {
      where.sentAt = {};
      if (filters.startDate) where.sentAt.gte = filters.startDate;
      if (filters.endDate) where.sentAt.lte = filters.endDate;
    }
    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      select: {
        id: true,
        name: true,
        subject: true,
        status: true,
        createdAt: true,
        sentAt: true,
        client: { select: { name: true } },
        analytics: true,
      },
    });

    return campaigns.map((c) => {
      const a = c.analytics;
      const sent = a?.totalSent ?? 0;
      const delivered = a?.totalDelivered ?? 0;
      const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0);
      return {
        id: c.id,
        name: c.name,
        subject: c.subject,
        status: c.status,
        client: c.client?.name ?? '',
        createdAt: c.createdAt,
        sentAt: c.sentAt,
        totalSent: sent,
        totalDelivered: delivered,
        totalOpened: a?.totalOpened ?? 0,
        uniqueOpens: a?.uniqueOpens ?? 0,
        totalClicked: a?.totalClicked ?? 0,
        uniqueClicks: a?.uniqueClicks ?? 0,
        totalBounced: a?.totalBounced ?? 0,
        totalComplaints: a?.totalComplaints ?? 0,
        deliveryRate: pct(delivered, sent),
        openRate: pct(a?.uniqueOpens ?? 0, delivered),
        clickRate: pct(a?.uniqueClicks ?? 0, delivered),
        bounceRate: pct(a?.totalBounced ?? 0, sent),
      };
    });
  }
}
