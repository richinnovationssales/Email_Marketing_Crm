import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import prisma from '../database/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret-key';
const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7;  // 7 days

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  clientId?: string;
  type?: 'user' | 'admin';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate short-lived access token (15 minutes)
   */
  async generateAccessToken(payload: TokenPayload): Promise<string> {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  /**
   * Generate long-lived refresh token and store in database
   */
  async generateRefreshToken(payload: TokenPayload): Promise<string> {
    // Generate a random token
    const refreshToken = crypto.randomBytes(64).toString('hex');
    
    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Store in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: payload.type === 'user' ? payload.id : null,
        adminId: payload.type === 'admin' ? payload.id : null,
        expiresAt,
      },
    });

    return refreshToken;
  }

  /**
   * Generate both access and refresh tokens
   */
  async generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(payload);
    return { accessToken, refreshToken };
  }

  /**
   * Verify access token and return payload
   */
  async verifyAccessToken(token: string): Promise<TokenPayload | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify refresh token from database
   */
  async verifyRefreshToken(token: string): Promise<{ userId?: string; adminId?: string } | null> {
    try {
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token },
      });

      if (!storedToken) {
        return null;
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        // Delete expired token
        await prisma.refreshToken.delete({ where: { token } });
        return null;
      }

      return {
        userId: storedToken.userId || undefined,
        adminId: storedToken.adminId || undefined,
      };
    } catch (error) {
      console.error('Error verifying refresh token:', error);
      return null;
    }
  }

  /**
   * Revoke a refresh token (logout)
   */
  async revokeRefreshToken(token: string): Promise<boolean> {
    try {
      await prisma.refreshToken.delete({ where: { token } });
      return true;
    } catch (error) {
      console.error('Error revoking refresh token:', error);
      return false;
    }
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { userId } });
  }

  /**
   * Revoke all refresh tokens for an admin
   */
  async revokeAllAdminTokens(adminId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { adminId } });
  }

  /**
   * Cleanup expired tokens (can be run as a cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  // Legacy method for backwards compatibility
  async generateToken(payload: object): Promise<string> {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  }

  // Legacy method for backwards compatibility
  async verifyToken(token: string): Promise<any> {
    return jwt.verify(token, JWT_SECRET);
  }
}

