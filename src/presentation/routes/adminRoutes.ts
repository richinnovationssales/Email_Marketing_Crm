import { Router } from 'express';
import { ClientController } from '../controllers/admin/ClientController';
import { AdminUserController } from '../controllers/admin/AdminUserController';
import { PlanController } from '../controllers/PlanController';
import { authMiddleware, adminOnly, rootAdminOnly } from '../middlewares/authMiddleware';
import { validateBody } from '../middlewares/validationMiddleware';
import { clientRegistrationSchema } from '../validations/clientValidationSchemas';
import { createPlanSchema, updatePlanSchema } from '../validations/planValidationSchemas';

const router = Router();
const clientController = new ClientController();
const adminUserController = new AdminUserController();
const planController = new PlanController();

router.use(authMiddleware);

// Admin User Management (Super Admin Only)
router.post('/users', rootAdminOnly, adminUserController.createAdmin);
router.get('/users', rootAdminOnly, adminUserController.getAdmins);
router.delete('/users/:id', rootAdminOnly, adminUserController.deleteAdmin);

// Client Management (All Admins)
router.use(adminOnly);

router.post('/clients', validateBody(clientRegistrationSchema), clientController.createClient);
router.get('/clients', clientController.getClients);
router.get('/clients/pending', clientController.getPendingClients);
router.get('/clients/:id', clientController.getClientById);
router.put('/clients/:id', clientController.updateClient);
router.delete('/clients/:id', clientController.deleteClient);
router.patch('/clients/:id/approve', clientController.approveClient);
router.patch('/clients/:id/reject', clientController.rejectClient);
router.patch('/clients/:id/deactivate', clientController.deactivateClient);
router.patch('/clients/:id/reactivate', clientController.reactivateClient);
router.get('/clients/:id/analytics', clientController.getClientAnalytics);


router.post('/clients/onboard', clientController.onboardClient);

// Plan Management (All Admins)
router.post('/plans', validateBody(createPlanSchema), planController.createPlan);
router.get('/plans', planController.getPlans);
router.get('/plans/:id', planController.getPlanById);
router.get('/plans/:id/clients', planController.getClientsByPlan);
router.put('/plans/:id', validateBody(updatePlanSchema), planController.updatePlan);
router.delete('/plans/:id', planController.deletePlan);




export default router;
