// src/presentation/routes/adminRoutes.ts
import { Router } from 'express';
import { ClientController } from '../controllers/admin/ClientController';
import { AdminUserController } from '../controllers/admin/AdminUserController';
import { AdminDomainController } from '../controllers/admin/AdminDomainController';
import { AdminCustomFieldController } from '../controllers/admin/AdminCustomFieldController';
import { AdminGreetingController } from '../controllers/admin/AdminGreetingController';
import { PlanController } from '../controllers/PlanController';
import { authMiddleware, adminOnly, rootAdminOnly } from '../middlewares/authMiddleware';
import { validateBody } from '../middlewares/validationMiddleware';
import { clientRegistrationSchema } from '../validations/clientValidationSchemas';
import { createPlanSchema, updatePlanSchema } from '../validations/planValidationSchemas';
import { createGreetingSchema, updateGreetingSchema } from '../validations/greetingValidationSchemas';

const router = Router();
const clientController = new ClientController();
const adminUserController = new AdminUserController();
const adminDomainController = new AdminDomainController();
const adminCustomFieldController = new AdminCustomFieldController();
const planController = new PlanController();
const adminGreetingController = new AdminGreetingController();

router.use(authMiddleware);

// Admin User Management (Super Admin Only)
router.post('/users', rootAdminOnly, adminUserController.createAdmin);
router.get('/users', rootAdminOnly, adminUserController.getAdmins);
router.patch('/users/:id/toggle-status', rootAdminOnly, adminUserController.activateToggleAdmin);
router.delete('/users/:id', rootAdminOnly, adminUserController.deleteAdmin);
router.patch('/users/:id/promote-super-admin', rootAdminOnly, adminUserController.promoteToSuperAdmin);

// Client Domain Configuration (Super Admin Only)
router.get('/clients/:clientId/domain', rootAdminOnly, adminDomainController.getDomainConfig);
router.put('/clients/:clientId/domain', rootAdminOnly, adminDomainController.updateDomainConfig);
router.delete('/clients/:clientId/domain', rootAdminOnly, adminDomainController.removeDomainConfig);
router.get('/clients/:clientId/domain/history', rootAdminOnly, adminDomainController.getDomainHistory);

// Greeting Management (Super Admin Only) — platform-global greeting templates
router.post('/greetings', rootAdminOnly, validateBody(createGreetingSchema), adminGreetingController.createGreeting.bind(adminGreetingController));
router.get('/greetings', rootAdminOnly, adminGreetingController.getGreetings.bind(adminGreetingController));
router.get('/greetings/:id', rootAdminOnly, adminGreetingController.getGreetingById.bind(adminGreetingController));
router.put('/greetings/:id', rootAdminOnly, validateBody(updateGreetingSchema), adminGreetingController.updateGreeting.bind(adminGreetingController));
router.delete('/greetings/:id', rootAdminOnly, adminGreetingController.deleteGreeting.bind(adminGreetingController));


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
router.patch('/clients/:clientId/reset-password', clientController.resetClientPassword.bind(clientController));

// Client Custom Field Management (All Admins)
router.get('/clients/:clientId/custom-fields', adminCustomFieldController.getClientCustomFields.bind(adminCustomFieldController));
router.patch('/clients/:clientId/custom-fields/:fieldId/set-name-field', adminCustomFieldController.setNameField.bind(adminCustomFieldController));

// Plan Management (All Admins)
router.post('/plans', validateBody(createPlanSchema), planController.createPlan);
router.get('/plans', planController.getPlans);
router.get('/plans/:id', planController.getPlanById);
router.get('/plans/:id/clients', planController.getClientsByPlan);
router.put('/plans/:id', validateBody(updatePlanSchema), planController.updatePlan);
router.delete('/plans/:id', planController.deletePlan);




export default router;
