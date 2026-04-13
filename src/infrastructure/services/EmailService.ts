// src/infrastructure/services/EmailService.ts
import * as nodemailer from 'nodemailer';

const APP_NAME = process.env.APP_NAME || 'MyApp';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ,
      port: Number(process.env.SMTP_PORT) ,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail(to: string, subject: string, html: string): Promise<void> {
    const info = await this.transporter.sendMail({
      from: 'no-reply@optitrack.ivldsp.com',
      to,
      subject,
      html,
    });

    console.log('Message sent: %s', info.messageId);

    // Ethereal preview URL (only works with ethereal.email accounts)
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('Preview URL: %s', previewUrl);
    }
  }
}

// import * as nodemailer from 'nodemailer';

// export class EmailService {
//   private transporter: nodemailer.Transporter;

//   constructor() {
//     // For development, we'll use a test account from https://ethereal.email/
//     // In production, you would replace this with your actual email service provider's configuration.
//     this.transporter = nodemailer.createTransport({
//       host: 'smtp.ethereal.email',
//       port: 587,
//       secure: false, // true for 465, false for other ports
//       auth: {
//         user: 'dummy@gmail.com', // generated ethereal user
//         pass: '##gshshhshh', // generated ethereal password
//       },
//     });
//   }

//   async sendMail(to: string, subject: string, html: string) {
//     const info = await this.transporter.sendMail({
//       from: '"Your App Name" <noreply@yourapp.com>',
//       to,
//       subject,
//       html,
//     });

//     console.log('Message sent: %s', info.messageId);
//     // Preview only available when sending through an Ethereal account
//     console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
//   }
// }
