import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { authMiddleware, superAdminOnly } from '../middlewares/authMiddleware';

const router = Router();
const dashboardController = new DashboardController();

router.get('/admin', authMiddleware, superAdminOnly, dashboardController.getAdminDashboard);
router.get('/client', authMiddleware, dashboardController.getClientDashboard);
router.get('/employee', authMiddleware, dashboardController.getEmployeeDashboard);
router.get('/campaign-performance', authMiddleware, dashboardController.getCampaignPerformanceReport);

export default router;
