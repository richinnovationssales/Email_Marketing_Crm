import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { PlanManagement } from '../../core/use-cases/super-admin/PlanManagement';
import { PlanRepository } from '../../infrastructure/repositories/PlanRepository';

const planRepository = new PlanRepository();
const planManagementUseCase = new PlanManagement(planRepository);

export class PlanController {
  async createPlan(req: Request, res: Response): Promise<void> {
    try {
      const plan = await planManagementUseCase.create(req.body);
      res.status(StatusCodes.CREATED).json(plan);
    } catch (error) {
      console.error('Error creating plan:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await planManagementUseCase.findAll();
      res.json(plans);
    } catch (error) {
      console.error('Error fetching plans:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async getPlanById(req: Request, res: Response): Promise<void> {
    try {
      const plan = await planManagementUseCase.findById(req.params.id);
      if (!plan) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Plan not found' });
        return;
      }
      res.json(plan);
    } catch (error) {
      console.error('Error fetching plan:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async updatePlan(req: Request, res: Response): Promise<void> {
    try {
      const plan = await planManagementUseCase.update(req.params.id, req.body);
      if (!plan) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Plan not found' });
        return;
      }
      res.json(plan);
    } catch (error) {
      console.error('Error updating plan:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }

  async deletePlan(req: Request, res: Response): Promise<void> {
    try {
      const plan = await planManagementUseCase.delete(req.params.id);
      if (!plan) {
        res.status(StatusCodes.NOT_FOUND).json({ message: 'Plan not found' });
        return;
      }
      res.status(StatusCodes.NO_CONTENT).send();
    } catch (error) {
      console.error('Error deleting plan:', error);
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}
