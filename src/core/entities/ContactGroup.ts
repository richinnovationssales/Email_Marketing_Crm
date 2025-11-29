import { Contact } from './Contact';

export interface ContactGroup {
  contactId: string;
  groupId: string;
  assignedAt: Date;
  contact: Contact;
}

