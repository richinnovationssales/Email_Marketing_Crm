import { z } from 'zod';
import { CustomFieldType } from '@prisma/client';

export const createCustomFieldSchema = z.object({
    clientId: z.string().cuid(),
    name: z.string().min(1, 'Field name is required'),
    fieldKey: z.string().min(1, 'Field key is required').regex(/^[a-z_]+$/, 'Field key must be lowercase with underscores'),
    type: z.nativeEnum(CustomFieldType),
    isRequired: z.boolean().optional().default(false),
    defaultValue: z.string().optional(),
    options: z.string().optional(), // JSON string for SELECT/MULTISELECT
    validationRegex: z.string().optional(),
    helpText: z.string().optional(),
    displayOrder: z.number().int().min(0).optional().default(0),
});

export const updateCustomFieldSchema = z.object({
    name: z.string().min(1).optional(),
    isRequired: z.boolean().optional(),
    defaultValue: z.string().optional(),
    options: z.string().optional(),
    validationRegex: z.string().optional(),
    helpText: z.string().optional(),
    displayOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
});

export const customFieldRequestSchema = z.object({
    name: z.string().min(1, 'Field name is required'),
    fieldKey: z.string().min(1, 'Field key is required').regex(/^[a-z_]+$/, 'Field key must be lowercase with underscores'),
    type: z.nativeEnum(CustomFieldType),
    isRequired: z.boolean().optional().default(false),
    defaultValue: z.string().optional(),
    options: z.string().optional(),
    validationRegex: z.string().optional(),
    helpText: z.string().optional(),
});

export const reviewCustomFieldRequestSchema = z.object({
    approved: z.boolean(),
    rejectionReason: z.string().optional(),
});
