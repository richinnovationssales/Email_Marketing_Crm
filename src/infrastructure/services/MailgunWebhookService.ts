// src/infrastructure/services/MailgunWebhookService.ts
import crypto from 'crypto';
import prisma from '../database/prisma';
import { EmailEventType, SuppressionType } from '@prisma/client';
import { EmailEventRepository } from '../repositories/EmailEventRepository';
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
    'delivery-status'?: {
      code?: number;
      message?: string;
      description?: string;
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

    // Mailgun retries failed deliveries for up to ~8 hours, so a 5-minute window
    // rejects every retry. Allow 24h; duplicates are already blocked by event-id dedup.
    const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
    if (!Number.isFinite(timestampAge) || timestampAge > 24 * 60 * 60) {
      console.warn('Webhook timestamp too old:', timestampAge);
      return false;
    }

    // Calculate expected signature
    const encodedToken = crypto
      .createHmac('sha256', this.signingKey)
      .update(timestamp + token)
      .digest('hex');

    const isValid =
      typeof signature === 'string' &&
      signature.length === encodedToken.length &&
      crypto.timingSafeEqual(Buffer.from(encodedToken), Buffer.from(signature));
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

    // Resolve campaign and client IDs: tags -> user-variables -> message-id lookup
    const { clientId, campaignId } = await this.resolveIds(eventData);

    if (!clientId) {
      // Not one of our campaign emails (e.g. Mailgun "Test" button sample payload,
      // or mail sent outside the CRM). Acknowledge with 200 so Mailgun does not retry.
      console.warn(
        `Unattributable ${mailgunEvent} event (no client ID). tags=${JSON.stringify(eventData.tags || [])}`
      );
      return {
        success: true,
        eventType: mailgunEvent,
        message: 'Event ignored: no client ID in tags, user-variables or message lookup',
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

    // Check for duplicate events
    const mailgunId = eventData.id;
    if (await this.emailEventRepository.exists(mailgunId, eventType)) {
      console.log(`Duplicate event detected: ${mailgunId}`);
      return {
        success: true,
        eventType: mailgunEvent,
        message: 'Duplicate event ignored',
      };
    }

    // Create email event record
    const emailEvent = await this.emailEventRepository.create({
      clientId,
      campaignId: campaignId || undefined,
      contactEmail: eventData.recipient || '',
      eventType,
      mailgunId,
      errorMessage: eventData['delivery-status']?.message,
      metadata: {
        clientInfo: eventData['client-info'],
        geolocation: eventData.geolocation,
        url: eventData.url,
        deliveryStatus: eventData['delivery-status'],
      },
      timestamp: new Date(eventData.timestamp * 1000),
    });

    // Update campaign analytics if campaign ID exists
    if (campaignId) {
      await this.campaignAnalyticsService.incrementMetric(campaignId, eventType, mailgunEvent);
    }

    // Handle suppression list updates for bounces, complaints, and unsubscribes
    await this.handleSuppressionListUpdate(eventType, eventData.recipient || '', clientId, eventData, mailgunEvent);

    console.log(`Webhook processed successfully: ${eventType} event created`);

    return {
      success: true,
      eventType: mailgunEvent,
      message: 'Event processed successfully',
      eventId: emailEvent.id,
    };
  }

  /**
   * Resolve client/campaign IDs for an event using every source Mailgun gives us.
   */
  private async resolveIds(
    eventData: MailgunWebhookPayload['event-data']
  ): Promise<{ clientId: string | null; campaignId: string | null }> {
    const tags = eventData.tags || [];
    const userVars = eventData['user-variables'] || {};

    let campaignId =
      this.extractTagValue(tags, 'campaign-') || (userVars['campaign-id'] as string) || null;
    let clientId =
      this.extractTagValue(tags, 'client-') || (userVars['client-id'] as string) || null;

    // Last resort: match Mailgun message-id against the IDs stored when the campaign was sent
    if (!clientId || !campaignId) {
      const messageId = eventData.message?.headers?.['message-id'];
      if (messageId) {
        const bare = messageId.replace(/^<|>$/g, '');
        const campaign = await prisma.campaign.findFirst({
          where: { mailgunMessageIds: { contains: bare } },
          select: { id: true, clientId: true },
        });
        if (campaign) {
          campaignId = campaignId || campaign.id;
          clientId = clientId || campaign.clientId;
        }
      }
    }

    return { clientId, campaignId };
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
      unsubscribed: 'COMPLAINED', // Map to COMPLAINED since we don't have UNSUBSCRIBED
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

      case 'COMPLAINED':
        if (originalMailgunEvent === 'unsubscribed') {
          await this.suppressionListService.addToSuppressionList({
            email,
            type: 'UNSUBSCRIBE' as SuppressionType,
            clientId,
            reason: reason || 'User unsubscribed',
          });
        } else {
          await this.suppressionListService.addToSuppressionList({
            email,
            type: 'COMPLAINT' as SuppressionType,
            clientId,
            reason: reason || 'Spam complaint',
          });
        }
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
