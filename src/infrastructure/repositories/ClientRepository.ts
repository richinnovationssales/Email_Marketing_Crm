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

    async findByName(name: string): Promise<Client | null> {
        const client = await prisma.client.findFirst({ where: { name }, include: { plan: true } });
        return client;
    }

    async findByRegistrationEmail(email: string): Promise<Client | null> {
        const client = await prisma.client.findFirst({ where: { registrationEmail: email }, include: { plan: true } });
        return client;
    }

    async findByMailgunDomain(domain: string): Promise<Client | null> {
        const client = await prisma.client.findFirst({ where: { mailgunDomain: domain }, include: { plan: true } });
        return client;
    }

    async findByMailgunFromEmail(email: string): Promise<Client | null> {
        const client = await prisma.client.findFirst({ where: { mailgunFromEmail: email }, include: { plan: true } });
        return client;
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

    async findByIdWithDetails(id: string) {
        const [client, counts] = await Promise.all([
            prisma.client.findUnique({
                where: { id },
                include: {
                    plan: true,
                    users: {
                        take: 10,
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            email: true,
                            role: true,
                            clientId: true,
                            createdAt: true,
                            updatedAt: true
                        }
                    },
                    contacts: {
                        take: 10,
                        orderBy: { createdAt: 'desc' }
                    },
                    groups: {
                        take: 10,
                        orderBy: { createdAt: 'desc' }
                    },
                    customFields: {
                        orderBy: { displayOrder: 'asc' }
                    }
                }
            }),
            prisma.$transaction([
                prisma.user.count({ where: { clientId: id } }),
                prisma.contact.count({ where: { clientId: id } }),
                prisma.group.count({ where: { clientId: id } }),
                prisma.customField.count({ where: { clientId: id } })
            ])
        ]);

        if (!client) return null;

        return {
            ...client,
            usersCount: counts[0],
            contactsCount: counts[1],
            groupsCount: counts[2],
            customFieldsCount: counts[3]
        };
    }
}


