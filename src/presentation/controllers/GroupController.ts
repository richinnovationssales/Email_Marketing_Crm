import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { GroupManagement } from '../../core/use-cases/client/GroupManagement';
import { GroupRepository } from '../../infrastructure/repositories/GroupRepository';
import { AuthRequest } from '../middlewares/authMiddleware';

const groupRepository = new GroupRepository();
const groupManagementUseCase = new GroupManagement(groupRepository);

export class GroupController {
  async createGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const group = await groupManagementUseCase.create(req.body, req.user.clientId);
      res.status(StatusCodes.CREATED).json(group);
    } catch (error) {
      console.error('Error creating group:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getGroups(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const groups = await groupManagementUseCase.findAll(req.user.clientId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getGroupById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const group = await groupManagementUseCase.findById(req.params.id, req.user.clientId);
      if (!group) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Group not found' });
        return;
      }
      res.json(group);
    } catch (error) {
      console.error('Error fetching group:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updateGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const group = await groupManagementUseCase.update(req.params.id, req.body, req.user.clientId);
      if (!group) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Group not found' });
        return;
      }
      res.json(group);
    } catch (error) {
      console.error('Error updating group:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deleteGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const group = await groupManagementUseCase.delete(req.params.id, req.user.clientId);
      if (!group) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Group not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
