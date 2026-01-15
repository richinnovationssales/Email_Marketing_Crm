import { Plan } from './Plan';
import { User } from './User';
import { Contact } from './Contact';
import { Group } from './Group';
import { CustomField } from './CustomField';

export interface Client {
    id: string;
    name: string;
    registrationEmail?: string | null; // Email from onboarding - used as default sender
    isApproved: boolean;
    isActive: boolean;
    plan: Plan;
    planId: string;
    planStartDate?: Date | null;
    planRenewalDate?: Date | null;
    remainingMessages?: number | null;

    // Mailgun Domain Configuration (CLIENT_SUPER_ADMIN configurable)
    mailgunDomain?: string | null;
    mailgunFromEmail?: string | null;
    mailgunFromName?: string | null;
    mailgunVerified?: boolean;
    mailgunVerifiedAt?: Date | null;

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

