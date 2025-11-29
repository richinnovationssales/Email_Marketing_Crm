import { Router } from 'express';
import { SuperAdminController } from '../controllers/SuperAdminController';
import { authMiddleware, superAdminOnly } from '../middlewares/authMiddleware';

const router = Router();
const superAdminController = new SuperAdminController();

router.use(authMiddleware);
router.use(superAdminOnly);

router.post('/clients', superAdminController.createClient);
router.get('/clients', superAdminController.getClients);
router.get('/clients/pending', superAdminController.getPendingClients);
router.get('/clients/:id', superAdminController.getClientById);
router.put('/clients/:id', superAdminController.updateClient);
router.delete('/clients/:id', superAdminController.deleteClient);
router.patch('/clients/:id/approve', superAdminController.approveClient);
router.patch('/clients/:id/reject', superAdminController.rejectClient);
router.patch('/clients/:id/deactivate', superAdminController.deactivateClient);
router.patch('/clients/:id/reactivate', superAdminController.reactivateClient);

export default router;
