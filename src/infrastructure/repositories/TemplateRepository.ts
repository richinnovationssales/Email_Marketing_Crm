import { CreateTemplateDTO, Template } from "../../core/entities/Template";
import prisma from "../../infrastructure/database/prisma";

export class TemplateRepository {
  async create(
    data: CreateTemplateDTO,
    clientId: string,
    userId: string
  ): Promise<Template> {
    return prisma.template.create({
      data: {
        name: data.name,
        subject: data.subject,
        content: data.content,
        clientId,
        createdById: userId,
      },
    });
  }

  async findAll(clientId: string): Promise<Template[]> {
    return await prisma.template.findMany({
      where: { clientId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async findById(id: string, clientId: string): Promise<Template | null> {
    return await prisma.template.findFirst({
      where: { id, clientId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async update(
    id: string,
    data: Partial<Template>,
    clientId: string
  ): Promise<Template | null> {
    // First, verify the template belongs to the client
    const template = await prisma.template.findFirst({
      where: { id, clientId },
    });
    if (!template) {
      return null;
    }
    return await prisma.template.update({ where: { id }, data });
  }

  async delete(id: string, clientId: string): Promise<Template | null> {
    // First, verify the template belongs to the client
    const template = await prisma.template.findFirst({
      where: { id, clientId },
    });
    if (!template) {
      return null;
    }
    return await prisma.template.delete({ where: { id } });
  }
}
