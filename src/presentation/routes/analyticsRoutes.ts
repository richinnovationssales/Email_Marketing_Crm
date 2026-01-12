// src/presentation/routes/analyticsRoutes.ts
import { Router } from 'express';
import { AnalyticsController } from '../controllers/AnalyticsController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const analyticsController = new AnalyticsController();

// All analytics routes require authentication
router.use(authMiddleware);

// Client analytics overview
router.get('/overview', analyticsController.getOverview);

// All campaigns analytics for client
router.get('/campaigns', analyticsController.getAllCampaignsAnalytics);

// Specific campaign analytics
router.get('/campaigns/:id', analyticsController.getCampaignAnalytics);

// Campaign event timeline
router.get('/campaigns/:id/timeline', analyticsController.getCampaignTimeline);

// Recent email events
router.get('/events', analyticsController.getRecentEvents);

export default router;
