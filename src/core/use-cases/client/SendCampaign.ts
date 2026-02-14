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

  async execute(campaignId: string, clientId: string, isRecurringExecution = false): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId, clientId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // For recurring executions that were previously sent, allow re-sending
    const allowedStatuses: string[] = [CampaignStatus.APPROVED];
    if (isRecurringExecution) {
      allowedStatuses.push(CampaignStatus.SENT);
    }

    if (!allowedStatuses.includes(campaign.status)) {
      throw new Error(`Campaign is not in a sendable state (current: ${campaign.status})`);
    }

    // --- FIX #2: Atomic status transition to prevent duplicate sends ---
    const acquired = await this.campaignRepository.atomicStatusTransition(
      campaignId,
      campaign.status as CampaignStatus,
      CampaignStatus.SENDING,
      clientId
    );

    if (!acquired) {
      console.log(`Campaign ${campaignId} is already being sent by another process, skipping`);
      return;
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

    // --- FIX #4: Filter out recipients already sent in a previous partial attempt ---
    // For recurring campaigns: only look at SENT events AFTER the last successful cycle (sentAt).
    // This ensures a new cycle sends to everyone, while a partial-failure retry within
    // the same cycle still skips already-sent recipients.
    // For one-off campaigns (or first-ever send where sentAt is null): check ALL SENT events.
    const sinceDate = isRecurringExecution ? campaign.sentAt : undefined;
    const alreadySent = await this.emailEventRepository.findSentRecipientsForCampaign(campaignId, clientId, sinceDate);
    if (alreadySent.length > 0) {
      const alreadySentSet = new Set(alreadySent);
      recipientEmails = recipientEmails.filter(email => !alreadySentSet.has(email));
      console.log(`Filtered ${alreadySent.length} already-sent recipients. ${recipientEmails.length} remaining`);
    }

    if (recipientEmails.length === 0) {
      // All recipients already sent (retry of a fully-sent campaign) — just finalize status
      const finalStatus = isRecurringExecution ? CampaignStatus.APPROVED : CampaignStatus.SENT;
      await this.campaignRepository.update(campaignId, { status: finalStatus, sentAt: new Date() }, clientId);
      console.log(`Campaign ${campaignId}: all recipients already sent, finalized as ${finalStatus}`);
      return;
    }

    // Checking email limits before sending
    const client = await this.clientRepository.findById(clientId);
    if (!client) {
      await this.campaignRepository.update(campaignId, { status: CampaignStatus.APPROVED }, clientId);
      throw new Error('Client not found');
    }

    const remainingMessages = client.remainingMessages || 0;
    if (remainingMessages < recipientEmails.length) {
      await this.campaignRepository.update(campaignId, { status: CampaignStatus.APPROVED }, clientId);
      throw new Error(`Insufficient email credits. Required: ${recipientEmails.length}, Available: ${remainingMessages}`);
    }

    try {
      // Use Mailgun if enabled, otherwise fallback to EmailService
      const useMailgun = process.env.USE_MAILGUN === 'true' && this.mailgunService;

      if (useMailgun) {
        console.log('Using Mailgun to send campaign');

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
        const isValidEmail = (email: string | null | undefined): email is string => {
          return !!email && email.includes('@');
        };

        let effectiveFromEmail: string | undefined;
        if (isValidEmail(client.mailgunFromEmail)) {
          effectiveFromEmail = client.mailgunFromEmail;
        } else if (isValidEmail(client.registrationEmail)) {
          effectiveFromEmail = client.registrationEmail;
        } else {
          effectiveFromEmail = process.env.MAILGUN_FROM_EMAIL;
        }

        const effectiveFromName = client.mailgunFromName || client.name || process.env.MAILGUN_FROM_NAME || 'Email Service';

        if (!effectiveFromEmail || !isValidEmail(effectiveFromEmail)) {
          throw new Error(`Invalid sender email configured: "${effectiveFromEmail}". Must be a valid email address (e.g., noreply@domain.com), not just a domain.`);
        }

        // Domain alignment: ensure fromEmail domain matches mailgunDomain to prevent
        // Outlook "on behalf of" display caused by envelope/header domain mismatch
        if (client.mailgunDomain && effectiveFromEmail) {
          const fromDomain = effectiveFromEmail.split('@')[1];
          if (fromDomain && fromDomain !== client.mailgunDomain) {
            const localPart = effectiveFromEmail.split('@')[0];
            const alignedEmail = `${localPart}@${client.mailgunDomain}`;
            console.warn(
              `Domain alignment: fromEmail domain "${fromDomain}" does not match mailgunDomain "${client.mailgunDomain}". ` +
              `Auto-correcting from "${effectiveFromEmail}" to "${alignedEmail}" to prevent "on behalf of" display in Outlook.`
            );
            effectiveFromEmail = alignedEmail;
          }
        }

        console.log(`Mailgun sender config - From: "${effectiveFromName}" <${effectiveFromEmail}>`);
        console.log(`Client domain override: ${client.mailgunDomain || 'none (using system default)'}`);

        const clientConfig: ClientMailgunConfig | undefined = {
          domain: client.mailgunDomain || undefined,
          fromEmail: effectiveFromEmail,
          fromName: effectiveFromName,
        };

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

        // --- FIX #3 & #4: Per-batch SENT event logging with correct messageId, and per-batch credit deduction ---
        const messageIds: string[] = [];
        let totalSentThisExecution = 0;

        for (const result of results) {
          if (result.status === 'success') {
            messageIds.push(result.messageId);

            // Log SENT events with the correct batch-specific messageId
            for (const email of result.recipients) {
              await this.emailEventRepository.create({
                clientId,
                campaignId,
                contactEmail: email,
                eventType: 'SENT',
                mailgunId: result.messageId || undefined,
              });
            }

            // Deduct credits immediately for this batch
            if (result.recipientsSent > 0) {
              await this.clientRepository.update(clientId, {
                remainingMessages: { decrement: result.recipientsSent },
              });
              totalSentThisExecution += result.recipientsSent;
            }
          }
        }

        if (messageIds.length === 0) {
          const errors = results
            .filter(r => r.status === 'error')
            .flatMap(r => r.errors?.map(e => `${e.recipient}: ${e.error}`) || []);

          throw new Error(`Failed to send email to any recipients. Mailgun errors: ${errors.join('; ')}`);
        }

        // Check if any batches failed (partial success)
        const failedBatches = results.filter(r => r.status === 'error');
        if (failedBatches.length > 0) {
          const failedCount = failedBatches.reduce((sum, r) => sum + r.recipients.length, 0);

          if (isRecurringExecution) {
            // For recurring campaigns: reset to APPROVED so the next cron tick retries.
            // findSentRecipientsForCampaign will skip already-sent recipients on the retry.
            console.warn(
              `Recurring campaign ${campaignId}: ${totalSentThisExecution} sent, ${failedCount} failed. ` +
              `Resetting to APPROVED for next scheduled retry.`
            );
            await this.campaignRepository.update(
              campaignId,
              {
                status: CampaignStatus.APPROVED,
                mailgunMessageIds: JSON.stringify(messageIds),
                mailgunTags: [`campaign-${campaignId}`, `client-${clientId}`],
              },
              clientId
            );
          } else {
            // For one-off campaigns: keep as SENDING so admin can see it needs attention.
            console.warn(
              `Campaign ${campaignId}: ${totalSentThisExecution} sent, ${failedCount} failed. ` +
              `Keeping status as SENDING for manual retry.`
            );
            await this.campaignRepository.update(
              campaignId,
              {
                mailgunMessageIds: JSON.stringify(messageIds),
                mailgunTags: [`campaign-${campaignId}`, `client-${clientId}`],
              },
              clientId
            );
          }
          return;
        }

        // --- FIX #1: Set final status based on whether this is a recurring execution ---
        const finalStatus = isRecurringExecution ? CampaignStatus.APPROVED : CampaignStatus.SENT;

        await this.campaignRepository.update(
          campaignId,
          {
            status: finalStatus,
            mailgunMessageIds: JSON.stringify(messageIds),
            mailgunTags: [`campaign-${campaignId}`, `client-${clientId}`],
            sentAt: new Date(),
          },
          clientId
        );

        console.log(
          `Campaign sent successfully via Mailgun (${totalSentThisExecution} recipients). ` +
          `Final status: ${finalStatus}. Message IDs: ${messageIds.join(', ')}`
        );
      } else {
        console.log('Using fallback EmailService (Nodemailer)');

        let sentCount = 0;
        // Fallback to sequential sending via Nodemailer
        for (const contact of uniqueContacts.filter(c => recipientEmails.includes(c.email))) {
          await this.emailService.sendMail(contact.email, campaign.subject, campaign.content);

          // Log SENT event immediately after each send
          await this.emailEventRepository.create({
            clientId,
            campaignId,
            contactEmail: contact.email,
            eventType: 'SENT',
          });

          // Deduct credit per email
          await this.clientRepository.update(clientId, { remainingMessages: { decrement: 1 } });
          sentCount++;
        }

        const finalStatus = isRecurringExecution ? CampaignStatus.APPROVED : CampaignStatus.SENT;

        await this.campaignRepository.update(
          campaignId,
          {
            status: finalStatus,
            sentAt: new Date(),
          },
          clientId
        );

        console.log(`Campaign sent successfully via Nodemailer (${sentCount} recipients). Final status: ${finalStatus}`);
      }
    } catch (error) {
      console.error('Error sending campaign:', error);

      // --- FIX #4: Only revert to APPROVED if nothing was sent yet ---
      // Check if any SENT events exist for this campaign in the current cycle
      const sentRecipients = await this.emailEventRepository.findSentRecipientsForCampaign(
        campaignId, clientId, isRecurringExecution ? campaign.sentAt : undefined
      );

      if (sentRecipients.length === 0) {
        // Nothing was sent — safe to revert to APPROVED for retry
        await this.campaignRepository.update(campaignId, { status: CampaignStatus.APPROVED }, clientId);
        console.log(`Campaign ${campaignId}: no emails were sent, reverted to APPROVED`);
      } else if (isRecurringExecution) {
        // Recurring + partial send: reset to APPROVED so next cron tick retries.
        // findSentRecipientsForCampaign will skip already-sent recipients.
        await this.campaignRepository.update(campaignId, { status: CampaignStatus.APPROVED }, clientId);
        console.warn(
          `Recurring campaign ${campaignId}: ${sentRecipients.length} emails already sent before error. ` +
          `Reset to APPROVED for next scheduled retry. Credits already deducted for sent emails.`
        );
      } else {
        // One-off + partial send: keep as SENDING so admin can see it needs attention
        console.warn(
          `Campaign ${campaignId}: ${sentRecipients.length} emails already sent before error. ` +
          `Keeping status as SENDING. Credits already deducted for sent emails.`
        );
      }

      throw error;
    }
  }
}
