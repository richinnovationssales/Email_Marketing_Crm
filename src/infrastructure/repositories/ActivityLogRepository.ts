import prisma from '../../infrastructure/database/prisma';
import { ActivityType, ClientActivityLog } from '@prisma/client';

export interface DomainChangeMetadata {
  previousDomain?: string | null;
  newDomain?: string | null;
  previousFromEmail?: string | null;
  newFromEmail?: string | null;
  previousFromName?: string | null;
  newFromName?: string | null;
}

export class ActivityLogRepository {
  /**
   * Log domain configuration changes
   */
  async logDomainChange(
    clientId: string,
    activityType: 'MAILGUN_DOMAIN_CONFIGURED' | 'MAILGUN_DOMAIN_UPDATED' | 'MAILGUN_DOMAIN_REMOVED',
    performedBy: string,
    performedByRole: string,
    metadata: DomainChangeMetadata,
    ipAddress?: string
  ): Promise<ClientActivityLog> {
    return await prisma.clientActivityLog.create({
      data: {
        clientId,
        activityType: activityType as ActivityType,
        performedBy,
        performedByRole,
        description: this.getActivityDescription(activityType, metadata),
        metadata: JSON.stringify(metadata),
        ipAddress,
      },
    });
  }

  /**
   * Get domain change history for a client
   */
  async getDomainChangeHistory(clientId: string): Promise<ClientActivityLog[]> {
    return await prisma.clientActivityLog.findMany({
      where: {
        clientId,
        activityType: {
          in: ['MAILGUN_DOMAIN_CONFIGURED', 'MAILGUN_DOMAIN_UPDATED', 'MAILGUN_DOMAIN_REMOVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Generate human-readable description for domain activities
   */
  private getActivityDescription(
    activityType: string,
    metadata: DomainChangeMetadata
  ): string {
    switch (activityType) {
      case 'MAILGUN_DOMAIN_CONFIGURED':
        return `Mailgun domain configured: ${metadata.newDomain || 'N/A'}`;
      case 'MAILGUN_DOMAIN_UPDATED':
        return `Mailgun domain updated from "${metadata.previousDomain || 'none'}" to "${metadata.newDomain || 'none'}"`;
      case 'MAILGUN_DOMAIN_REMOVED':
        return `Mailgun domain removed: ${metadata.previousDomain || 'N/A'}`;
      default:
        return 'Domain configuration changed';
    }
  }
}
