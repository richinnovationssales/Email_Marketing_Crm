import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 10;

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generateToken(payload: object): Promise<string> {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  }

  async verifyToken(token: string): Promise<any> {
    return jwt.verify(token, JWT_SECRET);
  }
}
