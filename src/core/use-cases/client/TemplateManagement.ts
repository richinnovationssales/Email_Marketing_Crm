import { TemplateRepository } from '../../../infrastructure/repositories/TemplateRepository';
import { Template } from '../../entities/Template';

export class TemplateManagement {
  constructor(private templateRepository: TemplateRepository) { }

  async create(data: Template, clientId: string): Promise<Template> {
    return this.templateRepository.create(data, clientId);
  }

  async findAll(clientId: string): Promise<Template[]> {
    return this.templateRepository.findAll(clientId);
  }

  async findById(id: string, clientId: string): Promise<Template | null> {
    return this.templateRepository.findById(id, clientId);
  }

  async update(id: string, data: Partial<Template>, clientId: string): Promise<Template | null> {
    return this.templateRepository.update(id, data, clientId);
  }

  async delete(id: string, clientId: string): Promise<Template | null> {
    return this.templateRepository.delete(id, clientId);
  }
}
