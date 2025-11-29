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

    return await prisma.contactGroup.findMany({
      where: {
        groupId,
      },
      include: {
        contact: true,
      },
    });
  }
}
