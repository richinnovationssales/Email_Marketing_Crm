import FormData from 'form-data';
import Mailgun from 'mailgun.js';

// Define message data type inline to avoid import issues
interface MailgunMessageData {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  'o:tag'?: string[];
  'recipient-variables'?: string;
  [key: string]: any;
}

interface MessagesSendResult {
  id: string;
  message: string;
  status?: number;
}

export interface SingleEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  from?: string;
  clientConfig?: ClientMailgunConfig;
}

/**
 * Client-specific Mailgun configuration for sending emails
 * Allows each client to use their own domain and sender identity
 */
export interface ClientMailgunConfig {
  domain?: string;        // Client's custom Mailgun domain (falls back to default)
  fromEmail: string;      // Required: client's registrationEmail or override
  fromName?: string;      // Display name (defaults to fromEmail if not set)
}

export interface BulkEmailParams {
  recipients: string[];
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
  recipientVariables?: Record<string, any>;
  clientConfig?: ClientMailgunConfig;  // Client-specific Mailgun configuration
}

export interface CampaignSendResult {
  messageId: string;
  status: 'success' | 'error';
  recipientsSent: number;
  recipients: string[];
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
    
    const baseUrl = process.env.MAILGUN_BASE_URL || 'https://api.mailgun.net';
    // Clean URL: remove trailing slash and /v3 if present (client adds it)
    const cleanUrl = baseUrl.replace(/\/v3\/?$/, '').replace(/\/$/, '');
    
    this.mg = mailgun.client({
      username: 'api',
      key: apiKey,
      url: cleanUrl,
    });

    console.log(`MailgunService initialized with domain: ${this.domain}, url: ${cleanUrl}`);
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
      'o:tracking': 'yes',
      'o:tracking-opens': 'yes',
      'o:tracking-clicks': 'yes',
    };

    // Add tags if provided
    if (params.tags && params.tags.length > 0) {
      messageData['o:tag'] = params.tags;
    }

    try {
      const result = await this.mg.messages.create(this.domain, messageData as any);
      console.log(`Email sent to ${params.to}, Message ID: ${result.id}`);
      return result as MessagesSendResult;
    } catch (error) {
      console.error(`Error sending email to ${params.to}:`, error);
      throw error;
    }
  }

  /**
   * Send bulk emails to multiple recipients
   * Automatically batches requests if recipients exceed 1000 (Mailgun limit)
   * PRIVACY FIX: Always uses recipient-variables to hide other recipients
   */
  async sendBulkEmail(params: BulkEmailParams): Promise<CampaignSendResult[]> {
    const BATCH_SIZE = 1000; // Mailgun's limit per request
    const results: CampaignSendResult[] = [];
    
    // Initial Configuration - determine starting domain and sender identity
    // If client config is provided and has values, use them, otherwise default to system env
    let activeDomain = params.clientConfig?.domain || this.domain;
    let activeFromEmail = params.clientConfig?.fromEmail || this.fromEmail;
    let activeFromName = params.clientConfig?.fromName || activeFromEmail; 

    // Helper to check if we are currently using system defaults
    const isUsingSystemDefault = () => activeDomain === this.domain;
    
    // Split recipients into batches
    const batches = this.chunkArray(params.recipients, BATCH_SIZE);
    
    console.log(`Sending bulk email to ${params.recipients.length} recipients in ${batches.length} batch(es)`);
    console.log(`Initial configuration - Domain: ${activeDomain}, From: ${activeFromName} <${activeFromEmail}>`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} recipients)`);

      // Prepare recipient variables for this batch
      const recipientVars = params.recipientVariables 
        ? { ...params.recipientVariables }
        : {};
      
      for (const email of batch) {
        if (!recipientVars[email]) {
          recipientVars[email] = { email };
        }
      }

      const messageData: MailgunMessageData = {
        from: `${activeFromName} <${activeFromEmail}>`,
        to: batch,
        subject: params.subject,
        html: params.html,
        text: params.text,
        'recipient-variables': JSON.stringify(recipientVars),
        'o:tracking': 'yes',
        'o:tracking-opens': 'yes',
        'o:tracking-clicks': 'yes',
      };

      if (params.tags && params.tags.length > 0) {
        messageData['o:tag'] = params.tags;
      }

      // Send function that can be retried
      const sendBatch = async (domain: string, from: string, name: string): Promise<any> => {
        return this.mg.messages.create(domain, {
          ...messageData,
          from: `${name} <${from}>`
        } as any);
      };

      try {
        let result;
        try {
          // Attempt 1: Send with current active configuration
          result = await sendBatch(activeDomain, activeFromEmail, activeFromName);
        } catch (error: any) {
          // Check for 401 Unauthorized AND if we are using a custom config that is different from system default
          if (error.status === 401 && !isUsingSystemDefault()) {
            console.warn(`Unauthorized (401) with custom domain ${activeDomain}. Falling back to system default domain: ${this.domain}`);
            
            // Switch to system defaults for this and future batches
            activeDomain = this.domain;
            activeFromEmail = this.fromEmail;
            activeFromName = this.fromName;

            // Attempt 2: Retry with system defaults
            result = await sendBatch(activeDomain, activeFromEmail, activeFromName);
            console.log(`Fallback retry successful for batch ${i + 1} using system domain.`);
          } else {
            // Check specifically for the case described by user: "MailgunAPIError: Forbidden" which might be 401
            // Sometimes error structure differs, so we check status or message
            const isForbidden = error.status === 401 || (error.details && error.details === 'Forbidden');
             if (isForbidden && !isUsingSystemDefault()) {
                 console.warn(`Forbidden/Unauthorized with custom domain ${activeDomain}. Falling back to system default domain: ${this.domain}`);
                
                // Switch to system defaults for this and future batches
                activeDomain = this.domain;
                activeFromEmail = this.fromEmail;
                activeFromName = this.fromName;

                // Attempt 2: Retry with system defaults
                result = await sendBatch(activeDomain, activeFromEmail, activeFromName);
                console.log(`Fallback retry successful for batch ${i + 1} using system domain.`);
             } else {
                 throw error; // Re-throw if it's not a recoverable 401 or we're already on system default
             }
          }
        }

        // Success handling
        if (result) {
           results.push({
            messageId: result.id || '',
            status: 'success',
            recipientsSent: batch.length,
            recipients: [...batch],
          });
          console.log(`Batch ${i + 1} sent successfully. Message ID: ${result.id}`);
        }

        // Add a small delay between batches
        if (i < batches.length - 1) {
          await this.delay(100); 
        }

      } catch (error: any) {
        console.error(`Error sending batch ${i + 1}:`, error);
        results.push({
          messageId: '',
          status: 'error',
          recipientsSent: 0,
          recipients: [...batch],
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
   * Send campaign with advanced tracking, tagging, and client-specific configuration
   */
  async sendCampaign(
    campaignId: string,
    clientId: string,
    recipients: string[],
    subject: string,
    html: string,
    recipientVariables?: Record<string, any>,
    clientConfig?: ClientMailgunConfig,
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
      recipientVariables,
      clientConfig,
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
