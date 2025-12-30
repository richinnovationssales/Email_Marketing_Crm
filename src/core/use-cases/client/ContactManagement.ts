import { ContactRepository } from '../../../infrastructure/repositories/ContactRepository';
import { Contact } from '../../entities/Contact';

import { CustomFieldValidator } from '../../services/CustomFieldValidator';

export class ContactManagement {
  private customFieldValidator: CustomFieldValidator;

  constructor(private contactRepository: ContactRepository) {
    this.customFieldValidator = new CustomFieldValidator();
  }

  async create(data: Contact, clientId: string, userId: string, groupId?: string): Promise<Contact> {
    // Map legacy/root fields to custom fields
    if (!data.customFields) {
      data.customFields = {};
    }

    if (data.firstName) {
      data.customFields['firstName'] = data.firstName;
      data.firstName = null;
    }
    if (data.lastName) {
      data.customFields['lastName'] = data.lastName;
      data.lastName = null;
    }

    // Validate custom fields
    if (data.customFields) {
      data.customFields = await this.customFieldValidator.validate(clientId, data.customFields);
    } else {
      // Run validation even if no custom fields provided, to check for required fields
      await this.customFieldValidator.validate(clientId, {});
    }

    return this.contactRepository.create(data, clientId, userId, groupId);
  }

  async findAll(clientId: string, cursor?: string, limit?: number): Promise<{ data: Contact[], nextCursor: string | null }> {
    return this.contactRepository.findAll(clientId, cursor, limit);
  }

  async findById(id: string, clientId: string): Promise<Contact | null> {
    return this.contactRepository.findById(id, clientId);
  }

  async update(id: string, data: Partial<Contact>, clientId: string): Promise<Contact | null> {
    if (data.customFields) {
      data.customFields = await this.customFieldValidator.validate(clientId, data.customFields, true);
    }
    return this.contactRepository.update(id, data, clientId);
  }

  async delete(id: string, clientId: string): Promise<Contact | null> {
    return this.contactRepository.delete(id, clientId);
  }
}
