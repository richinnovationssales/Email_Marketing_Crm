import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserManagement } from '../../core/use-cases/super-admin/UserManagement';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { AuthService } from '../../infrastructure/services/AuthService';
import { AuthRequest } from '../middlewares/authMiddleware';
import { UserRole } from '@prisma/client';

const userRepository = new UserRepository();
const authService = new AuthService();
const userManagementUseCase = new UserManagement(userRepository, authService);

export class UserController {
  async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.role === UserRole.SUPER_ADMIN ? (req.body.clientId) : req.user?.clientId;
      if (!clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const user = await userManagementUseCase.create(req.body, clientId);
      res.status(StatusCodes.CREATED).json(user);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.role === UserRole.SUPER_ADMIN ? (req.query.clientId as string) : req.user?.clientId;
      const users = await userManagementUseCase.findAll(clientId);
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.role === UserRole.SUPER_ADMIN ? undefined : req.user?.clientId;
      const user = await userManagementUseCase.findById(req.params.id, clientId);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.role === UserRole.SUPER_ADMIN ? undefined : req.user?.clientId;
      const user = await userManagementUseCase.update(req.params.id, req.body, clientId);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.role === UserRole.SUPER_ADMIN ? undefined : req.user?.clientId;
      const user = await userManagementUseCase.delete(req.params.id, clientId);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
