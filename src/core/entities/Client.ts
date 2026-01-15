import { Plan } from './Plan';
import { User } from './User';
import { Contact } from './Contact';
import { Group } from './Group';
import { CustomField } from './CustomField';

export interface Client {
    id: string;
    name: string;
    isApproved: boolean;
    isActive: boolean;
    plan: Plan;
    planId: string;
    planStartDate?: Date | null;
    planRenewalDate?: Date | null;
    remainingMessages?: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ClientDetails extends Client {
    users: User[];
    usersCount: number;
    contacts: Contact[];
    contactsCount: number;
    groups: Group[];
    groupsCount: number;
    customFields: CustomField[];
    customFieldsCount: number;
}

