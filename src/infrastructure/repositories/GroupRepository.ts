import { Group } from '../../core/entities/Group';
import prisma from '../../infrastructure/database/prisma';

export class GroupRepository {
  async create(data: Group, clientId: string): Promise<Group> {
    return await prisma.group.create({ data: { ...data, clientId } });
  }

  async findAll(clientId: string): Promise<Group[]> {
    return await prisma.group.findMany({ where: { clientId } });
  }

  async findById(id: string, clientId: string): Promise<Group | null> {
    return await prisma.group.findFirst({ where: { id, clientId } });
  }

  async update(id: string, data: Partial<Group>, clientId: string): Promise<Group | null> {
    // First, verify the group belongs to the client
    const group = await prisma.group.findFirst({ where: { id, clientId } });
    if (!group) {
      return null;
    }
    return await prisma.group.update({ where: { id }, data });
  }

  async delete(id: string, clientId: string): Promise<Group | null> {
    // First, verify the group belongs to the client
    const group = await prisma.group.findFirst({ where: { id, clientId } });
    if (!group) {
      return null;
    }
    return await prisma.group.delete({ where: { id } });
  }
}
