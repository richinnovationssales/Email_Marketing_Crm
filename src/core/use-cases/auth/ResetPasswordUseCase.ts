// src/core/use-cases/auth/ResetPasswordUseCase.ts

import { AuthService } from '../../../infrastructure/services/AuthService';
import { UserRepository } from '../../../infrastructure/repositories/UserRepository';

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  /**
   * Validate the reset token and update the user's password.
   * Throws a descriptive error so the controller can map it to the right HTTP status.
   */
  async execute(token: string, newPassword: string): Promise<void> {
    // 1. Verify token
    const userId = await this.authService.verifyPasswordResetToken(token);
    if (!userId) {
      throw new Error('INVALID_OR_EXPIRED_TOKEN');
    }

    // 2. Ensure user still exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // 3. Hash new password
    const hashedPassword = await this.authService.hashPassword(newPassword);

    // 4. Persist the new password
    await this.userRepository.update(userId, { password: hashedPassword });

    // 5. Consume the token so it can't be reused
    await this.authService.consumePasswordResetToken(token);

    // 6. Revoke all active refresh tokens — forces re-login everywhere
    await this.authService.revokeAllUserTokens(userId);
  }
}