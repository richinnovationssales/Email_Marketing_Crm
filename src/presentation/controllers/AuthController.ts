// src/presentation/controllers/AuthController.ts
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Auth } from '../../core/use-cases/Auth';
import { AdminAuth } from '../../core/use-cases/auth/AdminAuth';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { AdminRepository } from '../../infrastructure/repositories/AdminRepository';

const userRepository = new UserRepository();
const adminRepository = new AdminRepository();
const authUseCase = new Auth(userRepository);
const adminAuthUseCase = new AdminAuth(adminRepository);

export class AuthController {
  // User login
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const token = await authUseCase.login(email, password);

      if (!token) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
        return;
      }

      res.json({ token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // User registration
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, clientId, role } = req.body;
      const token = await authUseCase.register(email, password, clientId, role);

      if (!token) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Registration failed' });
        return;
      }

      res.status(StatusCodes.CREATED).json({ token });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Admin login (unified for both SUPER_ADMIN and ADMIN)
  async adminLogin(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, isSuperAdmin = false } = req.body;
      const token = await adminAuthUseCase.login(email, password, isSuperAdmin);
      
      if (!token) {
        res.status(StatusCodes.UNAUTHORIZED).json({
          message: isSuperAdmin
            ? 'Invalid credentials or insufficient permissions for super admin access'
            : 'Invalid credentials or insufficient permissions for admin access'
        });
        return;
      }

      res.json({ token });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
