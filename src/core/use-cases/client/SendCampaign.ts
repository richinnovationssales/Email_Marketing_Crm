import { CampaignRepository } from '../../../infrastructure/repositories/CampaignRepository';
import { ContactGroupRepository } from '../../../infrastructure/repositories/ContactGroupRepository';
import { EmailService } from '../../../infrastructure/services/EmailService';
import { MailgunService } from '../../../infrastructure/services/MailgunService';
import { CampaignStatus } from '@prisma/client';

export class SendCampaign {
  constructor(
    private campaignRepository: CampaignRepository,
    private contactGroupRepository: ContactGroupRepository,
    private emailService: EmailService,
    private mailgunService?: MailgunService
  ) { }

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
    const recipientEmails = uniqueContacts.map(contact => contact.email);

    console.log(`Sending campaign "${campaign.name}" to ${recipientEmails.length} unique recipients`);

    // Update status to SENDING
    await this.campaignRepository.update(campaignId, { status: CampaignStatus.SENDING }, clientId);

    try {
      // Use Mailgun if enabled, otherwise fallback to EmailService
      const useMailgun = process.env.USE_MAILGUN === 'true' && this.mailgunService;

      if (useMailgun) {
        console.log('Using Mailgun to send campaign');
        
        // Send via Mailgun with campaign tagging
        const results = await this.mailgunService!.sendCampaign(
          campaignId,
          clientId,
          recipientEmails,
          campaign.subject,
          campaign.content
        );

        // Collect all message IDs from batch results
        const messageIds = results
          .filter(r => r.status === 'success')
          .map(r => r.messageId);

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

        console.log(`Campaign sent successfully via Mailgun. Message IDs: ${messageIds.join(', ')}`);
      } else {
        console.log('Using fallback EmailService (Nodemailer)');
        
        // Fallback to sequential sending via Nodemailer
        for (const contact of uniqueContacts) {
          await this.emailService.sendMail(contact.email, campaign.subject, campaign.content);
        }

        await this.campaignRepository.update(
          campaignId,
          {
            status: CampaignStatus.SENT,
            sentAt: new Date(),
          },
          clientId
        );

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
