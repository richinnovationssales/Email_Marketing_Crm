import { Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AuthRequest } from './authMiddleware';
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository';

const clientRepository = new ClientRepository();

export const checkClientApproval = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.clientId) {
            next();
            return;
        }

        const client = await clientRepository.findById(req.user.clientId);

        if (!client) {
            res.status(StatusCodes.NOT_FOUND).json({
                message: 'Client not found'
            });
            return;
        }

        if (!client.isApproved) {
            res.status(StatusCodes.FORBIDDEN).json({
                message: 'Client not approved. Please wait for admin approval before accessing this resource.'
            });
            return;
        }

        next();
    } catch (error) {
        console.error('Error in client approval middleware:', error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: 'Internal server error'
        });
    }
};
