import { CampaignRepository } from '../../../infrastructure/repositories/CampaignRepository';
import { ContactGroupRepository } from '../../../infrastructure/repositories/ContactGroupRepository';
import { ClientRepository } from '../../../infrastructure/repositories/ClientRepository';
import { EmailService } from '../../../infrastructure/services/EmailService';
import { MailgunService, ClientMailgunConfig } from '../../../infrastructure/services/MailgunService';
import { SuppressionListService } from '../../../infrastructure/services/SuppressionListService';
import { EmailEventRepository } from '../../../infrastructure/repositories/EmailEventRepository';
import { CampaignStatus } from '@prisma/client';

export class SendCampaign {
  private suppressionListService: SuppressionListService;
  private emailEventRepository: EmailEventRepository;
  private clientRepository: ClientRepository;

  constructor(
    private campaignRepository: CampaignRepository,
    private contactGroupRepository: ContactGroupRepository,
    private emailService: EmailService,
    private mailgunService?: MailgunService
  ) {
    this.suppressionListService = new SuppressionListService();
    this.emailEventRepository = new EmailEventRepository();
    this.clientRepository = new ClientRepository();
  }

  async execute(campaignId: string, clientId: string): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId, clientId);

    if (!campaign || campaign.status !== CampaignStatus.APPROVED) {
      throw new Error('Campaign not found or not approved');
    }

    // Fetch contacts from all assigned groups
    // @ts-ignore
    const groups = await this.campaignRepository.getGroups(campaignId, clientId);
    const contacts = [];
    for (const group of groups) {
      const groupContacts = await this.contactGroupRepository.getContactsInGroup(group.id, clientId);
      contacts.push(...groupContacts.map(gc => gc.contact));
    }

    // Deduplicate contacts by email
    const uniqueContacts = [...new Map(contacts.map(item => [item['email'], item])).values()];
    let recipientEmails = uniqueContacts.map(contact => contact.email);

    console.log(`Campaign "${campaign.name}" has ${recipientEmails.length} unique recipients`);

    // Filter out suppressed emails (bounces, unsubscribes, complaints)
    recipientEmails = await this.suppressionListService.filterSuppressedEmails(recipientEmails, clientId);
    console.log(`After suppression filtering: ${recipientEmails.length} recipients remaining`);

    if (recipientEmails.length === 0) {
      throw new Error('No valid recipients after filtering suppressed emails');
    }

    // Checking email limits before sending
    const client = await this.clientRepository.findById(clientId);
    if (!client) throw new Error('Client not found');

    const remainingMessages = client.remainingMessages || 0;
    if (remainingMessages < recipientEmails.length) {
      throw new Error(`Insufficient email credits. Required: ${recipientEmails.length}, Available: ${remainingMessages}`);
    }

    // Update status to SENDING
    await this.campaignRepository.update(campaignId, { status: CampaignStatus.SENDING }, clientId);

    try {
      // Use Mailgun if enabled, otherwise fallback to EmailService
      const useMailgun = process.env.USE_MAILGUN === 'true' && this.mailgunService;

      if (useMailgun) {
        console.log('Using Mailgun to send campaign');
        
        // Client fetched earlier for validation
        
        // Build recipient variables for personalization and privacy
        // This ensures each recipient only sees their own email in "To" field
        const recipientVariables: Record<string, any> = {};
        for (const contact of uniqueContacts.filter(c => recipientEmails.includes(c.email))) {
          recipientVariables[contact.email] = {
            name: contact.firstName || contact.email.split('@')[0],
            firstName: contact.firstName || '',
            lastName: contact.lastName || '',
          };
        }
        
        // Build client Mailgun config - uses registrationEmail as fallback
        const clientConfig: ClientMailgunConfig | undefined = client ? {
          domain: client.mailgunDomain || undefined,
          fromEmail: client.mailgunFromEmail || client.registrationEmail || process.env.MAILGUN_FROM_EMAIL!,
          fromName: client.mailgunFromName || client.mailgunFromEmail || client.registrationEmail || undefined,
        } : undefined;
        
        // Send via Mailgun with campaign tagging and client config
        const results = await this.mailgunService!.sendCampaign(
          campaignId,
          clientId,
          recipientEmails,
          campaign.subject,
          campaign.content,
          recipientVariables,
          clientConfig
        );

        // Collect all message IDs from batch results
        const messageIds = results
          .filter(r => r.status === 'success')
          .map(r => r.messageId);

        if (messageIds.length === 0) {
          const errors = results
            .filter(r => r.status === 'error')
            .flatMap(r => r.errors?.map(e => `${e.recipient}: ${e.error}`) || []);
            
          throw new Error(`Failed to send email to any recipients. Mailgun errors: ${errors.join('; ')}`);
        }

        // Log SENT events for each recipient
        for (const email of recipientEmails) {
          await this.emailEventRepository.create({
            clientId,
            campaignId,
            contactEmail: email,
            eventType: 'SENT',
            mailgunId: messageIds[0] || undefined, // Note: This assigns the same ID to all if batched; might need refinement for batching
          });
        }
           
        // Update campaign with Mailgun metadata
        await this.campaignRepository.update(
          campaignId,
          {
            status: CampaignStatus.SENT,
            mailgunMessageIds: JSON.stringify(messageIds),
            mailgunTags: [`campaign-${campaignId}`, `client-${clientId}`],
            sentAt: new Date(),
          },
          clientId
        );

        // Deduct credits based on successful sends
        const totalSent = results.reduce((sum, res) => sum + res.recipientsSent, 0);
        if (totalSent > 0) {
          await this.clientRepository.update(clientId, { remainingMessages: { decrement: totalSent } });
        }

        console.log(`Campaign sent successfully via Mailgun. Message IDs: ${messageIds.join(', ')}`);
      } else {
        console.log('Using fallback EmailService (Nodemailer)');
        
        // Fallback to sequential sending via Nodemailer
        for (const contact of uniqueContacts.filter(c => recipientEmails.includes(c.email))) {
          await this.emailService.sendMail(contact.email, campaign.subject, campaign.content);
          
          // Log SENT event
          await this.emailEventRepository.create({
            clientId,
            campaignId,
            contactEmail: contact.email,
            eventType: 'SENT',
          });
        }

        await this.campaignRepository.update(
          campaignId,
          {
            status: CampaignStatus.SENT,
            sentAt: new Date(),
          },
          clientId
        );

        // Deduct credits for Nodemailer sends
        await this.clientRepository.update(clientId, { remainingMessages: { decrement: recipientEmails.length } });

        console.log(`Campaign sent successfully via Nodemailer`);
      }
    } catch (error) {
      console.error('Error sending campaign:', error);
      
      // Revert status to APPROVED on failure
      await this.campaignRepository.update(campaignId, { status: CampaignStatus.APPROVED }, clientId);
      
      throw error;
    }
  }
}

