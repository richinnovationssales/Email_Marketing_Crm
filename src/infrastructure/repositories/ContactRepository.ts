import { Contact } from '../../core/entities/Contact';
import prisma from '../../infrastructure/database/prisma';

export class ContactRepository {
  async create(data: Contact, clientId: string, userId: string): Promise<Contact> {
    const { customFields, ...contactData } = data;

    // Create transaction to handle both contact and custom fields
    return await prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          ...contactData,
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
          },
          customFieldValues: {
            include: { customField: true }
          }
        }
      });

      // Handle custom fields if present
      if (customFields && Object.keys(customFields).length > 0) {
        // Since we have the customFieldId provided in validated data (from validator service)
        await Promise.all(Object.entries(customFields).map(async ([customFieldId, value]) => {
          // Because our validator returns valid customFieldId -> value map
          await tx.contactCustomFieldValue.create({
            data: {
              contactId: contact.id,
              customFieldId,
              value
            }
          });
        }));
      }

      // Re-fetch to return complete object including new custom fields
      // Or just return what we have if we construct the response object manually, 
      // but re-fetch ensures consistency with what findById returns structure-wise 
      // primarily for the nested relations.
      return await tx.contact.findUniqueOrThrow({
        where: { id: contact.id },
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
          customFieldValues: {
            include: { customField: true }
          }
        }
      });
    });
  }

  async findAll(clientId: string): Promise<Contact[]> {
    return await prisma.contact.findMany({
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

  async findById(id: string, clientId: string): Promise<Contact | null> {
    return await prisma.contact.findFirst({
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
        customFieldValues: {
          include: {
            customField: true
          }
        }
      }
    });
  }

  async update(id: string, data: Partial<Contact>, clientId: string): Promise<Contact | null> {
    const { customFields, ...contactData } = data;

    // First, verify the contact belongs to the client
    const existingContact = await prisma.contact.findFirst({ where: { id, clientId } });
    if (!existingContact) {
      return null;
    }

    return await prisma.$transaction(async (tx) => {
      // Update basic contact info
      await tx.contact.update({ where: { id }, data: contactData });

      // Update custom fields if provided
      if (customFields) {
        await Promise.all(Object.entries(customFields).map(async ([customFieldId, value]) => {
          await tx.contactCustomFieldValue.upsert({
            where: {
              contactId_customFieldId: {
                contactId: id,
                customFieldId
              }
            },
            create: {
              contactId: id,
              customFieldId,
              value
            },
            update: {
              value
            }
          });
        }));
      }

      return await tx.contact.findUnique({
        where: { id },
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
          customFieldValues: {
            include: { customField: true }
          }
        }
      });
    });
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
