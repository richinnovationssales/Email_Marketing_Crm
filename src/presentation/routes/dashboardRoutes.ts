import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';

const router = Router();
const dashboardController = new DashboardController();

router.get('/admin', authMiddleware, dashboardController.getAdminDashboard);
router.get('/client', authMiddleware, checkClientApproval, dashboardController.getClientDashboard);
router.get('/employee', authMiddleware, checkClientApproval, dashboardController.getEmployeeDashboard);
router.get('/campaign-performance', authMiddleware, checkClientApproval, dashboardController.getCampaignPerformanceReport);

export default router;
