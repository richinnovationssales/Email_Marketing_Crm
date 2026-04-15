import { ContactGroup } from '../../core/entities/ContactGroup';
import prisma from '../../infrastructure/database/prisma';

export class ContactGroupRepository {
  async assignContactToGroup(contactId: string, groupId: string, clientId: string): Promise<ContactGroup> {
    // Verify that both the contact and group belong to the client
    const contact = await prisma.contact.findFirst({ where: { id: contactId, clientId } });
    const group = await prisma.group.findFirst({ where: { id: groupId, clientId } });

    if (!contact || !group) {
      throw new Error('Contact or Group not found in this client');
    }

    return await prisma.contactGroup.create({
      data: {
        contactId,
        groupId,
      },
      include: {
        contact: true,
      },
    });
  }

  async removeContactFromGroup(contactId: string, groupId: string, clientId: string): Promise<void> {
    // Verify that both the contact and group belong to the client
    const contact = await prisma.contact.findFirst({ where: { id: contactId, clientId } });
    const group = await prisma.group.findFirst({ where: { id: groupId, clientId } });

    if (!contact || !group) {
      throw new Error('Contact or Group not found in this client');
    }

    await prisma.contactGroup.delete({
      where: {
        contactId_groupId: {
          contactId,
          groupId,
        },
      },
    });
  }

  async getContactsInGroup(groupId: string, clientId: string): Promise<ContactGroup[]> {
    // Verify that the group belongs to the client
    const group = await prisma.group.findFirst({ where: { id: groupId, clientId } });

    if (!group) {
      throw new Error('Group not found in this client');
    }

    // Fetch in batches to avoid loading 40k+ records into memory at once
    const BATCH_SIZE = 5000;
    const allContacts: ContactGroup[] = [];
    let cursor: string | undefined;

    while (true) {
      const batch: any[] = await prisma.contactGroup.findMany({
        where: { groupId },
        take: BATCH_SIZE,
        ...(cursor
          ? { cursor: { contactId_groupId: { contactId: cursor, groupId } }, skip: 1 }
          : {}),
        orderBy: { contactId: 'asc' },
        include: {
          contact: {
            include: {
              customFieldValues: {
                where: { customField: { isNameField: true } },
                include: { customField: { select: { fieldKey: true } } },
              },
            },
          },
        },
      });

      if (batch.length === 0) break;
      allContacts.push(...batch);
      cursor = batch[batch.length - 1].contactId;
      if (batch.length < BATCH_SIZE) break;
    }

    return allContacts;
  }

  async assignMultipleContactsToGroup(contactIds: string[], groupId: string, clientId: string): Promise<{ groupId: string; assignedContactIds: string[] }> {
    // Verify group belongs to client
    const group = await prisma.group.findFirst({ where: { id: groupId, clientId } });
    if (!group) throw new Error('Group not found in this client');

    // 1. Filter valid contacts belonging to client
    // We only care if they exist and belong to the client
    const validContacts = await prisma.contact.findMany({
      where: {
        clientId,
        id: { in: contactIds }
      },
      select: { id: true }
    });
    const validContactIds = validContacts.map(c => c.id);

    if (validContactIds.length === 0) {
      return { groupId, assignedContactIds: [] };
    }

    // 2. Find existing relations to avoid unique constraint violations
    const existing = await prisma.contactGroup.findMany({
      where: {
        groupId,
        contactId: { in: validContactIds }
      },
      select: { contactId: true }
    });
    const existingIds = new Set(existing.map(cg => cg.contactId));

    // 3. Identify new ones
    const toAdd = validContactIds.filter(id => !existingIds.has(id));

    if (toAdd.length > 0) {
      await prisma.contactGroup.createMany({
        data: toAdd.map(contactId => ({ contactId, groupId })),
        skipDuplicates: true
      });
    }

    return { groupId, assignedContactIds: toAdd };
  }

  async removeMultipleContactsFromGroup(contactIds: string[], groupId: string, clientId: string): Promise<{ groupId: string; removedContactIds: string[] }> {
    // Verify group belongs to client
    const group = await prisma.group.findFirst({ where: { id: groupId, clientId } });
    if (!group) throw new Error('Group not found in this client');

    // 1. Identify which need to be removed (must exist in group)
    // We assume contactIds are valid strings. We check persistence in DB.
    // Also ensures we don't try to delete things that aren't there.
    const present = await prisma.contactGroup.findMany({
      where: {
        groupId,
        contactId: { in: contactIds }
      },
      select: { contactId: true }
    });
    const presentIds = present.map(p => p.contactId);

    // 2. Delete them
    if (presentIds.length > 0) {
      await prisma.contactGroup.deleteMany({
        where: {
          groupId,
          contactId: { in: presentIds }
        }
      });
    }

    return { groupId, removedContactIds: presentIds };
  }
}
