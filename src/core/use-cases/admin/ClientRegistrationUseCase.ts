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
    customFields?: CustomFieldDefinition[];
}

export class ClientRegistrationUseCase {
    constructor(
        private clientRepository: ClientRepository,
        private userRepository: UserRepository,
        private customFieldRepository: CustomFieldRepository
    ) { }

    async execute(data: ClientRegistrationData): Promise<Client> {
        const existingClient = await this.clientRepository.findByName(data.name);
        if (existingClient) {
            throw new Error('Client with this name already exists');
        }

        const existingUser = await this.userRepository.findByEmail(data.adminEmail);
        if (existingUser) {
            throw new Error('User with this email already exists');
        }

        const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

        const plan = await prisma.plan.findUnique({ where: { id: data.planId } });
        if (!plan) {
            throw new Error(`Plan not found with ID: ${data.planId}`);
        }

        const customFieldsToCreate = data.customFields && data.customFields.length > 0
            ? data.customFields
            : getDefaultCustomFields();

        const result = await prisma.$transaction(async (tx) => {
            const client = await tx.client.create({
                data: {
                    name: data.name,
                    planId: data.planId,
                    isApproved: true,
                    isActive: true
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
