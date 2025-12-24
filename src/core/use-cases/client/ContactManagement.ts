import { ContactRepository } from '../../../infrastructure/repositories/ContactRepository';
import { Contact } from '../../entities/Contact';

export class ContactManagement {
  constructor(private contactRepository: ContactRepository) { }

  async create(data: Contact, clientId: string, userId: string): Promise<Contact> {
    return this.contactRepository.create(data, clientId, userId);
  }

  async findAll(clientId: string): Promise<Contact[]> {
    return this.contactRepository.findAll(clientId);
  }

  async findById(id: string, clientId: string): Promise<Contact | null> {
    return this.contactRepository.findById(id, clientId);
  }

  async update(id: string, data: Partial<Contact>, clientId: string): Promise<Contact | null> {
    return this.contactRepository.update(id, data, clientId);
  }

  async delete(id: string, clientId: string): Promise<Contact | null> {
    return this.contactRepository.delete(id, clientId);
  }
}
