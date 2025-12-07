import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validateBody } from '../middlewares/validationMiddleware';
import { clientSelfRegistrationSchema } from '../validations/clientValidationSchemas';

const router = Router();
const authController = new AuthController();

router.post('/login/admin', authController.adminLogin);
router.post('/login', authController.login);
router.post('/register-client', validateBody(clientSelfRegistrationSchema), authController.registerClient);

export default router;
