import { Router } from 'express';
import { CustomFieldController } from '../controllers/CustomFieldController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';

const router = Router();
const customFieldController = new CustomFieldController();

router.use(authMiddleware);
router.use(checkClientApproval);

router.get('/', customFieldController.getCustomFields);

export default router;
