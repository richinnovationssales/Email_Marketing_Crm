import { Router } from 'express';
import { GroupController } from '../controllers/GroupController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const groupController = new GroupController();

router.use(authMiddleware);

router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/:id', groupController.getGroupById);
router.put('/:id', groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);

export default router;
