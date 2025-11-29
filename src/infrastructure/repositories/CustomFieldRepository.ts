import { CustomField, ContactCustomFieldValue, CustomFieldType } from '../../core/entities/CustomField';
import prisma from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';

export class CustomFieldRepository {
    async createCustomField(data: Prisma.CustomFieldCreateInput): Promise<CustomField> {
        const created = await prisma.customField.create({ data });
        return {
            ...created,
            type: created.type as CustomFieldType, 
        };
    }

    async findAllByClient(clientId: string, includeInactive: boolean = false): Promise<CustomField[]> {
        const where: Prisma.CustomFieldWhereInput = { clientId };
        if (!includeInactive) {
            where.isActive = true;
        }
        const results = await prisma.customField.findMany({
            where,
            orderBy: { displayOrder: 'asc' },
        });
        return results.map(field => ({
            ...field,
            type: field.type as CustomFieldType, 
        }));
    }

    async findById(id: string): Promise<CustomField | null> {
        const result = await prisma.customField.findUnique({ where: { id } });
        if (!result) return null;
        return {
            ...result,
            type: result.type as CustomFieldType, 
        } as CustomField;
    }

    async findByFieldKey(clientId: string, fieldKey: string): Promise<CustomField | null> {
        const result = await prisma.customField.findUnique({
            where: { clientId_fieldKey: { clientId, fieldKey } },
        });
        if (!result) return null;
        return {
            ...result,
            type: result.type as CustomFieldType, 
        } as CustomField;
    }

    async updateCustomField(id: string, data: Prisma.CustomFieldUpdateInput): Promise<CustomField> {
        const updated = await prisma.customField.update({ where: { id }, data });
        return {
            ...updated,
            type: updated.type as CustomFieldType, 
        };
    }

    async softDeleteCustomField(id: string): Promise<CustomField> {
        const updated = await prisma.customField.update({
            where: { id },
            data: { isActive: false },
        });
        return {
            ...updated,
            type: updated.type as CustomFieldType, // Cast or map to your domain enum
        };
    }

    async deleteCustomField(id: string): Promise<CustomField> {
        const deleted = await prisma.customField.delete({ where: { id } });
        return {
            ...deleted,
            type: deleted.type as CustomFieldType, 
        };
    }

    // Contact Custom Field Value operations
    async setContactFieldValue(
        contactId: string,
        customFieldId: string,
        value: string
    ): Promise<ContactCustomFieldValue> {
        return await prisma.contactCustomFieldValue.upsert({
            where: {
                contactId_customFieldId: { contactId, customFieldId },
            },
            create: { contactId, customFieldId, value },
            update: { value },
        });
    }

    async getContactFieldValues(contactId: string): Promise<ContactCustomFieldValue[]> {
        return await prisma.contactCustomFieldValue.findMany({
            where: { contactId },
            include: { customField: true },
        });
    }

    async getContactFieldValue(
        contactId: string,
        customFieldId: string
    ): Promise<ContactCustomFieldValue | null> {
        return await prisma.contactCustomFieldValue.findUnique({
            where: {
                contactId_customFieldId: { contactId, customFieldId },
            },
            include: { customField: true },
        });
    }

    async deleteContactFieldValue(contactId: string, customFieldId: string): Promise<ContactCustomFieldValue> {
        return await prisma.contactCustomFieldValue.delete({
            where: {
                contactId_customFieldId: { contactId, customFieldId },
            },
        });
    }

    async deleteAllContactFieldValues(contactId: string): Promise<Prisma.BatchPayload> {
        return await prisma.contactCustomFieldValue.deleteMany({
            where: { contactId },
        });
    }
}
