import { Template } from '../../core/entities/Template';
import prisma from '../../infrastructure/database/prisma';

export class TemplateRepository {
  async create(data: Template, clientId: string): Promise<Template> {
    return await prisma.template.create({ data: { ...data, clientId } });
  }

  async findAll(clientId: string): Promise<Template[]> {
    return await prisma.template.findMany({ where: { clientId } });
  }

  async findById(id: string, clientId: string): Promise<Template | null> {
    return await prisma.template.findFirst({ where: { id, clientId } });
  }

  async update(id: string, data: Partial<Template>, clientId: string): Promise<Template | null> {
    // First, verify the template belongs to the client
    const template = await prisma.template.findFirst({ where: { id, clientId } });
    if (!template) {
      return null;
    }
    return await prisma.template.update({ where: { id }, data });
  }

  async delete(id: string, clientId: string): Promise<Template | null> {
    // First, verify the template belongs to the client
    const template = await prisma.template.findFirst({ where: { id, clientId } });
    if (!template) {
      return null;
    }
    return await prisma.template.delete({ where: { id } });
  }
}
