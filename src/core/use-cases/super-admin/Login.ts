import { SuperAdminRepository } from '../../../infrastructure/repositories/SuperAdminRepository';
import { AuthService } from '../../../infrastructure/services/AuthService';
import { SuperAdmin } from '../../entities/SuperAdmin';

export class Login {
  constructor(
    private superAdminRepository: SuperAdminRepository,
    private authService: AuthService
  ) {}

  async execute(email: string, password: string): Promise<{ token: string; user: SuperAdmin } | null> {
    const user = await this.superAdminRepository.findByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await this.authService.comparePassword(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const token = await this.authService.generateToken({ id: user.id, role: 'superadmin' });

    return { token, user };
  }
}