import * as nodemailer from 'nodemailer';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // For development, we'll use a test account from https://ethereal.email/
    // In production, you would replace this with your actual email service provider's configuration.
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: 'dummy@gmail.com', // generated ethereal user
        pass: '##gshshhshh', // generated ethereal password
      },
    });
  }

  async sendMail(to: string, subject: string, html: string) {
    const info = await this.transporter.sendMail({
      from: '"Your App Name" <noreply@yourapp.com>',
      to,
      subject,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    // Preview only available when sending through an Ethereal account
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  }
}
