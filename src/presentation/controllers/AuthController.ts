import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Auth } from '../../core/use-cases/Auth';
import { SuperAdminAuth } from '../../core/use-cases/auth/SuperAdminAuth';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { SuperAdminRepository } from '../../infrastructure/repositories/SuperAdminRepository';

const userRepository = new UserRepository();
const superAdminRepository = new SuperAdminRepository();
const authUseCase = new Auth(userRepository);
const superAdminAuthUseCase = new SuperAdminAuth(superAdminRepository);

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

  // SuperAdmin login
  async superAdminLogin(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const token = await superAdminAuthUseCase.login(email, password);

      if (!token) {
        res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Invalid credentials' });
        return;
      }

      res.json({ token });
    } catch (error) {
      console.error('SuperAdmin login error:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
