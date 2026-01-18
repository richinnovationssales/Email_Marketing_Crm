import { Admin, AdminRole } from '../../core/entities/Admin';
import prisma from '../../infrastructure/database/prisma';
import { Prisma } from '@prisma/client';

export class AdminRepository {
    
    async findByEmail(email: string): Promise<Admin | null> {
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin) return null;
        return { ...admin, role: admin.role as AdminRole };
    }

    async findByEmailAndRole(email: string, role: AdminRole): Promise<Admin | null> {
        const admin = await prisma.admin.findFirst({
            where: {
                email,
                role: role as any
            }
        });
        if (!admin) return null;
        return { ...admin, role: admin.role as AdminRole };
    }

    async create(data: Prisma.AdminCreateInput): Promise<Admin> {
        const admin = await prisma.admin.create({ data });
        return { ...admin, role: admin.role as AdminRole };
    }

    async findAll(): Promise<Admin[]> {
        const admins = await prisma.admin.findMany();
        return admins.map(admin => ({ ...admin, role: admin.role as AdminRole }));
    }

    async delete(id: string): Promise<Admin | null> {
        const admin = await prisma.admin.delete({ where: { id } });
        return { ...admin, role: admin.role as AdminRole };
    }

    async findById(id: string): Promise<Admin | null> {
        const admin = await prisma.admin.findUnique({ where: { id } });
        if (!admin) return null;
        return { ...admin, role: admin.role as AdminRole };
    }

    async update(
    id: string,
    data: Prisma.AdminUpdateInput
  ): Promise<Admin> {
    const admin = await prisma.admin.update({
      where: { id },
      data,
    });
    return { ...admin, role: admin.role as AdminRole };
  }
}
