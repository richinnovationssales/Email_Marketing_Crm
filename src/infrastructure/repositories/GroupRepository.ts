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

  async findAll(clientId: string): Promise<any[]> {
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
        },
        _count: {
          select: { contactGroups: true }
        }
      }
    });
  }

  async findContactsByGroupId(
    groupId: string,
    clientId: string,
    limit: number = 20,
    cursor?: string
  ): Promise<{ contacts: any[]; nextCursor: string | null }> {
    const group = await prisma.group.findFirst({
      where: { id: groupId, clientId },
      select: { id: true }
    });
    if (!group) return { contacts: [], nextCursor: null };

    const contactGroups = await prisma.contactGroup.findMany({
      where: { groupId },
      take: limit + 1,
      orderBy: { contactId: 'asc' },
      ...(cursor ? { cursor: { contactId_groupId: { contactId: cursor, groupId } }, skip: 1 } : {}),
      include: {
        contact: {
          include: {
            customFieldValues: {
              include: { customField: true }
            }
          }
        }
      }
    });

    const hasMore = contactGroups.length > limit;
    const results = hasMore ? contactGroups.slice(0, limit) : contactGroups;
    const nextCursor = hasMore ? results[results.length - 1].contactId : null;

    return {
      contacts: results.map(cg => cg.contact),
      nextCursor
    };
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
          take: 30,
          orderBy: { assignedAt: 'desc' },
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
        },
        _count: {
          select: { contactGroups: true }
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
