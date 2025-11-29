import { CampaignRepository } from '../../../infrastructure/repositories/CampaignRepository';
import { ContactGroupRepository } from '../../../infrastructure/repositories/ContactGroupRepository';
import { EmailService } from '../../../infrastructure/services/EmailService';
import { CampaignStatus } from '@prisma/client';

export class SendCampaign {
  constructor(
    private campaignRepository: CampaignRepository,
    private contactGroupRepository: ContactGroupRepository,
    private emailService: EmailService
  ) { }

  async execute(campaignId: string, clientId: string): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId, clientId);

    if (!campaign || campaign.status !== CampaignStatus.APPROVED) {
      throw new Error('Campaign not found or not approved');
    }

    // This is a simplified version. In a real application, you would likely
    // fetch contacts in batches and handle errors more gracefully.
    // @ts-ignore
    const groups = await this.campaignRepository.getGroups(campaignId, clientId);
    const contacts = [];
    for (const group of groups) {
      const groupContacts = await this.contactGroupRepository.getContactsInGroup(group.id, clientId);
      contacts.push(...groupContacts.map(gc => gc.contact));
    }

    // Deduplicate contacts
    const uniqueContacts = [...new Map(contacts.map(item => [item['email'], item])).values()];

    await this.campaignRepository.update(campaignId, { status: CampaignStatus.SENDING }, clientId);

    for (const contact of uniqueContacts) {
      await this.emailService.sendMail(contact.email, campaign.subject, campaign.content);
    }

    await this.campaignRepository.update(campaignId, { status: CampaignStatus.SENT }, clientId);
  }
}
