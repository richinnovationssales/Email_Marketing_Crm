import { Admin, AdminRole } from '../../entities/Admin';
import { AdminRepository } from '../../../infrastructure/repositories/AdminRepository';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export class AdminUserManagement {
    constructor(private adminRepository: AdminRepository) { }

    async create(data: Prisma.AdminCreateInput, requesterRole: AdminRole): Promise<Admin> {
        if (requesterRole !== AdminRole.SUPER_ADMIN) {
            throw new Error('Unauthorized: Only Super Admins can create admins');
        }

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const adminData = { ...data, password: hashedPassword, role: AdminRole.ADMIN };
        return this.adminRepository.create(adminData);
    }

    async findAll(requesterRole: AdminRole): Promise<Admin[]> {
        if (requesterRole !== AdminRole.SUPER_ADMIN) {
            throw new Error('Unauthorized: Only Super Admins can list admins');
        }
        return this.adminRepository.findAll();
    }

    async delete(id: string, requesterRole: AdminRole): Promise<Admin | null> {
        if (requesterRole !== AdminRole.SUPER_ADMIN) {
            throw new Error('Unauthorized: Only Super Admins can delete admins');
        }
        return this.adminRepository.delete(id);
    }
}
