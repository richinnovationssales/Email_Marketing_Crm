import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { TemplateManagement } from '../../core/use-cases/client/TemplateManagement';
import { TemplateRepository } from '../../infrastructure/repositories/TemplateRepository';
import { AuthRequest } from '../middlewares/authMiddleware';

const templateRepository = new TemplateRepository();
const templateManagementUseCase = new TemplateManagement(templateRepository);

export class TemplateController {
  async createTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      if (!req.user?.id) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'User ID is missing' });
        return;
      }
      const template = await templateManagementUseCase.create(req.body, req.user.clientId, req.user.id);
      res.status(StatusCodes.CREATED).json(template);
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getTemplates(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const templates = await templateManagementUseCase.findAll(req.user.clientId);
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getTemplateById(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const template = await templateManagementUseCase.findById(req.params.id, req.user.clientId);
      if (!template) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updateTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const template = await templateManagementUseCase.update(req.params.id, req.body, req.user.clientId);
      if (!template) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Template not found' });
        return;
      }
      res.json(template);
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deleteTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.clientId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: 'Client ID is missing' });
        return;
      }
      const template = await templateManagementUseCase.delete(req.params.id, req.user.clientId);
      if (!template) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Template not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
