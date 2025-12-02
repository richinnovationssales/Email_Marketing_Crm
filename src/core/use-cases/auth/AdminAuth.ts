import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { AdminRepository } from '../../../infrastructure/repositories/AdminRepository';
import { AdminRole } from '../../entities/Admin';

export class AdminAuth {
    constructor(private adminRepository: AdminRepository) { }

    async login(email: string, password: string, isSuperAdmin: boolean = false): Promise<string | null> {
        // Determine the expected role based on the isSuperAdmin flag
        const expectedRole = isSuperAdmin ? AdminRole.SUPER_ADMIN : AdminRole.ADMIN;

        // Find admin by email and verify they have the expected role
        const admin = await this.adminRepository.findByEmailAndRole(email, expectedRole);

        if (!admin || !admin.password) {
            return null;
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);

        if (!isPasswordValid) {
            return null;
        }

        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.email,
                role: admin.role,
            },
            process.env.JWT_SECRET!,
            { expiresIn: '24h' }
        );

        return token;
    }

    async createAdmin(email: string, password: string, role: AdminRole): Promise<any> {
        const hashedPassword = await bcrypt.hash(password, 10);
        return await this.adminRepository.create({
            email,
            password: hashedPassword,
            role: role as any
        });
    }
}
