import { Client } from '../../entities/Client';
import { ClientRepository } from '../../../infrastructure/repositories/ClientRepository';
import { PlanRepository } from '../../../infrastructure/repositories/PlanRepository';
import { Prisma } from '@prisma/client';

export class ClientManagement {
    constructor(
        private clientRepository: ClientRepository,
        private planRepository: PlanRepository
    ) { }

    async create(data: Prisma.ClientCreateInput): Promise<Client> {
        // Validate that the plan exists
        if (data.plan && typeof data.plan === 'object' && 'connect' in data.plan) {
            const planId = (data.plan.connect as { id: string }).id;
            const plan = await this.planRepository.findById(planId);
            if (!plan) {
                throw new Error(`Plan not found with ID: ${planId}`);
            }
        }
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

    async findByIdWithDetails(id: string) {
        return this.clientRepository.findByIdWithDetails(id);
    }
}

