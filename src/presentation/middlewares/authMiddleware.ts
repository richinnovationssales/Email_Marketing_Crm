// src/presentation/middlewares/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: { id: string; role: UserRole; clientId?: string; email?: string };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(StatusCodes.UNAUTHORIZED).send({ message: 'Authentication token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: string;
      role: UserRole;
      clientId?: string;
      email?: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).send({ message: 'Invalid token' });
  }
};

import { AdminRole } from '../../core/entities/Admin';

export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  console.log(AdminRole.SUPER_ADMIN);
  console.log(req.user?.role);
  console.log(AdminRole.SUPER_ADMIN === req.user?.role);
  console.log(AdminRole.ADMIN === req.user?.role);
  // @ts-ignore
  if (req.user?.role !== AdminRole.SUPER_ADMIN && req.user?.role !== AdminRole.ADMIN) {
    return res.status(StatusCodes.FORBIDDEN).send({ message: 'Forbidden: Admin access required' });
  }
  next();
};

export const rootAdminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  // @ts-ignore
  if (req.user?.role !== AdminRole.SUPER_ADMIN) {
    return res.status(StatusCodes.FORBIDDEN).send({ message: 'Forbidden: Super Admin access required' });
  }
  next();
};

export const checkClientRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      return res.status(StatusCodes.FORBIDDEN).send({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

/**
 * Middleware to require CLIENT_SUPER_ADMIN role
 * Used for sensitive operations like domain configuration
 */
export const requireClientSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== UserRole.CLIENT_SUPER_ADMIN) {
    return res.status(StatusCodes.FORBIDDEN).send({ 
      message: 'Forbidden: CLIENT_SUPER_ADMIN role required for this operation' 
    });
  }
  next();
};
