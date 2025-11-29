import { Contact } from '../../core/entities/Contact';
import prisma from '../../infrastructure/database/prisma';

export class ContactRepository {
  async create(data: Contact, clientId: string): Promise<Contact> {
    return await prisma.contact.create({ data: { ...data, clientId } });
  }

  async findAll(clientId: string): Promise<Contact[]> {
    return await prisma.contact.findMany({ where: { clientId } });
  }

  async findById(id: string, clientId: string): Promise<Contact | null> {
    return await prisma.contact.findFirst({ where: { id, clientId } });
  }

  async update(id: string, data: Partial<Contact>, clientId: string): Promise<Contact | null> {
    // First, verify the contact belongs to the client
    const contact = await prisma.contact.findFirst({ where: { id, clientId } });
    if (!contact) {
      return null;
    }
    return await prisma.contact.update({ where: { id }, data });
  }

  async delete(id: string, clientId: string): Promise<Contact | null> {
    // First, verify the contact belongs to the client
    const contact = await prisma.contact.findFirst({ where: { id, clientId } });
    if (!contact) {
      return null;
    }
    return await prisma.contact.delete({ where: { id } });
  }
}
