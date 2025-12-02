import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AdminUserManagement } from '../../../core/use-cases/admin/AdminUserManagement';
import { AdminRepository } from '../../../infrastructure/repositories/AdminRepository';
import { AuthRequest } from '../../middlewares/authMiddleware';
import { AdminRole } from '../../../core/entities/Admin';

const adminRepository = new AdminRepository();
const adminUserManagement = new AdminUserManagement(adminRepository);

export class AdminUserController {
    async createAdmin(req: AuthRequest, res: Response): Promise<void> {
        try {
            // @ts-ignore
            const requesterRole = req.user?.role as AdminRole;
            const admin = await adminUserManagement.create(req.body, requesterRole);
            res.status(StatusCodes.CREATED).json(admin);
        } catch (error: any) {
            if (error.message.startsWith('Unauthorized')) {
                res.status(StatusCodes.FORBIDDEN).json({ message: error.message });
                return;
            }
            console.error('Error creating admin:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    async getAdmins(req: AuthRequest, res: Response): Promise<void> {
        try {
            // @ts-ignore
            const requesterRole = req.user?.role as AdminRole;
            const admins = await adminUserManagement.findAll(requesterRole);
            res.json(admins);
        } catch (error: any) {
            if (error.message.startsWith('Unauthorized')) {
                res.status(StatusCodes.FORBIDDEN).json({ message: error.message });
                return;
            }
            console.error('Error fetching admins:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    async deleteAdmin(req: AuthRequest, res: Response): Promise<void> {
        try {
            // @ts-ignore
            const requesterRole = req.user?.role as AdminRole;
            const admin = await adminUserManagement.delete(req.params.id, requesterRole);
            if (!admin) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Admin not found' });
                return;
            }
            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error: any) {
            if (error.message.startsWith('Unauthorized')) {
                res.status(StatusCodes.FORBIDDEN).json({ message: error.message });
                return;
            }
            console.error('Error deleting admin:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }
}
