import { Client } from '../../core/entities/Client';
import prisma from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';

export class ClientRepository {
    async create(data: Prisma.ClientCreateInput): Promise<Client> {
        const client = await prisma.client.create({ data, include: { plan: true } });
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
}

