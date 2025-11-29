import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware, checkClientRole } from '../middlewares/authMiddleware';
import { UserRole } from '@prisma/client';

const router = Router();
const userController = new UserController();

router.use(authMiddleware);

router.post('/', checkClientRole([UserRole.CLIENT_ADMIN]), userController.createUser);
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', checkClientRole([UserRole.CLIENT_ADMIN]), userController.updateUser);
router.delete('/:id', checkClientRole([UserRole.CLIENT_ADMIN]), userController.deleteUser);

export default router;
