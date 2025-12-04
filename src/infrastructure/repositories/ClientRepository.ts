import { Client } from '../../core/entities/Client';
import prisma from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';

export class ClientRepository {
   async create(data: any): Promise<Client> {
    const client = await prisma.client.create({
        data: {
            name: data.name,
            isApproved: data.isApproved ?? false,
            isActive: data.isActive ?? true,
            plan: {
                connect: { id: data.planId }   
            },
            planStartDate: data.planStartDate,
            planRenewalDate: data.planRenewalDate,
            remainingMessages: data.remainingMessages
        },
        include: { plan: true }
    });

    return client;
}


    async findAll(): Promise<Client[]> {
        const clients = await prisma.client.findMany({ include: { plan: true } });
        return clients;
    }

    async findById(id: string): Promise<Client | null> {
        const client = await prisma.client.findUnique({ where: { id }, include: { plan: true } });
        return client;
    }

    async update(id: string, data: Prisma.ClientUpdateInput): Promise<Client | null> {
        const client = await prisma.client.update({ where: { id }, data, include: { plan: true } });
        return client;
    }

    async delete(id: string): Promise<Client | null> {
        const client = await prisma.client.delete({ where: { id }, include: { plan: true } });
        return client;
    }

    async findPending(): Promise<Client[]> {
        const clients = await prisma.client.findMany({ where: { isApproved: false }, include: { plan: true } });
        return clients;
    }

    async getAnalytics(clientId: string) {
        const [
            totalEmailsSent,
            campaignsScheduled,
            campaignsSent,
            client
        ] = await Promise.all([
            prisma.emailEvent.count({ where: { clientId, eventType: 'SENT' } }),
            prisma.campaign.count({ where: { clientId, status: 'APPROVED' } }),
            prisma.campaign.count({ where: { clientId, status: 'SENT' } }),
            prisma.client.findUnique({ where: { id: clientId }, select: { plan: true, remainingMessages: true } })
        ]);

        return {
            totalEmailsSent,
            campaignsScheduled,
            campaignsSent,
            planName: client?.plan?.name,
            remainingMessages: client?.remainingMessages
        };
    }
}

