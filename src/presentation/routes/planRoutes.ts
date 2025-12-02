import { Router } from 'express';
import { PlanController } from '../controllers/PlanController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const planController = new PlanController();

router.use(authMiddleware);

router.post('/', planController.createPlan);
router.get('/', planController.getPlans);
router.get('/:id', planController.getPlanById);
router.put('/:id', planController.updatePlan);
router.delete('/:id', planController.deletePlan);

export default router;
