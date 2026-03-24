// src/presentation/routes/analyticsRoutes.ts
import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { ClientAnalyticsExportController } from '../controllers/ClientAnalyticsExportController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const analyticsController = new AnalyticsController();
const exportController = new ClientAnalyticsExportController();

// All analytics routes require authentication
router.use(authMiddleware);

// Client analytics overview
router.get('/overview', analyticsController.getOverview);

// All campaigns analytics for client
router.get('/campaigns', analyticsController.getAllCampaignsAnalytics);

// Specific campaign analytics
router.get('/campaigns/:id', analyticsController.getCampaignAnalytics);

// Recalculate analytics for a single campaign from raw events
router.post('/campaigns/:id/recalculate', analyticsController.recalculateCampaignAnalytics.bind(analyticsController));

// Recalculate analytics for ALL client campaigns (backfill historical data)
router.post('/recalculate-all', analyticsController.recalculateAllAnalytics.bind(analyticsController));

// Campaign event timeline
router.get('/campaigns/:id/timeline', analyticsController.getCampaignTimeline);

// Recent email events
router.get('/events', analyticsController.getRecentEvents);

// Export comprehensive analytics data (Excel-friendly format)
router.get('/export', exportController.getExportData);

export default router;

