import { UserRepository, UserCreationData } from '../../../infrastructure/repositories/UserRepository';
import { User } from '../../entities/User';
import { AuthService } from '../../../infrastructure/services/AuthService';

export class UserManagement {
  constructor(
    private userRepository: UserRepository,
    private authService: AuthService
  ) { }

  async create(data: User, clientId?: string): Promise<User> {
    const hashedPassword = await this.authService.hashPassword(data.password);

    const creationData: UserCreationData = {
      email: data.email,
      password: hashedPassword,
      clientId: clientId || data.clientId,
      role: data.role
    };

    return this.userRepository.create(creationData);
  }

  async findAll(clientId?: string): Promise<User[]> {
    // @ts-ignore
    return this.userRepository.findAll(clientId);
  }

  async findById(id: string, clientId?: string): Promise<User | null> {
    // @ts-ignore
    return this.userRepository.findById(id, clientId);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async update(id: string, data: Partial<User>, clientId?: string): Promise<User | null> {
    if (data.password) {
      data.password = await this.authService.hashPassword(data.password);
    }
    // @ts-ignore
    return this.userRepository.update(id, data, clientId);
  }

  async delete(id: string, clientId?: string): Promise<User | null> {
    // @ts-ignore
    return this.userRepository.delete(id, clientId);
  }
}
