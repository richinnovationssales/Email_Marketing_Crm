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
    const receivedAt = new Date().toISOString();
    const eventData = req.body?.['event-data'];
    const eventType = eventData?.event || 'unknown';
    const recipient = eventData?.recipient || 'unknown';
    const mailgunId = eventData?.id || 'unknown';
    const tags = eventData?.tags || [];

    console.log(`[WEBHOOK HIT] ${receivedAt} | event=${eventType} | recipient=${recipient} | mailgunId=${mailgunId} | tags=${JSON.stringify(tags)}`);

    try {
      const payload = req.body as MailgunWebhookPayload;

      // Validate payload structure
      if (!payload.signature || !payload['event-data']) {
        console.warn(`[WEBHOOK REJECTED] ${receivedAt} | reason=invalid_payload_structure | event=${eventType} | recipient=${recipient}`);
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      // Verify signature (skip in development if needed)
      const skipVerification = process.env.NODE_ENV === 'development' &&
                               process.env.SKIP_WEBHOOK_VERIFICATION === 'true';

      if (!skipVerification && !webhookService.verifySignature(payload)) {
        console.warn(`[WEBHOOK REJECTED] ${receivedAt} | reason=signature_verification_failed | event=${eventType} | recipient=${recipient} | timestamp=${payload.signature?.timestamp}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Process the webhook
      const result = await webhookService.processWebhook(payload);

      if (result.success) {
        console.log(`[WEBHOOK OK] ${receivedAt} | event=${eventType} | recipient=${recipient} | message=${result.message} | eventId=${result.eventId || 'n/a'}`);
        return res.status(200).json({
          message: result.message,
          eventType: result.eventType,
          eventId: result.eventId,
        });
      } else {
        console.warn(`[WEBHOOK PROCESSING FAILED] ${receivedAt} | event=${eventType} | recipient=${recipient} | message=${result.message}`);
        return res.status(422).json({
          error: result.message,
          eventType: result.eventType,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      console.error(`[WEBHOOK ERROR] ${receivedAt} | event=${eventType} | recipient=${recipient} | error=${errorMessage}`);
      console.error(`[WEBHOOK ERROR STACK] ${errorStack}`);

      // Always return 200 to Mailgun to prevent retries for processing errors
      return res.status(200).json({
        message: 'Webhook received but processing failed',
        error: errorMessage,
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
