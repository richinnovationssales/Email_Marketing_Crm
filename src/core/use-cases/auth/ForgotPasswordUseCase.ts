// src/core/use-cases/auth/ForgotPasswordUseCase.ts

import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
import { AuthService } from '../../../infrastructure/services/AuthService';
import { EmailService } from '../../../infrastructure/services/EmailService';

const APP_NAME = process.env.APP_NAME || 'Smart solutions';
const APP_URL  = process.env.APP_URL  || 'https://emailcrm.smartsolutionsme.com';

function buildResetEmailHtml(resetUrl: string): string {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2>${APP_NAME} — Password Reset</h2>
      <p>We received a request to reset the password for your account.</p>
      <p>Click the button below to choose a new password.
         This link expires in <strong>15 minutes</strong>.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}"
           style="background:#4F46E5;color:#fff;padding:12px 24px;
                  border-radius:6px;text-decoration:none;font-weight:600">
          Reset Password
        </a>
      </p>
      <p>Or copy this link into your browser:</p>
      <p style="word-break:break-all;color:#6B7280">${resetUrl}</p>
      <hr style="margin:32px 0;border:none;border-top:1px solid #E5E7EB"/>
      <p style="color:#9CA3AF;font-size:13px">
        If you didn't request a password reset, you can safely ignore this email.
        Your password will not change.
      </p>
    </div>
  `;
}

export class ForgotPasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Initiate a password reset for the given email.
   * Always resolves — never reveals whether the address is registered
   * (prevents user enumeration attacks).
   */
  async execute(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);

    // Silently bail — do NOT tell the caller the user doesn't exist
    if (!user) return;

    const token    = await this.authService.generatePasswordResetToken(user.id);
    const resetUrl = `${APP_URL}/reset-password?token=${token}`;

    await this.emailService.sendMail(
      user.email,
      `Reset your ${APP_NAME} password`,
      buildResetEmailHtml(resetUrl),
    );
  }
}