// src/presentation/routes/webhookRoutes.ts
import { Router } from 'express';
import { MailgunWebhookController } from '../controllers/MailgunWebhookController';

const router = Router();
const webhookController = new MailgunWebhookController();

// Mailgun webhooks (no authentication required - uses signature verification)
router.post('/mailgun', webhookController.handleWebhook);
router.get('/mailgun/test', webhookController.testWebhook);

export default router;
