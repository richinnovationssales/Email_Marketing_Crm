import { Router } from 'express';
import { EmployeeController } from '../controllers/EmployeeController';
import { authMiddleware, checkClientRole } from '../middlewares/authMiddleware';
import { UserRole } from '@prisma/client';

const router = Router();
const employeeController = new EmployeeController();

router.post('/verify', employeeController.verifyEmployee);

router.use(authMiddleware);

router.post('/', checkClientRole([UserRole.CLIENT_ADMIN]), employeeController.createEmployee);
router.get('/', employeeController.getEmployees);
router.get('/:id', employeeController.getEmployeeById);
router.put('/:id', checkClientRole([UserRole.CLIENT_ADMIN]), employeeController.updateEmployee);
router.delete('/:id', checkClientRole([UserRole.CLIENT_ADMIN]), employeeController.deleteEmployee);
router.post('/:employeeId/resend-verification', checkClientRole([UserRole.CLIENT_ADMIN]), employeeController.resendVerificationEmail);

export default router;
