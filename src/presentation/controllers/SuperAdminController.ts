import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ClientRepository } from '../../infrastructure/repositories/ClientRepository';
import { PlanRepository } from '../../infrastructure/repositories/PlanRepository';
import { AuthRequest } from '../middlewares/authMiddleware';

const clientRepository = new ClientRepository();
const planRepository = new PlanRepository();

export class SuperAdminController {
  // Get all clients
  async getClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clients = await clientRepository.findAll();
      res.json(clients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Get client by ID
  async getClientById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const client = await clientRepository.findById(req.params.id);
      if (!client) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Client not found' });
        return;
      }
      res.json(client);
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Create new client
  async createClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const client = await clientRepository.create(req.body);
      res.status(StatusCodes.CREATED).json(client);
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  // Update client
  async updateClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const client = await clientRepository.update(req.params.id, req.body);
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
      const client = await clientRepository.delete(req.params.id);
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

  // Approve client
  async approveClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const client = await clientRepository.update(id, { isApproved: true });
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
      const client = await clientRepository.update(id, { isApproved: false });
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
      const client = await clientRepository.update(id, { isActive: false });
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
      const client = await clientRepository.update(id, { isActive: true });
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

  // Get pending clients
  async getPendingClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clients = await clientRepository.findPending();
      res.json(clients);
    } catch (error) {
      console.error('Error fetching pending clients:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
