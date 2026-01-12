// src/presentation/controllers/MailgunWebhookController.ts
import { Request, Response } from 'express';
import { MailgunWebhookService, MailgunWebhookPayload } from '../../infrastructure/services/MailgunWebhookService';

const webhookService = new MailgunWebhookService();

export class MailgunWebhookController {
  /**
   * Handle incoming Mailgun webhook
   * POST /webhooks/mailgun
   */
  async handleWebhook(req: Request, res: Response) {
    try {
      const payload = req.body as MailgunWebhookPayload;

      // Validate payload structure
      if (!payload.signature || !payload['event-data']) {
        console.warn('Invalid webhook payload structure');
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      // Verify signature (skip in development if needed)
      const skipVerification = process.env.NODE_ENV === 'development' && 
                               process.env.SKIP_WEBHOOK_VERIFICATION === 'true';
      
      if (!skipVerification && !webhookService.verifySignature(payload)) {
        console.warn('Webhook signature verification failed');
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Process the webhook
      const result = await webhookService.processWebhook(payload);

      if (result.success) {
        return res.status(200).json({
          message: result.message,
          eventType: result.eventType,
          eventId: result.eventId,
        });
      } else {
        return res.status(422).json({
          error: result.message,
          eventType: result.eventType,
        });
      }
    } catch (error) {
      console.error('Error processing webhook:', error);
      
      // Always return 200 to Mailgun to prevent retries for processing errors
      // Log the error for debugging
      return res.status(200).json({
        message: 'Webhook received but processing failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Test endpoint to verify webhook configuration
   * GET /webhooks/mailgun/test
   */
  async testWebhook(req: Request, res: Response) {
    return res.status(200).json({
      message: 'Webhook endpoint is active',
      timestamp: new Date().toISOString(),
    });
  }
}
