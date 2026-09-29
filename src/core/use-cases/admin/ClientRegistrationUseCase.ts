import { Client } from '../../entities/Client';
import { ClientRepository } from '../../../infrastructure/repositories/ClientRepository';
import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
import { CustomFieldRepository } from '../../../infrastructure/repositories/CustomFieldRepository';
import { getDefaultCustomFields, CustomFieldDefinition } from '../../utils/defaultCustomFields';
import * as bcrypt from 'bcryptjs';
import prisma from '../../../infrastructure/database/prisma';
import { UserRole } from '@prisma/client';

export interface ClientRegistrationData {
    name: string;
    planId: string;
    adminEmail: string;
    adminPassword: string;
    registrationEmail?: string; // Default sender email (falls back to adminEmail)
    mailgunDomain?: string;     // Client's verified Mailgun domain
    mailgunFromEmail?: string;  // Override sender email
    mailgunFromName?: string;   // Sender display name
    customFields?: CustomFieldDefinition[];
}

export class ClientRegistrationUseCase {
    constructor(
        private clientRepository: ClientRepository,
        private userRepository: UserRepository,
        private customFieldRepository: CustomFieldRepository
    ) { }

    async execute(data: ClientRegistrationData): Promise<Client> {
        // Run all uniqueness checks in parallel for efficiency
        const resolvedRegistrationEmail = data.registrationEmail || data.adminEmail;

        const [existingClient, existingUser, existingByRegEmail, existingByDomain, existingByFromEmail, plan] = await Promise.all([
            this.clientRepository.findByName(data.name),
            this.userRepository.findByEmail(data.adminEmail),
            this.clientRepository.findByRegistrationEmail(resolvedRegistrationEmail),
            data.mailgunDomain ? this.clientRepository.findByMailgunDomain(data.mailgunDomain) : null,
            data.mailgunFromEmail ? this.clientRepository.findByMailgunFromEmail(data.mailgunFromEmail) : null,
            prisma.plan.findUnique({ where: { id: data.planId } })
        ]);

        if (existingClient) {
            throw new Error('Client with this name already exists');
        }
        if (existingUser) {
            throw new Error('User with this email already exists');
        }
        if (existingByRegEmail) {
            throw new Error('A client with this registration email already exists');
        }
        if (existingByDomain) {
            throw new Error('A client with this mailgun domain already exists');
        }
        if (existingByFromEmail) {
            throw new Error('A client with this from email already exists');
        }
        if (!plan) {
            throw new Error(`Plan not found with ID: ${data.planId}`);
        }

        const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

        const customFieldsToCreate = data.customFields && data.customFields.length > 0
            ? data.customFields
            : getDefaultCustomFields();

        const result = await prisma.$transaction(async (tx) => {
            const client = await tx.client.create({
                data: {
                    name: data.name,
                    planId: data.planId,
                    registrationEmail: data.registrationEmail || data.adminEmail, // Default to adminEmail
                    mailgunDomain: data.mailgunDomain,
                    mailgunFromEmail: data.mailgunFromEmail,
                    mailgunFromName: data.mailgunFromName,
                    isApproved: true,
                    isActive: true,
                    remainingMessages: plan.emailLimit // Initialize with plan limit
                },
                include: { plan: true }
            });

            await tx.user.create({
                data: {
                    email: data.adminEmail,
                    password: hashedPassword,
                    role: UserRole.CLIENT_SUPER_ADMIN,
                    clientId: client.id
                }
            });

            // Create custom fields for the client
            for (const fieldDef of customFieldsToCreate) {
                await tx.customField.create({
                    data: {
                        clientId: client.id,
                        name: fieldDef.name,
                        fieldKey: fieldDef.fieldKey,
                        type: fieldDef.type,
                        isRequired: fieldDef.isRequired,
                        defaultValue: fieldDef.defaultValue,
                        options: fieldDef.options,
                        validationRegex: fieldDef.validationRegex,
                        helpText: fieldDef.helpText,
                        displayOrder: fieldDef.displayOrder,
                        isActive: true,
                        isNameField: fieldDef.isNameField || false
                    }
                });
            }

            return client;
        });

        return result;
    }
}
