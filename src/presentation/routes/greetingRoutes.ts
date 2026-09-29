import { Router } from 'express';
import { GreetingController } from '../controllers/GreetingController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';

const router = Router();
const greetingController = new GreetingController();

router.use(authMiddleware);
router.use(checkClientApproval);

router.get('/', greetingController.getGreetings);

export default router;
