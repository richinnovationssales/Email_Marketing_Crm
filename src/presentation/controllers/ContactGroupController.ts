// src/presentation/controllers/ContactGroupController.ts
import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ContactGroupManagement } from '../../core/use-cases/client/ContactGroupManagement';
import { ContactGroupRepository } from '../../infrastructure/repositories/ContactGroupRepository';
import { AuthRequest } from '../middlewares/authMiddleware';

const contactGroupRepository = new ContactGroupRepository();
const contactGroupManagementUseCase = new ContactGroupManagement(contactGroupRepository);

export class ContactGroupController {
  async assignContactToGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { contactId, groupId } = req.body;
      const contactGroup = await contactGroupManagementUseCase.assignContactToGroup(contactId, groupId, req.user.clientId);
      res.status(StatusCodes.CREATED).json(contactGroup);
    } catch (error) {
      console.error('Error assigning contact to group:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async removeContactFromGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { contactId, groupId } = req.params;
      await contactGroupManagementUseCase.removeContactFromGroup(contactId, groupId, req.user.clientId);
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error removing contact from group:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getContactsInGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { groupId } = req.params;
      const contacts = await contactGroupManagementUseCase.getContactsInGroup(groupId, req.user.clientId);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts in group:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async assignMultipleContactsToGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { contactIds, groupId } = req.body;
      if (!Array.isArray(contactIds) || !groupId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid payload' });
        return;
      }
      const result = await contactGroupManagementUseCase.assignMultipleContactsToGroup(contactIds, groupId, req.user.clientId);
      res.status(StatusCodes.OK).json(result);
    } catch (error) {
      console.error('Error assigning multiple contacts:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async removeMultipleContactsFromGroup(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const { contactIds, groupId } = req.body;
      if (!Array.isArray(contactIds) || !groupId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Invalid payload' });
        return;
      }
      const result = await contactGroupManagementUseCase.removeMultipleContactsFromGroup(contactIds, groupId, req.user.clientId);
      res.status(StatusCodes.OK).json(result);
    } catch (error) {
      console.error('Error removing multiple contacts:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
