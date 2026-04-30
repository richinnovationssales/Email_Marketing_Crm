import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import {
  GreetingManagement,
  GreetingTemplateValidationError,
} from '../../../core/use-cases/super-admin/GreetingManagement';
import { GreetingRepository } from '../../../infrastructure/repositories/GreetingRepository';

const greetingRepository = new GreetingRepository();
const greetingManagementUseCase = new GreetingManagement(greetingRepository);

export class AdminGreetingController {
  async createGreeting(req: Request, res: Response): Promise<void> {
    try {
      const greeting = await greetingManagementUseCase.create(req.body);
      res.status(StatusCodes.CREATED).json(greeting);
    } catch (error) {
      if (error instanceof GreetingTemplateValidationError) {
        res.status(StatusCodes.BAD_REQUEST).json({
          message: error.message,
          invalidTokens: error.invalidTokens,
        });
        return;
      }
      console.error('Error creating greeting:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getGreetings(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const greetings = await greetingManagementUseCase.findAll(includeInactive);
      res.json({ data: greetings });
    } catch (error) {
      console.error('Error fetching greetings:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getGreetingById(req: Request, res: Response): Promise<void> {
    try {
      const greeting = await greetingManagementUseCase.findById(req.params.id);
      if (!greeting) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Greeting not found' });
        return;
      }
      res.json(greeting);
    } catch (error) {
      console.error('Error fetching greeting:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updateGreeting(req: Request, res: Response): Promise<void> {
    try {
      const greeting = await greetingManagementUseCase.update(req.params.id, req.body);
      if (!greeting) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Greeting not found' });
        return;
      }
      res.json(greeting);
    } catch (error) {
      if (error instanceof GreetingTemplateValidationError) {
        res.status(StatusCodes.BAD_REQUEST).json({
          message: error.message,
          invalidTokens: error.invalidTokens,
        });
        return;
      }
      console.error('Error updating greeting:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deleteGreeting(req: Request, res: Response): Promise<void> {
    try {
      const greeting = await greetingManagementUseCase.delete(req.params.id);
      if (!greeting) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Greeting not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting greeting:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
