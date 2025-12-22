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
  // Create CLIENT_ADMIN - only CLIENT_SUPER_ADMIN can do this
  async createClientAdmin(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.clientId;
      if (!clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }

      // Force role to CLIENT_ADMIN
      const userData = { ...req.body, role: UserRole.CLIENT_ADMIN };
      const user = await userManagementUseCase.create(userData, clientId);

      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.status(StatusCodes.CREATED).json({ data: userWithoutPassword });
    } catch (error: any) {
      console.error('Error creating client admin:', error);
      if (error.code === 'P2002') {
        res.status(StatusCodes.CONFLICT).json({ message: 'User with this email already exists' });
        return;
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Create CLIENT_USER - CLIENT_SUPER_ADMIN or CLIENT_ADMIN can do this
  async createClientUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.clientId;
      if (!clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }

      // Force role to CLIENT_USER
      const userData = { ...req.body, role: UserRole.CLIENT_USER };
      const user = await userManagementUseCase.create(userData, clientId);

      // Don't return password in response
      const { password, ...userWithoutPassword } = user;
      res.status(StatusCodes.CREATED).json({ data: userWithoutPassword });
    } catch (error: any) {
      console.error('Error creating client user:', error);
      if (error.code === 'P2002') {
        res.status(StatusCodes.CONFLICT).json({ message: 'User with this email already exists' });
        return;
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Get all users in the client (filtered by role based on requester)
  async getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.clientId;
      if (!clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }

      const users = await userManagementUseCase.findAll(clientId);

      // Filter out passwords and optionally filter by role
      const roleFilter = req.query.role as UserRole | undefined;
      let filteredUsers = users.map(({ password, ...user }) => user);

      if (roleFilter) {
        filteredUsers = filteredUsers.filter(user => user.role === roleFilter);
      }

      // CLIENT_ADMIN can only see CLIENT_USER users
      if (req.user?.role === UserRole.CLIENT_ADMIN) {
        filteredUsers = filteredUsers.filter(user => user.role === UserRole.CLIENT_USER);
      }

      res.json({ data: filteredUsers });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Get user by ID
  async getUserById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.clientId;
      if (!clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }

      const user = await userManagementUseCase.findById(req.params.id, clientId);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      // CLIENT_ADMIN can only view CLIENT_USER
      if (req.user?.role === UserRole.CLIENT_ADMIN && user.role !== UserRole.CLIENT_USER) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You can only view CLIENT_USER users' });
        return;
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ data: userWithoutPassword });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Update user - with role hierarchy enforcement
  async updateUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.clientId;
      if (!clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }

      // First, get the user to check their role
      const existingUser = await userManagementUseCase.findById(req.params.id, clientId);
      if (!existingUser) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      // Enforce role hierarchy
      if (req.user?.role === UserRole.CLIENT_ADMIN) {
        // CLIENT_ADMIN can only update CLIENT_USER
        if (existingUser.role !== UserRole.CLIENT_USER) {
          res.status(StatusCodes.FORBIDDEN).json({ message: 'You can only update CLIENT_USER users' });
          return;
        }
        // Prevent CLIENT_ADMIN from changing role
        if (req.body.role && req.body.role !== UserRole.CLIENT_USER) {
          res.status(StatusCodes.FORBIDDEN).json({ message: 'You cannot change user role' });
          return;
        }
      }

      // Prevent updating to a higher role than allowed
      if (req.user?.role === UserRole.CLIENT_SUPER_ADMIN) {
        // CLIENT_SUPER_ADMIN cannot promote to CLIENT_SUPER_ADMIN
        if (req.body.role === UserRole.CLIENT_SUPER_ADMIN && existingUser.role !== UserRole.CLIENT_SUPER_ADMIN) {
          res.status(StatusCodes.FORBIDDEN).json({ message: 'Cannot promote user to CLIENT_SUPER_ADMIN' });
          return;
        }
      }

      // Don't allow updating the role to ADMIN or SUPER_ADMIN (platform admin roles)
      if (req.body.role === UserRole.ADMIN || req.body.role === UserRole.SUPER_ADMIN) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'Invalid role' });
        return;
      }

      const user = await userManagementUseCase.update(req.params.id, req.body, clientId);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ data: userWithoutPassword });
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Delete user - with role hierarchy enforcement
  async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clientId = req.user?.clientId;
      if (!clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }

      // First, get the user to check their role
      const existingUser = await userManagementUseCase.findById(req.params.id, clientId);
      if (!existingUser) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      // Prevent self-deletion
      if (existingUser.id === req.user?.id) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'You cannot delete yourself' });
        return;
      }

      // Enforce role hierarchy
      if (req.user?.role === UserRole.CLIENT_ADMIN) {
        // CLIENT_ADMIN can only delete CLIENT_USER
        if (existingUser.role !== UserRole.CLIENT_USER) {
          res.status(StatusCodes.FORBIDDEN).json({ message: 'You can only delete CLIENT_USER users' });
          return;
        }
      }

      // Prevent deleting CLIENT_SUPER_ADMIN
      if (existingUser.role === UserRole.CLIENT_SUPER_ADMIN) {
        res.status(StatusCodes.FORBIDDEN).json({ message: 'Cannot delete CLIENT_SUPER_ADMIN user' });
        return;
      }

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

  // Get current user's profile
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Not authenticated' });
        return;
      }

      const user = await userManagementUseCase.findById(req.user.id);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'User not found' });
        return;
      }

      const { password, ...userWithoutPassword } = user;
      res.json({ data: userWithoutPassword });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
