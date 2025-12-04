import { Router } from 'express';
import { ClientController } from '../controllers/admin/ClientController';
import { AdminUserController } from '../controllers/admin/AdminUserController';
import { authMiddleware, adminOnly, rootAdminOnly } from '../middlewares/authMiddleware';

const router = Router();
const clientController = new ClientController();
const adminUserController = new AdminUserController();

router.use(authMiddleware);

// Admin User Management (Super Admin Only)
router.post('/users', rootAdminOnly, adminUserController.createAdmin);
router.get('/users', rootAdminOnly, adminUserController.getAdmins);
router.delete('/users/:id', rootAdminOnly, adminUserController.deleteAdmin);

// Client Management (All Admins)
router.use(adminOnly);

router.post('/clients', clientController.createClient);
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




export default router;
