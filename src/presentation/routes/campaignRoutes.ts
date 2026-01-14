// src/presentation/routes/campaignRoutes.ts
import { Router } from 'express';
import { CampaignController } from '../controllers/CampaignController';
import { authMiddleware, checkClientRole } from '../middlewares/authMiddleware';
import { checkClientApproval } from '../middlewares/clientApprovalMiddleware';
import { UserRole } from '@prisma/client';

const router = Router();
const campaignController = new CampaignController();

router.use(authMiddleware);
router.use(checkClientApproval);

router.post('/', campaignController.createCampaign);
router.get('/', campaignController.getCampaigns);
router.get('/pending', checkClientRole([UserRole.CLIENT_ADMIN]), campaignController.getPendingCampaigns);
router.get('/:id', campaignController.getCampaignById);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);
router.patch('/:campaignId/submit', campaignController.submitCampaignForApproval);
router.patch('/:campaignId/approve', checkClientRole([UserRole.CLIENT_ADMIN]), campaignController.approveCampaign);
router.patch('/:campaignId/reject', checkClientRole([UserRole.CLIENT_ADMIN]), campaignController.rejectCampaign);
router.patch('/:campaignId/schedule', campaignController.updateRecurringSchedule);
router.post('/:campaignId/send', checkClientRole([UserRole.CLIENT_ADMIN]), campaignController.sendCampaign);

export default router;
