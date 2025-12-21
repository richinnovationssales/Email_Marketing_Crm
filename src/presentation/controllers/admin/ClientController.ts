import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ClientManagement } from '../../../core/use-cases/admin/ClientManagement';
import { ClientRegistrationUseCase } from '../../../core/use-cases/admin/ClientRegistrationUseCase';
import { ClientRepository } from '../../../infrastructure/repositories/ClientRepository';
import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
import { CustomFieldRepository } from '../../../infrastructure/repositories/CustomFieldRepository';
import { PlanRepository } from '../../../infrastructure/repositories/PlanRepository';
import { AuthRequest } from '../../middlewares/authMiddleware';

const clientRepository = new ClientRepository();
const userRepository = new UserRepository();
const customFieldRepository = new CustomFieldRepository();
const planRepository = new PlanRepository();
const clientManagement = new ClientManagement(clientRepository, planRepository);
const clientRegistration = new ClientRegistrationUseCase(
    clientRepository,
    userRepository,
    customFieldRepository
);

export class ClientController {
    // Get all clients
    async getClients(req: AuthRequest, res: Response): Promise<void> {
        try {
            const clients = await clientManagement.findAll();
            res.json({ data: clients });
        } catch (error) {
            console.error('Error fetching clients:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Get client by ID
    async getClientById(req: AuthRequest, res: Response): Promise<void> {
        try {
            const client = await clientManagement.findByIdWithDetails(req.params.id);
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }
            res.json({ data: client });
        } catch (error) {
            console.error('Error fetching client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    async createClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            const client = await clientRegistration.execute(req.body);
            res.status(StatusCodes.CREATED).json(client);
        } catch (error: any) {
            console.error('Error creating client:', error);

            if (error.message === 'Client with this name already exists' ||
                error.message === 'User with this email already exists') {
                res.status(StatusCodes.BAD_REQUEST).json({ message: error.message });
                return;
            }

            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }


    // Update client
    async updateClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            const client = await clientManagement.update(req.params.id, req.body);
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }
            res.json(client);
        } catch (error) {
            console.error('Error updating client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Delete client
    async deleteClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            const client = await clientManagement.delete(req.params.id);
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }
            res.status(StatusCodes.NO_CONTENT).send();
        } catch (error) {
            console.error('Error deleting client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Get pending clients
    async getPendingClients(req: AuthRequest, res: Response): Promise<void> {
        try {
            const clients = await clientManagement.findPending();
            res.json(clients);
        } catch (error) {
            console.error('Error fetching pending clients:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Approve client
    async approveClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const client = await clientManagement.update(id, { isApproved: true });
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }
            res.json(client);
        } catch (error) {
            console.error('Error approving client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Reject client
    async rejectClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const client = await clientManagement.update(id, { isApproved: false });
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }
            res.json(client);
        } catch (error) {
            console.error('Error rejecting client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Deactivate client
    async deactivateClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const client = await clientManagement.update(id, { isActive: false });
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }
            res.json(client);
        } catch (error) {
            console.error('Error deactivating client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Reactivate client
    async reactivateClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const client = await clientManagement.update(id, { isActive: true });
            if (!client) {
                res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
                return;
            }
            res.json(client);
        } catch (error) {
            console.error('Error reactivating client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Get client analytics
    async getClientAnalytics(req: AuthRequest, res: Response): Promise<void> {
        try {
            const { id } = req.params;
            const analytics = await clientManagement.getAnalytics(id);
            res.json(analytics);
        } catch (error) {
            console.error('Error fetching client analytics:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

    // Onboard first client
    async onboardClient(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.body.planId) {
                res.status(400).json({ message: "planId is required" });
                return;
            }

            const client = await clientManagement.create(req.body);
            res.status(StatusCodes.CREATED).json(client);

        } catch (error) {
            console.error('Error onboarding client:', error);
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
        }
    }

}
