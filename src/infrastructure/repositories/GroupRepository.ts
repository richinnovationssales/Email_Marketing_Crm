import { Group } from '../../core/entities/Group';
import prisma from '../../infrastructure/database/prisma';

export class GroupRepository {
  async create(data: Group, clientId: string, userId: string): Promise<Group> {
    return await prisma.group.create({
      data: {
        ...data,
        clientId,
        createdById: userId
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });
  }

  async findAll(clientId: string): Promise<Group[]> {
    return await prisma.group.findMany({
      where: { clientId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });
  }

  async findById(id: string, clientId: string): Promise<any> {
    return await prisma.group.findFirst({
      where: { id, clientId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true
          }
        },
        contactGroups: {
          include: {
            contact: {
              include: {
                customFieldValues: {
                  include: {
                    customField: true
                  }
                }
              }
            }
          }
        }
      }
    });
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
