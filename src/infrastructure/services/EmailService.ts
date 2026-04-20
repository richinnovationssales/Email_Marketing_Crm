// src/infrastructure/services/EmailService.ts
import { MailgunService } from './MailgunService';

const APP_NAME = process.env.APP_NAME || 'MyApp';

export class EmailService {
  private mailgunService: MailgunService;

  constructor() {
    this.mailgunService = new MailgunService();
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {

    console.log(`Sending email to ${to} with subject "${subject}" via Mailgun...`);
    const result = await this.mailgunService.sendSingleEmail({
      from: 'Smart Solutions <no-reply@mailme.smartsolutionsme.com>',
      to,
      subject,
      html,
      tags: ['transactional', 'auth'],
    });

    console.log('Message sent via Mailgun. ID: %s', result.id);
  }
}
