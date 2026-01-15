// src/presentation/routes/authRoutes.ts
import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validateBody } from '../middlewares/validationMiddleware';
import { clientSelfRegistrationSchema } from '../validations/clientValidationSchemas';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/login/admin', authController.adminLogin);
router.post('/login', authController.login);
router.post('/register-client', validateBody(clientSelfRegistrationSchema), authController.registerClient);

// Token management routes
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

// Protected route - requires valid access token
router.get('/verify', authMiddleware, authController.verifyUser);

export default router;

