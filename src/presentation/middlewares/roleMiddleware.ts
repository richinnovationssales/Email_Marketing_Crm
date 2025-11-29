import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserRole } from '@prisma/client';
import { AuthRequest } from './authMiddleware';

// Require SuperAdmin role
export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== UserRole.SUPER_ADMIN) {
        return res.status(StatusCodes.FORBIDDEN).json({
            message: 'Forbidden: Super Admin access required',
        });
    }
    next();
};

// Require Admin or SuperAdmin role
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== UserRole.ADMIN && req.user?.role !== UserRole.SUPER_ADMIN) {
        return res.status(StatusCodes.FORBIDDEN).json({
            message: 'Forbidden: Admin access required',
        });
    }
    next();
};

// Require specific client-level roles
export const requireClientRole = (allowedRoles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !allowedRoles.includes(req.user.role as UserRole)) {
            return res.status(StatusCodes.FORBIDDEN).json({
                message: 'Forbidden: Insufficient permissions',
            });
        }
        next();
    };
};

// Require any of the specified roles
export const requireAnyRole = (allowedRoles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !allowedRoles.includes(req.user.role as UserRole)) {
            return res.status(StatusCodes.FORBIDDEN).json({
                message: 'Forbidden: Insufficient permissions',
                requiredRoles: allowedRoles,
            });
        }
        next();
    };
};

// Ensure user belongs to the client they're trying to access
export const ensureClientAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
    const clientId = req.params.clientId || req.body.clientId || req.query.clientId;

    // SuperAdmin and Admin can access any client
    if (req.user?.role === UserRole.SUPER_ADMIN || req.user?.role === UserRole.ADMIN) {
        return next();
    }

    // Client users can only access their own client
    if (req.user?.clientId !== clientId) {
        return res.status(StatusCodes.FORBIDDEN).json({
            message: 'Forbidden: You can only access your own client data',
        });
    }

    next();
};
