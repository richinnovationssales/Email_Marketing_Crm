export enum CustomFieldType {
    TEXT = 'TEXT',
    NUMBER = 'NUMBER',
    EMAIL = 'EMAIL',
    PHONE = 'PHONE',
    DATE = 'DATE',
    BOOLEAN = 'BOOLEAN',
    URL = 'URL',
    TEXTAREA = 'TEXTAREA',
    SELECT = 'SELECT',
    MULTISELECT = 'MULTISELECT',
}

export interface CustomField {
    id: string;
    clientId: string;
    name: string;
    fieldKey: string;
    type: CustomFieldType;
    isRequired: boolean;
    defaultValue?: string | null;
    options?: string | null; // JSON string for SELECT/MULTISELECT
    validationRegex?: string | null;
    helpText?: string | null;
    displayOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface ContactCustomFieldValue {
    id: string;
    contactId: string;
    customFieldId: string;
    value: string;
    createdAt: Date;
    updatedAt: Date;
}
