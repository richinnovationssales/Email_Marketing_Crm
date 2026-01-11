// src/presentation/routes/userRoutes.ts
import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware, checkClientRole } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';
import { UserRole } from '@prisma/client';

const router = Router();
const userController = new UserController();

router.use(authMiddleware);
router.use(checkClientApproval);


router.post(
    '/client-admins',
    checkClientRole([UserRole.CLIENT_SUPER_ADMIN]),
    userController.createClientAdmin.bind(userController)
);

router.post(
    '/client-users',
    checkClientRole([UserRole.CLIENT_SUPER_ADMIN, UserRole.CLIENT_ADMIN]),
    userController.createClientUser.bind(userController)
);

router.get(
    '/',
    checkClientRole([UserRole.CLIENT_SUPER_ADMIN, UserRole.CLIENT_ADMIN]),
    userController.getUsers.bind(userController)
);

router.get(
    '/:id',
    checkClientRole([UserRole.CLIENT_SUPER_ADMIN, UserRole.CLIENT_ADMIN]),
    userController.getUserById.bind(userController)
);

router.put(
    '/:id',
    checkClientRole([UserRole.CLIENT_SUPER_ADMIN, UserRole.CLIENT_ADMIN]),
    userController.updateUser.bind(userController)
);

router.delete(
    '/:id',
    checkClientRole([UserRole.CLIENT_SUPER_ADMIN, UserRole.CLIENT_ADMIN]),
    userController.deleteUser.bind(userController)
);

router.get(
    '/me/profile',
    checkClientRole([UserRole.CLIENT_SUPER_ADMIN, UserRole.CLIENT_ADMIN, UserRole.CLIENT_USER]),
    userController.getProfile.bind(userController)
);

export default router;
