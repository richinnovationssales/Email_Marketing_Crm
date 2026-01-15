// src/infrastructure/services/SuppressionListService.ts
import { PrismaClient, SuppressionType } from '@prisma/client';

const prisma = new PrismaClient();

export interface AddToSuppressionListData {
  email: string;
  type: SuppressionType;
  clientId: string;
  reason?: string;
}

export class SuppressionListService {
  /**
   * Add an email to the suppression list
   */
  async addToSuppressionList(data: AddToSuppressionListData) {
    try {
      return await prisma.suppressionList.upsert({
        where: {
          email_type_clientId: {
            email: data.email,
            type: data.type,
            clientId: data.clientId,
          },
        },
        update: {
          reason: data.reason,
        },
        create: {
          email: data.email,
          type: data.type,
          clientId: data.clientId,
          reason: data.reason,
        },
      });
    } catch (error) {
      console.error('Error adding to suppression list:', error);
      throw error;
    }
  }

  /**
   * Check if an email is suppressed for a client
   */
  async isEmailSuppressed(email: string, clientId: string): Promise<boolean> {
    const count = await prisma.suppressionList.count({
      where: {
        email,
        clientId,
      },
    });
    return count > 0;
  }

  /**
   * Check if an email is suppressed by specific type
   */
  async isEmailSuppressedByType(
    email: string,
    clientId: string,
    type: SuppressionType
  ): Promise<boolean> {
    const count = await prisma.suppressionList.count({
      where: { email, clientId, type },
    });
    return count > 0;
  }

  /**
   * Filter out suppressed emails from a list of recipients
   */
  async filterSuppressedEmails(emails: string[], clientId: string): Promise<string[]> {
    const suppressedEmails = await prisma.suppressionList.findMany({
      where: {
        email: { in: emails },
        clientId,
      },
      select: { email: true },
    });

    const suppressedSet = new Set(suppressedEmails.map((s) => s.email.toLowerCase()));
    const filtered = emails.filter((email) => !suppressedSet.has(email.toLowerCase()));

    if (emails.length !== filtered.length) {
      console.log(
        `Filtered ${emails.length - filtered.length} suppressed emails from recipient list`
      );
    }

    return filtered;
  }

  /**
   * Get all suppressed emails for a client
   */
  async getSuppressionList(clientId: string, type?: SuppressionType) {
    const where: { clientId: string; type?: SuppressionType } = { clientId };
    if (type) where.type = type;

    return prisma.suppressionList.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get suppression counts by type for a client
   */
  async getSuppressionCounts(clientId: string) {
    const result = await prisma.suppressionList.groupBy({
      by: ['type'],
      where: { clientId },
      _count: { type: true },
    });

    return {
      bounces: result.find((r) => r.type === 'BOUNCE')?._count.type || 0,
      unsubscribes: result.find((r) => r.type === 'UNSUBSCRIBE')?._count.type || 0,
      complaints: result.find((r) => r.type === 'COMPLAINT')?._count.type || 0,
    };
  }

  /**
   * Remove an email from the suppression list
   */
  async removeFromSuppressionList(email: string, clientId: string, type?: SuppressionType) {
    if (type) {
      return prisma.suppressionList.delete({
        where: {
          email_type_clientId: { email, type, clientId },
        },
      });
    }

    // Remove all suppression types for this email
    return prisma.suppressionList.deleteMany({
      where: { email, clientId },
    });
  }
}
