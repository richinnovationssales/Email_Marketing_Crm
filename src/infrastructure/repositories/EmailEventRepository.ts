// src/infrastructure/repositories/EmailEventRepository.ts
import { PrismaClient, EmailEventType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateEmailEventData {
  clientId: string;
  campaignId?: string;
  contactEmail: string;
  eventType: EmailEventType;
  mailgunId?: string;
  mailgunEventId?: string;
  messageId?: string;
  severity?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Per-send outcome totals. Every "per send" figure is bounded by totalSent:
 * a send is counted at most once as delivered / bounced / opened / clicked,
 * no matter how many webhook rows exist for it.
 */
export interface SendOutcomeCounts {
  totalSent: number;
  totalDelivered: number;
  totalBounced: number;       // permanent failure and never delivered
  uniqueOpens: number;        // sends opened at least once
  uniqueClicks: number;       // sends clicked at least once
  totalOpened: number;        // all open events for these sends
  totalClicked: number;       // all click events for these sends
  totalComplaints: number;    // sends with a spam complaint
  totalUnsubscribed: number;  // sends with an unsubscribe
}

export interface SendOutcomeScope {
  clientId?: string;
  campaignId?: string;
  /** Inclusive lower bound on the send time */
  sentFrom?: Date;
  /** Exclusive upper bound on the send time */
  sentBefore?: Date;
}

/**
 * Mailgun returns "<id@domain>" from the send API but "id@domain" in webhook
 * payloads. Store one canonical form so the two can be joined.
 */
export function normalizeMessageId(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/^<+/, '').replace(/>+$/, '').trim();
  return trimmed || undefined;
}

export interface EmailEventFilters {
  clientId?: string;
  campaignId?: string;
  eventType?: EmailEventType;
  contactEmail?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface EventCountResult {
  eventType: EmailEventType;
  count: number;
}

export class EmailEventRepository {

  async create(data: CreateEmailEventData) {
    return prisma.emailEvent.create({
      data: {
        clientId: data.clientId,
        campaignId: data.campaignId,
        contactEmail: data.contactEmail,
        eventType: data.eventType,
        mailgunId: data.mailgunId,
        mailgunEventId: data.mailgunEventId,
        messageId: data.messageId,
        severity: data.severity,
        errorMessage: data.errorMessage,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        timestamp: data.timestamp || new Date(),
      },
    });
  }

  /**
   * Insert a webhook event exactly once.
   * Relies on the unique constraint on mailgunEventId, so two simultaneous
   * deliveries of the same Mailgun event cannot both be stored.
   * Returns null when the event was already stored.
   */
  async createWebhookEventOnce(data: CreateEmailEventData & { mailgunEventId: string }) {
    try {
      return await this.create(data);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async createMany(dataArray: CreateEmailEventData[]) {
    if (dataArray.length === 0) return;
    const now = new Date();
    return prisma.emailEvent.createMany({
      data: dataArray.map(d => ({
        clientId: d.clientId,
        campaignId: d.campaignId,
        contactEmail: d.contactEmail,
        eventType: d.eventType,
        mailgunId: d.mailgunId,
        mailgunEventId: d.mailgunEventId,
        messageId: d.messageId,
        severity: d.severity,
        errorMessage: d.errorMessage,
        metadata: d.metadata ? JSON.stringify(d.metadata) : null,
        timestamp: d.timestamp || now,
      })),
    });
  }


  async findMany(filters: EmailEventFilters, limit = 100, offset = 0) {
    const where: Prisma.EmailEventWhereInput = {};

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.campaignId) where.campaignId = filters.campaignId;
    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.contactEmail) where.contactEmail = filters.contactEmail;

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return prisma.emailEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
      include: {
        campaign: {
          select: { id: true, name: true, subject: true },
        },
      },
    });
  }


  async countByCampaign(campaignId: string): Promise<EventCountResult[]> {
    const result = await prisma.emailEvent.groupBy({
      by: ['eventType'],
      where: { campaignId },
      _count: { eventType: true },
    });

    return result.map((r) => ({
      eventType: r.eventType,
      count: r._count.eventType,
    }));
  }

  async countByClient(clientId: string, startDate?: Date, endDate?: Date): Promise<EventCountResult[]> {
    const where: Prisma.EmailEventWhereInput = { clientId };

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const result = await prisma.emailEvent.groupBy({
      by: ['eventType'],
      where,
      _count: { eventType: true },
    });

    return result.map((r) => ({
      eventType: r.eventType,
      count: r._count.eventType,
    }));
  }

  /**
   * Get unique opens/clicks for a campaign (count distinct emails)
   */
  async getUniqueCounts(campaignId: string, eventType: EmailEventType): Promise<number> {
    const result = await prisma.emailEvent.findMany({
      where: { campaignId, eventType },
      select: { contactEmail: true },
      distinct: ['contactEmail'],
    });

    return result.length;
  }

  /**
   * Check if event already exists (for deduplication)
   */
  /**
   * Fast pre-check using the unique index. Rows written by the previous code
   * version have no mailgunEventId until the migration's post-deploy re-run
   * backfills them and removes any duplicate this check could not see.
   */
  async exists(mailgunEventId: string): Promise<boolean> {
    const row = await prisma.emailEvent.findUnique({
      where: { mailgunEventId },
      select: { id: true },
    });
    return row !== null;
  }

  /**
   * Get recent events for dashboard
   */
  async getRecentEvents(clientId: string, limit = 10) {
    return prisma.emailEvent.findMany({
      where: { clientId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: {
        campaign: {
          select: { id: true, name: true },
        },
      },
    });
  }

  /**
   * Find emails that already have a SENT event for a campaign.
   * Used to prevent duplicate sends on retry after partial failure.
   *
   * @param sinceDate - Only consider SENT events after this date.
   *   For recurring campaigns, pass campaign.sentAt so that previous cycles
   *   are ignored and only the current (partial) cycle's sends are filtered.
   */
  async findSentRecipientsForCampaign(
    campaignId: string,
    clientId: string,
    sinceDate?: Date | null
  ): Promise<string[]> {
    const where: Prisma.EmailEventWhereInput = {
      campaignId,
      clientId,
      eventType: 'SENT',
    };

    if (sinceDate) {
      where.timestamp = { gt: sinceDate };
    }

    const events = await prisma.emailEvent.findMany({
      where,
      select: { contactEmail: true },
      distinct: ['contactEmail'],
    });
    return events.map(e => e.contactEmail);
  }

  /**
   * Get events for a campaign using cursor-based pagination (memory-safe for large datasets)
   */
  async findByCampaignBatched(
    campaignId: string,
    batchSize: number = 5000,
    callback: (events: { id: string; contactEmail: string; eventType: EmailEventType; timestamp: Date; errorMessage: string | null }[]) => Promise<void>
  ) {
    let cursor: string | undefined;
    while (true) {
      const events = await prisma.emailEvent.findMany({
        where: { campaignId },
        select: {
          id: true,
          contactEmail: true,
          eventType: true,
          timestamp: true,
          errorMessage: true,
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (events.length === 0) break;
      await callback(events);
      cursor = events[events.length - 1].id;
      if (events.length < batchSize) break;
    }
  }

  /**
   * Send-based outcome counts: the single source of truth for every analytics screen.
   *
   * Starts from SENT rows (one per recipient per batch message) whose send time
   * falls in the scope, then looks up what happened to each send, whenever that
   * event arrived. Each send contributes at most 1 to delivered / bounced /
   * opened / clicked, so none of those can exceed totalSent, and duplicate
   * webhook rows cannot inflate them.
   *
   * A webhook row is matched to exactly one send:
   *   1. by messageId + recipient + client, when a SENT row with that messageId
   *      exists (normal case after the idempotency migration), otherwise
   *   2. by campaign + recipient + client to the latest send whose cycle has
   *      started. A cycle starts LEGACY_SLACK (6 h) before the send's recorded
   *      time, or halfway to the previous send if that is closer. The slack is
   *      needed because, before per-batch timestamps, every SENT row of a campaign
   *      was stamped when its LAST batch went out (batches are 30 s apart), so
   *      early batches' events precede their SENT row by up to the whole send.
   *      Rule 2 covers legacy rows with no messageId and any event whose
   *      messageId matches no recorded send.
   *   An event that matches rule 1 is never considered for rule 2.
   *
   * Recipients are compared case-insensitively (Mailgun may report a recipient in
   * a different case than the contact was stored with). Sends and events of a
   * deleted campaign (campaignId set to NULL) are matched among themselves.
   * SENT rows without a messageId (Nodemailer fallback) are each their own send.
   *
   * Cost is linear in the rows scanned (plus sorting): rule 2 is resolved by one
   * ordered pass over a stream of sends and unmatched events.
   * All date parameters are compared as UTC, independent of the DB session time zone.
   */
  async getSendOutcomeCounts(scope: SendOutcomeScope): Promise<SendOutcomeCounts> {
    if (!scope.clientId && !scope.campaignId) {
      throw new Error('getSendOutcomeCounts requires clientId or campaignId');
    }

    // "timestamp" columns are TIMESTAMP(3) holding UTC wall-clock time. Prisma sends
    // a JS Date as timestamptz, which Postgres would compare using the session time
    // zone. Pass an ISO string and convert to UTC explicitly instead.
    const utc = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;

    const scopeFilter = (alias: string): Prisma.Sql[] => {
      const a = Prisma.raw(alias);
      const f: Prisma.Sql[] = [];
      if (scope.clientId) f.push(Prisma.sql`${a}."clientId" = ${scope.clientId}`);
      if (scope.campaignId) f.push(Prisma.sql`${a}."campaignId" = ${scope.campaignId}`);
      return f;
    };

    const sendScope: Prisma.Sql[] = [Prisma.sql`x."eventType" = 'SENT'`, ...scopeFilter('x')];
    // Sends up to 12 h before the window are kept: a cycle's start depends on the
    // previous send only when it is less than 2 x LEGACY_SLACK away. Earlier sends
    // cannot change any in-window assignment. The upper bound cannot be pushed
    // down, because a later send is what ends the previous send's cycle.
    if (scope.sentFrom) {
      sendScope.push(Prisma.sql`x."timestamp" >= ${utc(scope.sentFrom)} - INTERVAL '12 hours'`);
    }

    // Candidates for rule 2. An in-window send's cycle starts at most
    // LEGACY_SLACK before the window, so earlier events cannot belong to it.
    const eventScope: Prisma.Sql[] = [Prisma.sql`e."eventType" <> 'SENT'`, ...scopeFilter('e')];
    if (scope.sentFrom) {
      eventScope.push(Prisma.sql`e."timestamp" >= ${utc(scope.sentFrom)} - INTERVAL '6 hours'`);
    }

    const windowFilter: Prisma.Sql[] = [Prisma.sql`TRUE`];
    if (scope.sentFrom) windowFilter.push(Prisma.sql`sent_at >= ${utc(scope.sentFrom)}`);
    if (scope.sentBefore) windowFilter.push(Prisma.sql`sent_at < ${utc(scope.sentBefore)}`);

    type Row = {
      total_sent: bigint;
      total_delivered: bigint;
      total_bounced: bigint;
      unique_opens: bigint;
      unique_clicks: bigint;
      total_opened: bigint;
      total_clicked: bigint;
      total_complaints: bigint;
      total_unsubscribed: bigint;
    };

    const rows = await prisma.$queryRaw<Row[]>`
      WITH sends_all AS (
        SELECT x."clientId",
               COALESCE(x."campaignId", '')  AS camp_key,
               lower(x."contactEmail")       AS email_key,
               x."messageId",
               MIN(x."id")                   AS send_key,
               MIN(x."timestamp")            AS sent_at
        FROM "EmailEvent" x
        WHERE ${Prisma.join(sendScope, ' AND ')}
        GROUP BY x."clientId", x."campaignId", x."contactEmail", x."messageId",
                 CASE WHEN x."messageId" IS NULL THEN x."id" END
      ),
      window_sends AS (
        SELECT * FROM sends_all WHERE ${Prisma.join(windowFilter, ' AND ')}
      ),
      -- Rule 1: exact message id
      rule1 AS (
        SELECT w.send_key, e."eventType", e."severity"
        FROM window_sends w
        JOIN "EmailEvent" e
          ON e."messageId"           = w."messageId"
         AND lower(e."contactEmail") = w.email_key
         AND e."clientId"            = w."clientId"
        WHERE w."messageId" IS NOT NULL
          AND e."eventType" <> 'SENT'
      ),
      -- Rule 2 candidates: events whose message id matches no recorded send
      unmatched AS (
        SELECT e."clientId",
               COALESCE(e."campaignId", '') AS camp_key,
               lower(e."contactEmail")      AS email_key,
               e."timestamp", e."eventType", e."severity"
        FROM "EmailEvent" e
        WHERE ${Prisma.join(eventScope, ' AND ')}
          AND (
            e."messageId" IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM "EmailEvent" s
              WHERE s."eventType"           = 'SENT'
                AND s."messageId"           = e."messageId"
                AND lower(s."contactEmail") = lower(e."contactEmail")
                AND s."clientId"            = e."clientId"
            )
          )
      ),
      ordered_sends AS (
        SELECT send_key, "clientId", camp_key, email_key, sent_at,
               ROW_NUMBER() OVER w AS ord,
               LAG(sent_at) OVER w AS prev_sent_at
        FROM sends_all
        WINDOW w AS (PARTITION BY "clientId", camp_key, email_key ORDER BY sent_at, send_key)
      ),
      -- One time-ordered stream per recipient. A send's cycle starts LEGACY_SLACK
      -- before its recorded time, or halfway to the previous send if closer; sends
      -- sort before events at the same instant. Each send carries a tag
      -- "<zero-padded ord><send_key>": the greatest tag so far is the latest send
      -- whose cycle has started, so a running MAX hands each event its send key.
      stream AS (
        SELECT "clientId", camp_key, email_key,
               sent_at - LEAST(INTERVAL '6 hours',
                               COALESCE((sent_at - prev_sent_at) / 2, INTERVAL '6 hours')) AS t,
               0 AS kind,
               (lpad(ord::text, 20, '0') || send_key) COLLATE "C" AS tag,
               NULL::"EmailEventType" AS "eventType", NULL::text AS "severity"
        FROM ordered_sends
        UNION ALL
        SELECT "clientId", camp_key, email_key,
               "timestamp" AS t, 1 AS kind, NULL::text COLLATE "C" AS tag,
               "eventType", "severity"
        FROM unmatched
      ),
      carried AS (
        SELECT kind, "eventType", "severity",
               MAX(tag) OVER (
                 PARTITION BY "clientId", camp_key, email_key
                 ORDER BY t, kind
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
               ) AS assigned_tag
        FROM stream
      ),
      rule2 AS (
        SELECT w.send_key, c."eventType", c."severity"
        FROM carried c
        JOIN window_sends w ON w.send_key = substr(c.assigned_tag, 21)
        WHERE c.kind = 1
          AND c.assigned_tag IS NOT NULL
      ),
      matched AS (
        SELECT * FROM rule1
        UNION ALL
        SELECT * FROM rule2
      ),
      per_send AS (
        SELECT
          bool_or("eventType" = 'DELIVERED')                                AS delivered,
          bool_or("eventType" IN ('FAILED', 'BOUNCED')
                  AND "severity" IS DISTINCT FROM 'temporary')              AS failed,
          bool_or("eventType" = 'OPENED')                                   AS opened,
          bool_or("eventType" = 'CLICKED')                                  AS clicked,
          bool_or("eventType" = 'COMPLAINED')                               AS complained,
          bool_or("eventType" = 'UNSUBSCRIBED')                             AS unsubscribed,
          COUNT(*) FILTER (WHERE "eventType" = 'OPENED')                    AS opens,
          COUNT(*) FILTER (WHERE "eventType" = 'CLICKED')                   AS clicks
        FROM matched
        GROUP BY send_key
      )
      SELECT
        (SELECT COUNT(*) FROM window_sends)                                 AS total_sent,
        COUNT(*) FILTER (WHERE delivered)                                   AS total_delivered,
        COUNT(*) FILTER (WHERE failed AND NOT delivered)                    AS total_bounced,
        COUNT(*) FILTER (WHERE opened)                                      AS unique_opens,
        COUNT(*) FILTER (WHERE clicked)                                     AS unique_clicks,
        COALESCE(SUM(opens), 0)                                             AS total_opened,
        COALESCE(SUM(clicks), 0)                                            AS total_clicked,
        COUNT(*) FILTER (WHERE complained)                                  AS total_complaints,
        COUNT(*) FILTER (WHERE unsubscribed)                                AS total_unsubscribed
      FROM per_send
    `;

    const r = rows[0];
    return {
      totalSent: Number(r?.total_sent ?? 0),
      totalDelivered: Number(r?.total_delivered ?? 0),
      totalBounced: Number(r?.total_bounced ?? 0),
      uniqueOpens: Number(r?.unique_opens ?? 0),
      uniqueClicks: Number(r?.unique_clicks ?? 0),
      totalOpened: Number(r?.total_opened ?? 0),
      totalClicked: Number(r?.total_clicked ?? 0),
      totalComplaints: Number(r?.total_complaints ?? 0),
      totalUnsubscribed: Number(r?.total_unsubscribed ?? 0),
    };
  }

  /**
   * Campaign-level counts used to refresh the CampaignAnalytics cache.
   * Same send-based logic as the overview, scoped to one campaign.
   */
  async getAggregatedCounts(campaignId: string): Promise<{
    totalSent: number;
    totalDelivered: number;
    totalOpened: number;
    totalClicked: number;
    totalBounced: number;
    totalUnsubscribed: number;
    totalComplaints: number;
    uniqueOpens: number;
    uniqueClicks: number;
  }> {
    const c = await this.getSendOutcomeCounts({ campaignId });
    return {
      totalSent: c.totalSent,
      totalDelivered: c.totalDelivered,
      totalOpened: c.totalOpened,
      totalClicked: c.totalClicked,
      totalBounced: c.totalBounced,
      totalUnsubscribed: c.totalUnsubscribed,
      totalComplaints: c.totalComplaints,
      uniqueOpens: c.uniqueOpens,
      uniqueClicks: c.uniqueClicks,
    };
  }

  /**
   * Count unique contacts (distinct contactEmail) who received a SENT event
   * for any of the given campaign IDs. Used to compute "contacts reached" for
   * a date-range export without loading all event rows into memory.
   */
  async countUniqueContactsByCampaigns(campaignIds: string[], clientId: string): Promise<number> {
    if (campaignIds.length === 0) return 0;
    type Row = { unique_contacts: bigint };
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT COUNT(DISTINCT "contactEmail") AS unique_contacts
      FROM "EmailEvent"
      WHERE "clientId" = ${clientId}
        AND "campaignId" = ANY(${campaignIds}::text[])
        AND "eventType" = 'SENT'
    `;
    return Number(rows[0]?.unique_contacts ?? 0);
  }

  /**
   * Get events timeline for a campaign
   */
  async getCampaignTimeline(campaignId: string, clientId: string) {
    return prisma.emailEvent.findMany({
      where: { campaignId, clientId },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        eventType: true,
        contactEmail: true,
        timestamp: true,
        errorMessage: true,
      },
    });
  }
}
