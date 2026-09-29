import { Prisma } from '@prisma/client';
import prisma from '../../infrastructure/database/prisma';
import { Greeting } from '../../core/entities/Greeting';

export class GreetingRepository {
  async create(data: Prisma.GreetingCreateInput): Promise<Greeting> {
    return await prisma.greeting.create({ data });
  }

  async findAll(includeInactive: boolean = false): Promise<Greeting[]> {
    const where: Prisma.GreetingWhereInput = {};
    if (!includeInactive) {
      where.isActive = true;
    }
    return await prisma.greeting.findMany({
      where,
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string): Promise<Greeting | null> {
    return await prisma.greeting.findUnique({ where: { id } });
  }

  async update(id: string, data: Prisma.GreetingUpdateInput): Promise<Greeting | null> {
    return await prisma.greeting.update({ where: { id }, data });
  }

  async delete(id: string): Promise<Greeting | null> {
    return await prisma.greeting.delete({ where: { id } });
  }
}
