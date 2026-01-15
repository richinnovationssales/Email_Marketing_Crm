
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UserRepository } from '../../infrastructure/repositories/UserRepository';
import { User } from '@prisma/client';

export class Auth {
  constructor(private userRepository: UserRepository) { }

  async login(email: string, password: string): Promise<{ token: string; user: User } | null> {
    const user = await this.userRepository.findByEmail(email);

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    return { token, user };
  }

  async register(email: string, password: string, clientId: string, role?: string): Promise<string | null> {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userRepository.create({
      email,
      password: hashedPassword,
      clientId,
      role: role as any
    });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        clientId: user.clientId
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    return token;
  }
}
