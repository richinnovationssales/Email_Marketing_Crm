import { CustomFieldRepository } from '../../infrastructure/repositories/CustomFieldRepository';
import { CustomFieldType } from '../entities/CustomField';

export class CustomFieldValidator {
    private customFieldRepository: CustomFieldRepository;

    constructor() {
        this.customFieldRepository = new CustomFieldRepository();
    }

    async validate(clientId: string, data: Record<string, any>, isUpdate: boolean = false): Promise<Record<string, any>> {
        const customFields = await this.customFieldRepository.findAllByClient(clientId);
        const validatedFields: Record<string, any> = {};

        for (const field of customFields) {
            const value = data[field.fieldKey];

            // Check required fields
            if (field.isRequired && !isUpdate && (value === undefined || value === null || value === '')) {
                throw new Error(`Missing required custom field: ${field.name} (${field.fieldKey})`);
            }

            // If value is provided (or required and missing check passed - meaning it's present), validate type
            if (value !== undefined && value !== null && value !== '') {
                this.validateType(field.type, value, field.name);

                // Validate options for SELECT/MULTISELECT
                if ((field.type === CustomFieldType.SELECT || field.type === CustomFieldType.MULTISELECT) && field.options) {
                    const options = JSON.parse(field.options) as string[];
                    if (Array.isArray(value)) { // For multiselect if passed as array
                        value.forEach(v => {
                            if (!options.includes(v)) throw new Error(`Invalid option '${v}' for field ${field.name}`);
                        });
                    } else {
                        if (!options.includes(value)) throw new Error(`Invalid option '${value}' for field ${field.name}`);
                    }
                }

                // Validate regex if present
                if (field.validationRegex) {
                    const regex = new RegExp(field.validationRegex);
                    if (!regex.test(String(value))) {
                        throw new Error(`Value for field ${field.name} does not match required pattern`);
                    }
                }

                validatedFields[field.id] = String(value); // Store by ID for DB
            }
        }

        // Check for unknown fields? For now, we ignore extra fields in data to be safe/flexible.

        return validatedFields;
    }

    private validateType(type: CustomFieldType, value: any, fieldName: string): void {
        switch (type) {
            case CustomFieldType.NUMBER:
                if (isNaN(Number(value))) throw new Error(`Invalid number for field ${fieldName}`);
                break;
            case CustomFieldType.DATE:
                if (isNaN(Date.parse(value))) throw new Error(`Invalid date for field ${fieldName}`);
                break;
            case CustomFieldType.BOOLEAN:
                if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
                    throw new Error(`Invalid boolean for field ${fieldName}`);
                }
                break;
            case CustomFieldType.EMAIL:
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) throw new Error(`Invalid email for field ${fieldName}`);
                break;
            case CustomFieldType.URL:
                try {
                    new URL(value);
                } catch {
                    throw new Error(`Invalid URL for field ${fieldName}`);
                }
                break;
            // TEXT, TEXTAREA, PHONE, etc. can be treated as string or added specific checks
        }
    }
}
