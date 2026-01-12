import FormData from 'form-data';
import Mailgun from 'mailgun.js';
// import type { MailgunMessageData, MessagesSendResult } from 'mailgun.js/interfaces/Messages';

export interface SingleEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  from?: string;
}

export interface BulkEmailParams {
  recipients: string[];
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  recipientVariables?: Record<string, any>;
  from?: string;
}

export interface CampaignSendResult {
  messageId: string;
  status: 'success' | 'error';
  recipientsSent: number;
  errors?: Array<{ recipient: string; error: string }>;
}

export class MailgunService {
  private mg: ReturnType<Mailgun['client']>;
  private domain: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const apiKey = process.env.MAILGUN_API_KEY;
    const domain = process.env.MAILGUN_DOMAIN;
    const fromEmail = process.env.MAILGUN_FROM_EMAIL;
    const fromName = process.env.MAILGUN_FROM_NAME;

    if (!apiKey || !domain || !fromEmail || !fromName) {
      throw new Error(
        'Missing required Mailgun environment variables. Please check: MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_FROM_EMAIL, MAILGUN_FROM_NAME'
      );
    }

    this.domain = domain;
    this.fromEmail = fromEmail;
    this.fromName = fromName;

    const mailgun = new Mailgun(FormData);
    this.mg = mailgun.client({
      username: 'api',
      key: apiKey,
      url: process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net',
    });

    console.log(`MailgunService initialized with domain: ${this.domain}`);
  }

  /**
   * Send a single email to one recipient
   */
  async sendSingleEmail(params: SingleEmailParams): Promise<MessagesSendResult> {
    const messageData: MailgunMessageData = {
      from: params.from || `${this.fromName} <${this.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    };

    // Add tags if provided
    if (params.tags && params.tags.length > 0) {
      messageData['o:tag'] = params.tags;
    }

    try {
      const result = await this.mg.messages.create(this.domain, messageData);
      console.log(`Email sent to ${params.to}, Message ID: ${result.id}`);
      return result;
    } catch (error) {
      console.error(`Error sending email to ${params.to}:`, error);
      throw error;
    }
  }

  /**
   * Send bulk emails to multiple recipients
   * Automatically batches requests if recipients exceed 1000 (Mailgun limit)
   */
  async sendBulkEmail(params: BulkEmailParams): Promise<CampaignSendResult[]> {
    const BATCH_SIZE = 1000; // Mailgun's limit per request
    const results: CampaignSendResult[] = [];
    
    // Split recipients into batches
    const batches = this.chunkArray(params.recipients, BATCH_SIZE);
    
    console.log(`Sending bulk email to ${params.recipients.length} recipients in ${batches.length} batch(es)`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} recipients)`);

      try {
        const messageData: MailgunMessageData = {
          from: params.from || `${this.fromName} <${this.fromEmail}>`,
          to: batch,
          subject: params.subject,
          html: params.html,
          text: params.text,
        };

        // Add tags if provided
        if (params.tags && params.tags.length > 0) {
          messageData['o:tag'] = params.tags;
        }

        // Add recipient variables if provided
        if (params.recipientVariables) {
          messageData['recipient-variables'] = JSON.stringify(params.recipientVariables);
        }

        const result = await this.mg.messages.create(this.domain, messageData);
        
        results.push({
          messageId: result.id,
          status: 'success',
          recipientsSent: batch.length,
        });

        console.log(`Batch ${i + 1} sent successfully. Message ID: ${result.id}`);

        // Add a small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await this.delay(100); // 100ms delay
        }
      } catch (error: any) {
        console.error(`Error sending batch ${i + 1}:`, error);
        results.push({
          messageId: '',
          status: 'error',
          recipientsSent: 0,
          errors: batch.map(recipient => ({
            recipient,
            error: error.message || 'Unknown error',
          })),
        });
      }
    }

    return results;
  }

  /**
   * Send campaign with advanced tracking and tagging
   */
  async sendCampaign(
    campaignId: string,
    clientId: string,
    recipients: string[],
    subject: string,
    html: string,
    text?: string
  ): Promise<CampaignSendResult[]> {
    const tags = [
      `campaign-${campaignId}`,
      `client-${clientId}`,
    ];

    return this.sendBulkEmail({
      recipients,
      subject,
      html,
      text,
      tags,
    });
  }

  /**
   * Utility: Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility: Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test Mailgun connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.sendSingleEmail({
        to: this.fromEmail,
        subject: 'Mailgun Test',
        html: '<h1>Mailgun connection test successful!</h1>',
        tags: ['test', 'connection-check'],
      });
      console.log('Mailgun connection test successful:', result);
      return true;
    } catch (error) {
      console.error('Mailgun connection test failed:', error);
      return false;
    }
  }
}
