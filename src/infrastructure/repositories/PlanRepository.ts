import { Plan } from '../../core/entities/Plan';
import prisma from '../../infrastructure/database/prisma';

export class PlanRepository {
  async create(data: Plan): Promise<Plan> {
    return await prisma.plan.create({ data });
  }

  async findAll(): Promise<Plan[]> {
    return await prisma.plan.findMany();
  }

  async findById(id: string): Promise<Plan | null> {
    return await prisma.plan.findUnique({ where: { id } });
  }

  async update(id: string, data: Partial<Plan>): Promise<Plan | null> {
    return await prisma.plan.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Plan | null> {
    return await prisma.plan.delete({ where: { id } });
  }

  async countClientsByPlanId(planId: string): Promise<number> {
    return await prisma.client.count({ where: { planId } });
  }

  async findClientsByPlanId(planId: string) {
    return await prisma.client.findMany({
      where: { planId },
      include: { plan: true }
    });
  }
}
