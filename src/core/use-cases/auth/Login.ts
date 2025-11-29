import { UserRepository } from '../../../infrastructure/repositories/UserRepository';
import { AuthService } from '../../../infrastructure/services/AuthService';
import { User } from '../../entities/User';

export class UserLogin {
  constructor(
    private userRepository: UserRepository,
    private authService: AuthService
  ) { }

  async execute(email: string, password: string): Promise<{ token: string; user: User } | null> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await this.authService.comparePassword(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const token = await this.authService.generateToken({ id: user.id, role: user.role, clientId: user.clientId });

    return { token, user };
  }
}
