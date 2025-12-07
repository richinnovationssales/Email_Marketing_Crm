import { CustomFieldType } from '@prisma/client';

export interface CustomFieldDefinition {
    name: string;
    fieldKey: string;
    type: CustomFieldType;
    isRequired: boolean;
    defaultValue?: string;
    options?: string;
    validationRegex?: string;
    helpText?: string;
    displayOrder: number;
}


export const getDefaultCustomFields = (): CustomFieldDefinition[] => {
    return [
        {
            name: 'First Name',
            fieldKey: 'firstName',
            type: CustomFieldType.TEXT,
            isRequired: true,
            helpText: 'Contact\'s first name',
            displayOrder: 1
        },
        {
            name: 'Middle Name',
            fieldKey: 'middleName',
            type: CustomFieldType.TEXT,
            isRequired: false,
            helpText: 'Contact\'s middle name',
            displayOrder: 2
        },
        {
            name: 'Last Name',
            fieldKey: 'lastName',
            type: CustomFieldType.TEXT,
            isRequired: true,
            helpText: 'Contact\'s last name',
            displayOrder: 3
        },
        {
            name: 'Date of Birth',
            fieldKey: 'dateOfBirth',
            type: CustomFieldType.DATE,
            isRequired: false,
            helpText: 'Contact\'s date of birth',
            displayOrder: 4
        },
        {
            name: 'Gender',
            fieldKey: 'gender',
            type: CustomFieldType.SELECT,
            isRequired: false,
            options: JSON.stringify(['Male', 'Female', 'Other', 'Prefer not to say']),
            helpText: 'Contact\'s gender',
            displayOrder: 5
        },
        {
            name: 'Religion',
            fieldKey: 'religion',
            type: CustomFieldType.TEXT,
            isRequired: false,
            helpText: 'Contact\'s religion',
            displayOrder: 6
        },

        {
            name: 'Email',
            fieldKey: 'email',
            type: CustomFieldType.EMAIL,
            isRequired: true,
            validationRegex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
            helpText: 'Contact\'s email address',
            displayOrder: 7
        },
        {
            name: 'Phone',
            fieldKey: 'phone',
            type: CustomFieldType.PHONE,
            isRequired: false,
            helpText: 'Contact\'s primary phone number',
            displayOrder: 8
        },
        {
            name: 'Work Number',
            fieldKey: 'workNumber',
            type: CustomFieldType.PHONE,
            isRequired: false,
            helpText: 'Contact\'s work phone number',
            displayOrder: 9
        },
        {
            name: 'Home Number',
            fieldKey: 'homeNumber',
            type: CustomFieldType.PHONE,
            isRequired: false,
            helpText: 'Contact\'s home phone number',
            displayOrder: 10
        },

        {
            name: 'Address',
            fieldKey: 'address',
            type: CustomFieldType.TEXTAREA,
            isRequired: false,
            helpText: 'Contact\'s street address',
            displayOrder: 11
        },
        {
            name: 'City',
            fieldKey: 'city',
            type: CustomFieldType.TEXT,
            isRequired: false,
            helpText: 'Contact\'s city',
            displayOrder: 12
        },
        {
            name: 'State/Province',
            fieldKey: 'stateProvince',
            type: CustomFieldType.TEXT,
            isRequired: false,
            helpText: 'Contact\'s state or province',
            displayOrder: 13
        },
        {
            name: 'Postal/Zip Code',
            fieldKey: 'postalZip',
            type: CustomFieldType.TEXT,
            isRequired: false,
            helpText: 'Contact\'s postal or zip code',
            displayOrder: 14
        },
        {
            name: 'Country',
            fieldKey: 'country',
            type: CustomFieldType.TEXT,
            isRequired: false,
            helpText: 'Contact\'s country',
            displayOrder: 15
        },

        {
            name: 'Company',
            fieldKey: 'company',
            type: CustomFieldType.TEXT,
            isRequired: false,
            helpText: 'Contact\'s company name',
            displayOrder: 16
        }
    ];
};
