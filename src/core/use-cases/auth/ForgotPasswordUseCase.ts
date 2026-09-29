// src/core/use-cases/auth/ForgotPasswordUseCase.ts
import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
import { AuthService } from '../../../infrastructure/services/AuthService';
import { EmailService } from '../../../infrastructure/services/EmailService';

const APP_NAME = 'BEE Smart Campaigns';
const APP_URL  = process.env.APP_URL || 'https://emailcrm.smartsolutionsme.com';
const BRAND_COLOR = '#10b981'; // Emerald 500

function buildResetEmailHtml(resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          .content { padding: 24px !important; }
        }
      </style>
    </head>
    <body style="background-color: #f8fafc; margin: 0; padding: 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <td align="center">
            <table class="content" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              
              <tr>
                <td align="center" style="padding: 40px 40px 20px 40px;">
                   <div style="background: linear-gradient(135deg, #34d399 0%, #14b8a6 100%); width: 48px; height: 48px; border-radius: 10px; display: inline-block; line-height: 48px; color: #ffffff; font-weight: bold; font-size: 24px;">B</div>
                   <h1 style="color: #0f172a; font-size: 22px; font-weight: 700; margin: 16px 0 0 0; letter-spacing: -0.025em;">${APP_NAME}</h1>
                </td>
              </tr>

              <tr>
                <td style="padding: 0 40px 40px 40px; text-align: left;">
                  <p style="color: #475569; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
                    We received a request to reset your password. No changes have been made to your account yet.
                  </p>
                  
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${resetUrl}" style="background-color: ${BRAND_COLOR}; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.2);">
                      Reset Password
                    </a>
                  </div>

                  <p style="color: #64748b; font-size: 14px; line-height: 20px; text-align: center;">
                    This secure link will expire in <strong>15 minutes</strong>.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 32px 0;">
                  
                  <p style="color: #94a3b8; font-size: 12px; line-height: 18px;">
                    If the button above doesn't work, copy and paste this URL into your browser:
                    <br>
                    <span style="word-break: break-all; color: ${BRAND_COLOR};">${resetUrl}</span>
                  </p>
                </td>
              </tr>
            </table>

            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 500px;">
              <tr>
                <td style="padding: 24px 40px; text-align: center;">
                  <p style="color: #94a3b8; font-size: 13px; margin: 0;">
                    If you didn't request this, you can safely ignore this email.
                  </p>
                  <p style="color: #cbd5e1; font-size: 12px; margin-top: 8px;">
                    © ${new Date().getFullYear()} BEE Smart Campaigns. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  async execute(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    
    // Silence ensures security against user enumeration
    if (!user) return;

    const token    = await this.authService.generatePasswordResetToken(user.id);
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;
    
    // Extracting name for a personalized touch
    // const userName = user?.name || user.email.split('@')[0];

    await this.emailService.sendMail(
      user.email,
      `Action Required: Reset your ${APP_NAME} password`,
      buildResetEmailHtml(resetUrl),
    );
  }
}

// // src/core/use-cases/auth/ForgotPasswordUseCase.ts

// import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
// import { AuthService } from '../../../infrastructure/services/AuthService';
// import { EmailService } from '../../../infrastructure/services/EmailService';

// const APP_NAME = process.env.APP_NAME || 'Smart solutions';
// const APP_URL  = process.env.APP_URL  || 'https://emailcrm.smartsolutionsme.com';

// function buildResetEmailHtml(resetUrl: string): string {
//   return `
//     <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
//       <h2>${APP_NAME} — Password Reset</h2>
//       <p>We received a request to reset the password for your account.</p>
//       <p>Click the button below to choose a new password.
//          This link expires in <strong>15 minutes</strong>.</p>
//       <p style="margin:24px 0">
//         <a href="${resetUrl}"
//            style="background:#4F46E5;color:#fff;padding:12px 24px;
//                   border-radius:6px;text-decoration:none;font-weight:600">
//           Reset Password
//         </a>
//       </p>
//       <p>Or copy this link into your browser:</p>
//       <p style="word-break:break-all;color:#6B7280">${resetUrl}</p>
//       <hr style="margin:32px 0;border:none;border-top:1px solid #E5E7EB"/>
//       <p style="color:#9CA3AF;font-size:13px">
//         If you didn't request a password reset, you can safely ignore this email.
//         Your password will not change.
//       </p>
//     </div>
//   `;
// }

// export class ForgotPasswordUseCase {
//   constructor(
//     private readonly userRepository: UserRepository,
//     private readonly authService: AuthService,
//     private readonly emailService: EmailService,
//   ) {}

//   /**
//    * Initiate a password reset for the given email.
//    * Always resolves — never reveals whether the address is registered
//    * (prevents user enumeration attacks).
//    */
//   async execute(email: string): Promise<void> {
//     const user = await this.userRepository.findByEmail(email);

//     // Silently bail — do NOT tell the caller the user doesn't exist
//     if (!user) return;

//     const token    = await this.authService.generatePasswordResetToken(user.id);
//     const resetUrl = `${APP_URL}/reset-password?token=${token}`;

//     await this.emailService.sendMail(
//       user.email,
//       `Reset your ${APP_NAME} password`,
//       buildResetEmailHtml(resetUrl),
//     );
//   }
// }