// src/infrastructure/services/MailgunWebhookService.ts
import crypto from 'crypto';
import { EmailEventType, SuppressionType, Prisma } from '@prisma/client';
import { EmailEventRepository, normalizeMessageId } from '../repositories/EmailEventRepository';
import { SuppressionListService } from './SuppressionListService';
import { CampaignAnalyticsService } from './CampaignAnalyticsService';

export interface MailgunWebhookPayload {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  'event-data': {
    event: string;
    timestamp: number;
    id: string;
    message?: {
      headers?: {
        'message-id'?: string;
      };
    };
    recipient?: string;
    tags?: string[];
    'user-variables'?: Record<string, any>;
    severity?: string; // "permanent" | "temporary" on failed events
    reason?: string;
    'delivery-status'?: {
      code?: number;
      message?: string;
      description?: string;
      'attempt-no'?: number;
    };
    'client-info'?: {
      'client-name'?: string;
      'client-os'?: string;
      'device-type'?: string;
      'user-agent'?: string;
    };
    geolocation?: {
      city?: string;
      region?: string;
      country?: string;
    };
    url?: string; // For click events
  };
}

export interface WebhookProcessingResult {
  success: boolean;
  eventType: string;
  message: string;
  eventId?: string;
}

export class MailgunWebhookService {
  private emailEventRepository: EmailEventRepository;
  private suppressionListService: SuppressionListService;
  private campaignAnalyticsService: CampaignAnalyticsService;
  private signingKey: string;

  constructor() {
    this.emailEventRepository = new EmailEventRepository();
    this.suppressionListService = new SuppressionListService();
    this.campaignAnalyticsService = new CampaignAnalyticsService();
    
    const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    if (!signingKey) {
      console.warn('MAILGUN_WEBHOOK_SIGNING_KEY not set. Webhook signature validation will fail.');
    }
    this.signingKey = signingKey || '';
  }

  /**
   * Verify Mailgun webhook signature
   */
  verifySignature(payload: MailgunWebhookPayload): boolean {
    if (!this.signingKey) {
      console.warn('Webhook signing key not configured');
      return false;
    }

    const { timestamp, token, signature } = payload.signature;

    // Check timestamp is within 5 minutes
    const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (timestampAge > 300) {
      console.warn('Webhook timestamp too old:', timestampAge);
      return false;
    }

    // Calculate expected signature
    const encodedToken = crypto
      .createHmac('sha256', this.signingKey)
      .update(timestamp + token)
      .digest('hex');

    const isValid = encodedToken === signature;
    if (!isValid) {
      console.warn('Webhook signature mismatch');
    }

    return isValid;
  }

  /**
   * Process incoming webhook event
   */
  async processWebhook(payload: MailgunWebhookPayload): Promise<WebhookProcessingResult> {
    const eventData = payload['event-data'];
    const mailgunEvent = eventData.event.toLowerCase();

    console.log(`Processing Mailgun webhook: ${mailgunEvent} for ${eventData.recipient}`);

    // Extract campaign and client IDs from tags
    const tags = eventData.tags || [];
    const campaignId = this.extractTagValue(tags, 'campaign-');
    const clientId = this.extractTagValue(tags, 'client-');

    if (!clientId) {
      console.warn('No client ID found in webhook tags');
      return {
        success: false,
        eventType: mailgunEvent,
        message: 'No client ID in webhook tags',
      };
    }

    // Map Mailgun event to our event type
    const eventType = this.mapMailgunEventToType(mailgunEvent);
    if (!eventType) {
      console.log(`Ignoring unsupported event type: ${mailgunEvent}`);
      return {
        success: true,
        eventType: mailgunEvent,
        message: `Event type ${mailgunEvent} not tracked`,
      };
    }

    const mailgunEventId = eventData.id;
    if (!mailgunEventId) {
      return {
        success: false,
        eventType: mailgunEvent,
        message: 'Webhook event has no id',
      };
    }

    // Only failed events carry a meaningful severity. "dropped" is always permanent.
    const severity =
      eventType === 'FAILED'
        ? (eventData.severity?.toLowerCase() || (mailgunEvent === 'dropped' ? 'permanent' : undefined))
        : undefined;

    // Suppression updates are idempotent upserts. They also run for duplicates, so a
    // Mailgun retry after a failure between the insert and this step still suppresses.
    // Temporary failures are retried by Mailgun and must not suppress the contact.
    const applySuppression = async () => {
      if (eventType === 'FAILED' && severity === 'temporary') return;
      await this.handleSuppressionListUpdate(eventType, eventData.recipient || '', clientId, eventData, mailgunEvent);
    };

    // Fast path for retries. The unique constraint below is the real guarantee.
    if (await this.emailEventRepository.exists(mailgunEventId)) {
      console.log(`Duplicate event detected: ${mailgunEventId}`);
      await applySuppression();
      return {
        success: true,
        eventType: mailgunEvent,
        message: 'Duplicate event ignored',
      };
    }

    const eventRecord = {
      clientId,
      campaignId: campaignId || undefined,
      contactEmail: eventData.recipient || '',
      eventType,
      mailgunId: mailgunEventId,
      mailgunEventId,
      messageId: normalizeMessageId(eventData.message?.headers?.['message-id']),
      severity,
      errorMessage: eventData['delivery-status']?.message,
      metadata: {
        clientInfo: eventData['client-info'],
        geolocation: eventData.geolocation,
        url: eventData.url,
        deliveryStatus: eventData['delivery-status'],
        severity: eventData.severity,
        reason: eventData.reason,
      },
      timestamp: new Date(eventData.timestamp * 1000),
    };

    // Create email event record (exactly once per Mailgun event id)
    let emailEvent;
    try {
      emailEvent = await this.emailEventRepository.createWebhookEventOnce(eventRecord);
    } catch (error) {
      // Foreign key violation: the campaign was deleted after sending. Keep the
      // event (it still drives the client's suppression list) without the link.
      if (
        eventRecord.campaignId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        console.warn(`Campaign ${eventRecord.campaignId} no longer exists; storing event ${mailgunEventId} without it`);
        emailEvent = await this.emailEventRepository.createWebhookEventOnce({ ...eventRecord, campaignId: undefined });
      } else {
        throw error;
      }
    }

    if (!emailEvent) {
      // A concurrent delivery of the same event won the insert.
      console.log(`Duplicate event detected on insert: ${mailgunEventId}`);
      await applySuppression();
      return {
        success: true,
        eventType: mailgunEvent,
        message: 'Duplicate event ignored',
      };
    }

    // Campaign totals are recomputed from events (debounced) rather than
    // incremented per webhook, so they can never drift from the event table.
    if (emailEvent.campaignId) {
      this.campaignAnalyticsService.scheduleRefresh(emailEvent.campaignId);
    }

    await applySuppression();

    console.log(`Webhook processed successfully: ${eventType} event created`);

    return {
      success: true,
      eventType: mailgunEvent,
      message: 'Event processed successfully',
      eventId: emailEvent.id,
    };
  }

  /**
   * Extract value from tag like "campaign-abc123"
   */
  private extractTagValue(tags: string[], prefix: string): string | null {
    const tag = tags.find((t) => t.startsWith(prefix));
    return tag ? tag.substring(prefix.length) : null;
  }

  /**
   * Map Mailgun event names to EmailEventType
   */
  private mapMailgunEventToType(event: string): EmailEventType | null {
    const mapping: Record<string, EmailEventType> = {
      delivered: 'DELIVERED',
      opened: 'OPENED',
      clicked: 'CLICKED',
      bounced: 'BOUNCED',
      dropped: 'FAILED',
      complained: 'COMPLAINED',
      unsubscribed: 'UNSUBSCRIBED',
      failed: 'FAILED',
    };

    return mapping[event] || null;
  }

  /**
   * Handle suppression list updates based on event type
   */
  private async handleSuppressionListUpdate(
    eventType: EmailEventType,
    email: string,
    clientId: string,
    eventData: MailgunWebhookPayload['event-data'],
    originalMailgunEvent: string
  ) {
    if (!email) return;

    const reason = eventData['delivery-status']?.description || eventData['delivery-status']?.message;

    switch (eventType) {
      case 'BOUNCED':
      case 'FAILED':
        await this.suppressionListService.addToSuppressionList({
          email,
          type: 'BOUNCE' as SuppressionType,
          clientId,
          reason: reason || 'Hard bounce',
        });
        break;

      case 'UNSUBSCRIBED':
        await this.suppressionListService.addToSuppressionList({
          email,
          type: 'UNSUBSCRIBE' as SuppressionType,
          clientId,
          reason: reason || 'User unsubscribed',
        });
        break;

      case 'COMPLAINED':
        await this.suppressionListService.addToSuppressionList({
          email,
          type: 'COMPLAINT' as SuppressionType,
          clientId,
          reason: reason || 'Spam complaint',
        });
        break;
    }
  }

  /**
   * Process batch of webhook events (for testing or replay)
   */
  async processBatch(payloads: MailgunWebhookPayload[]): Promise<WebhookProcessingResult[]> {
    const results: WebhookProcessingResult[] = [];

    for (const payload of payloads) {
      try {
        const result = await this.processWebhook(payload);
        results.push(result);
      } catch (error) {
        console.error('Error processing webhook:', error);
        results.push({
          success: false,
          eventType: payload['event-data']?.event || 'unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }
}
