import { PlanRepository } from '../../../infrastructure/repositories/PlanRepository';
import { Plan } from '../../entities/Plan';

export class PlanManagement {
  constructor(private planRepository: PlanRepository) {}

  async create(data: Plan): Promise<Plan> {
    return this.planRepository.create(data);
  }

  async findAll(): Promise<Plan[]> {
    return this.planRepository.findAll();
  }

  async findById(id: string): Promise<Plan | null> {
    return this.planRepository.findById(id);
  }

  async update(id: string, data: Partial<Plan>): Promise<Plan | null> {
    return this.planRepository.update(id, data);
  }

  async delete(id: string): Promise<Plan | null> {
    return this.planRepository.delete(id);
  }
}
