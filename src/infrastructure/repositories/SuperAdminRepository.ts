import { SuperAdmin } from '../../core/entities/SuperAdmin';
import prisma from '../../infrastructure/database/prisma';

export class SuperAdminRepository {
  async findByEmail(email: string): Promise<SuperAdmin | null> {
    return await prisma.superAdmin.findUnique({ where: { email } });
  }
}
