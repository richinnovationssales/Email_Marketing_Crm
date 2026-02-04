// src/presentation/validations/clientValidationSchemas.ts
import { z } from 'zod';
import { CustomFieldType } from '@prisma/client';

export const customFieldDefinitionSchema = z.object({
    name: z.string().min(1, 'Field name is required'),
    fieldKey: z.string()
        .min(1, 'Field key is required')
        .regex(/^[a-z][a-zA-Z0-9_]*$/, 'Field key must start with lowercase letter and contain only alphanumeric characters and underscores'),
    type: z.nativeEnum(CustomFieldType),
    isRequired: z.boolean().default(false),
    defaultValue: z.string().optional(),
    options: z.string().optional(), 
    validationRegex: z.string().optional(),
    helpText: z.string().optional(),
    displayOrder: z.number().int().min(0).default(0)
});

export const clientRegistrationSchema = z.object({
    name: z.string().min(1, 'Client name is required').max(255),
    planId: z.string().min(1, 'Plan ID is required'),
    adminEmail: z.string().email('Valid email is required'),
    adminPassword: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    // registrationEmail defaults to adminEmail if not provided
    registrationEmail: z.string().optional(),
    mailgunDomain: z.string().optional(),
    mailgunFromEmail: z.string().email('mailgunFromEmail must be a valid email address').optional(),
    mailgunFromName: z.string().optional(),
    customFields: z.array(customFieldDefinitionSchema).optional()
}).refine((data) => {
    // Ensure mailgunFromEmail domain matches mailgunDomain to prevent "on behalf of" in Outlook
    if (data.mailgunDomain && data.mailgunFromEmail) {
        const fromDomain = data.mailgunFromEmail.split('@')[1];
        return fromDomain === data.mailgunDomain;
    }
    return true;
}, {
    message: 'mailgunFromEmail domain must match mailgunDomain to prevent "on behalf of" display in email clients (e.g., use info@mailme.smartsolutionsme.com if mailgunDomain is mailme.smartsolutionsme.com)',
    path: ['mailgunFromEmail'],
});

export const clientSelfRegistrationSchema = clientRegistrationSchema;

export type ClientRegistrationInput = z.infer<typeof clientRegistrationSchema>;
export type ClientSelfRegistrationInput = z.infer<typeof clientSelfRegistrationSchema>;
export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionSchema>;
