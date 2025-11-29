import { ContactGroupRepository } from '../../../infrastructure/repositories/ContactGroupRepository';
import { ContactGroup } from '../../entities/ContactGroup';

export class ContactGroupManagement {
  constructor(private contactGroupRepository: ContactGroupRepository) { }

  async assignContactToGroup(contactId: string, groupId: string, clientId: string): Promise<ContactGroup> {
    return this.contactGroupRepository.assignContactToGroup(contactId, groupId, clientId);
  }

  async removeContactFromGroup(contactId: string, groupId: string, clientId: string): Promise<void> {
    return this.contactGroupRepository.removeContactFromGroup(contactId, groupId, clientId);
  }

  async getContactsInGroup(groupId: string, clientId: string): Promise<ContactGroup[]> {
    return this.contactGroupRepository.getContactsInGroup(groupId, clientId);
  }
}
