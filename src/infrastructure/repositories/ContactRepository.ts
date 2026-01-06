// src/infrastructure/repositories/ContactRepository.ts
import { Contact } from "../../core/entities/Contact";
import prisma from "../../infrastructure/database/prisma";

type CreateContactInput = {
  email: string;
  customFields?: Record<string, any>;
};

export class ContactRepository {
  async create(
    data: CreateContactInput,
    clientId: string,
    userId: string,
    groupId?: string
  ): Promise<Contact> {
    // Create transaction to handle both contact and custom fields
    return await prisma.$transaction(async (tx) => {
      // Verify group ownership if groupId is provided
      if (groupId) {
        const group = await tx.group.findFirst({
          where: { id: groupId, clientId },
        });
        if (!group) {
          throw new Error("Group not found or does not belong to this client");
        }
      }

      console.log("CONTACT CREATE DATA:", data);

      // Step 1: Create Contact (nameValueId initially null)
      const contact = await tx.contact.create({
        data: {
          email: data.email,
          clientId,
          createdById: userId,
          nameValueId: null,
        },
      });

      let identityValueId: string | null = null;

      const { customFields } = data;

      // Step 2: Handle custom fields
      if (customFields && Object.keys(customFields).length > 0) {
        // Fetch custom fields to identify which one is the name field
        const clientCustomFields = await tx.customField.findMany({
          where: { clientId, isActive: true },
        });

        // Loop through provided values and create records
        await Promise.all(
          Object.entries(customFields).map(async ([customFieldId, value]) => {
            const fieldDef = clientCustomFields.find(
              (f) => f.id === customFieldId
            );

            const createdValue = await tx.contactCustomFieldValue.create({
              data: {
                contactId: contact.id,
                customFieldId,
                value,
              },
            });

            // Check if this is the identity field
            if (fieldDef?.isNameField) {
              identityValueId = createdValue.id;
            }
          })
        );
      }

      // Step 3: Link identity field if found
      if (identityValueId) {
        await tx.contact.update({
          where: { id: contact.id },
          data: { nameValueId: identityValueId },
        });
      }

      // Assign to group if groupId is provided
      if (groupId) {
        await tx.contactGroup.create({
          data: {
            contactId: contact.id,
            groupId,
          },
        });
      }

      // Re-fetch to return complete object including new custom fields
      return await tx.contact.findUniqueOrThrow({
        where: { id: contact.id },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          customFieldValues: {
            include: { customField: true },
          },
          nameValue: true, // Include the identity value relation
        },
      });
    });
  }

  async findAll(
    clientId: string,
    cursor?: string,
    limit: number = 20
  ): Promise<{ data: Contact[]; nextCursor: string | null }> {
    const contacts = await prisma.contact.findMany({
      where: { clientId },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor itself
      }),
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        customFieldValues: {
          select: {
            id: true,
            customFieldId: true,
            value: true,
            contactId: true,
          },
        },
      },
    });

    const hasMore = contacts.length > limit;
    const data = hasMore ? contacts.slice(0, limit) : contacts;
    const nextCursor = hasMore ? data[data.length - 1].id : null;

    return { data, nextCursor };
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
            updatedAt: true,
          },
        },
        customFieldValues: {
          include: {
            customField: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: Partial<Contact>,
    clientId: string
  ): Promise<Contact | null> {
    const { customFields, ...contactData } = data;

    // First, verify the contact belongs to the client
    const existingContact = await prisma.contact.findFirst({
      where: { id, clientId },
    });
    if (!existingContact) {
      return null;
    }

    return await prisma.$transaction(async (tx) => {
      // Update basic contact info
      await tx.contact.update({ where: { id }, data: contactData });

      // Update custom fields if provided
      if (customFields) {
        await Promise.all(
          Object.entries(customFields).map(async ([customFieldId, value]) => {
            await tx.contactCustomFieldValue.upsert({
              where: {
                contactId_customFieldId: {
                  contactId: id,
                  customFieldId,
                },
              },
              create: {
                contactId: id,
                customFieldId,
                value,
              },
              update: {
                value,
              },
            });
          })
        );
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
              updatedAt: true,
            },
          },
          customFieldValues: {
            include: { customField: true },
          },
        },
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
