import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { SuperAdminRepository } from '../../../infrastructure/repositories/SuperAdminRepository';
import { UserRole } from '@prisma/client';

export class SuperAdminAuth {
    constructor(private superAdminRepository: SuperAdminRepository) { }

    async login(email: string, password: string): Promise<string | null> {
        const superAdmin = await this.superAdminRepository.findByEmail(email);

        if (!superAdmin || !superAdmin.password) {
            return null;
        }

        const isPasswordValid = await bcrypt.compare(password, superAdmin.password);

        if (!isPasswordValid) {
            return null;
        }

        const token = jwt.sign(
            {
                id: superAdmin.id,
                email: superAdmin.email,
                role: UserRole.SUPER_ADMIN,
            },
            process.env.JWT_SECRET!,
            { expiresIn: '24h' }
        );

        return token;
    }

    // async createSuperAdmin(email: string, password: string): Promise<any> {
    //     const hashedPassword = await bcrypt.hash(password, 10);
    //     return await this.superAdminRepository.create({ email, password: hashedPassword });
    // }
}
