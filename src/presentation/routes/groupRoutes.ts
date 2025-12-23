import { Router } from 'express';
import { GroupController } from '../controllers/GroupController';
import { authMiddleware, checkClientRole } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';
import { UserRole } from '@prisma/client';

const router = Router();
const groupController = new GroupController();

router.use(authMiddleware);
router.use(checkClientApproval);

router.post('/', checkClientRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_SUPER_ADMIN]), groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroupById);
router.put('/:id', checkClientRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_SUPER_ADMIN]), groupController.updateGroup);
router.delete('/:id', checkClientRole([UserRole.CLIENT_ADMIN, UserRole.CLIENT_SUPER_ADMIN]), groupController.deleteGroup);

export default router;
