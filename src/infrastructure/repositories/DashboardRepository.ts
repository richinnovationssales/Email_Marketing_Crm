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
    const [campaigns, contactCount, groupCount, client] = await Promise.all([
      prisma.campaign.findMany({
        where: { clientId },
        include: {
          analytics: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({
        where: { clientId },
      }),
      prisma.group.count({
        where: { clientId },
      }),

      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          remainingMessages: true,
        },
      }),
    ]);

    return {
      campaigns,
      contactCount,
      groupCount,
      emailsRemaining: client?.remainingMessages ?? 0,
    };
  }


  // async getClientDashboard(clientId: string) {
  //   const users = (await prisma.user.findMany({
  //     where: { clientId }, omit: {
  //       password: true,
  //     }
  //   })).filter((user) => user.role !== 'CLIENT_SUPER_ADMIN');
  //   const campaigns = await prisma.campaign.findMany({
  //     where: { clientId }, include: {
  //       emailEvents: true,
  //       groups: true,

  //     }
  //   });
  //   const contacts = await prisma.contact.findMany({
  //     where: { clientId }, include: {
  //       contactGroups: true,
  //       customFieldValues: true
  //     }
  //   });
  //   const groups = await prisma.group.findMany({
  //     where: { clientId }, include: {
  //       campaigns: true,
  //       contactGroups: true
  //     }
  //   });

 

  //   const templates = await prisma.template.findMany({ where: { clientId } });
  //   return {
  //     users,
  //     campaigns,
  //     contacts,
  //     groups,
  //     templates,
  //   };
  // }

  async getEmployeeDashboard(clientId: string) {
    // For now, the employee dashboard will be the same as the client dashboard.
    // This can be changed later to show employee-specific data.
    return this.getClientDashboard(clientId);
  }

  /**
   * Get sent campaigns with analytics for export (no raw events - those are fetched in batches separately)
   */
  async getSentCampaignsForExport(clientId: string, startDate?: Date, endDate?: Date) {
    const where: any = { clientId, sentAt: { not: null } };
    if (startDate || endDate) {
      where.sentAt = { not: null };
      if (startDate) where.sentAt.gte = startDate;
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        where.sentAt.lte = endOfDay;
      }
    }

    return prisma.campaign.findMany({
      where,
      include: { analytics: true },
      orderBy: { sentAt: 'desc' },
    });
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
