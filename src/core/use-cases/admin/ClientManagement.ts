import { Client } from '../../entities/Client';
import { ClientRepository } from '../../../infrastructure/repositories/ClientRepository';
import { Prisma } from '@prisma/client';

export class ClientManagement {
    constructor(private clientRepository: ClientRepository) { }

    async create(data: Prisma.ClientCreateInput): Promise<Client> {
        // Add any business logic validation here if needed
        return this.clientRepository.create(data);
    }

    async findAll(): Promise<Client[]> {
        return this.clientRepository.findAll();
    }

    async findById(id: string): Promise<Client | null> {
        return this.clientRepository.findById(id);
    }

    async update(id: string, data: Prisma.ClientUpdateInput): Promise<Client | null> {
        return this.clientRepository.update(id, data);
    }

    async delete(id: string): Promise<Client | null> {
        return this.clientRepository.delete(id);
    }

    async findPending(): Promise<Client[]> {
        return this.clientRepository.findPending();
    }

    async getAnalytics(clientId: string) {
        return this.clientRepository.getAnalytics(clientId);
    }
}
