import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ListGreetings } from '../../core/use-cases/client/ListGreetings';
import { GreetingRepository } from '../../infrastructure/repositories/GreetingRepository';
import { AuthRequest } from '../middlewares/authMiddleware';

const greetingRepository = new GreetingRepository();
const listGreetingsUseCase = new ListGreetings(greetingRepository);

export class GreetingController {
  async getGreetings(_req: AuthRequest, res: Response): Promise<void> {
    try {
      const greetings = await listGreetingsUseCase.execute();
      res.json({ data: greetings });
    } catch (error) {
      console.error('Error fetching greetings:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
