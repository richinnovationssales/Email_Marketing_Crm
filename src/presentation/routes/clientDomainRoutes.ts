import { Router } from 'express';
import { ClientDomainController } from '../controllers/ClientDomainController';
import { authMiddleware, requireClientSuperAdmin } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';

const router = Router();
const controller = new ClientDomainController();

// All routes require authentication, active/approved client, and CLIENT_SUPER_ADMIN role
router.use(authMiddleware, checkClientApproval, requireClientSuperAdmin);

// Domain Configuration Routes
router.get('/', controller.getDomainConfig);           // GET /client/domain
router.put('/', controller.updateDomainConfig);        // PUT /client/domain
router.delete('/', controller.removeDomainConfig);     // DELETE /client/domain
router.get('/history', controller.getDomainHistory);   // GET /client/domain/history

export default router;
