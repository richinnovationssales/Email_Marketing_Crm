-- =============================================================================
-- 03_verify.sql  (READ-ONLY: changes nothing)
-- Run after 02_apply_production.sql, and again after the post-deploy re-run.
--   psql "$DATABASE_URL" -f 03_verify.sql
-- Every check below states its expected result.
-- =============================================================================

\echo '== 1. New columns exist (expect 3 rows) =='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'EmailEvent'
  AND column_name IN ('mailgunEventId', 'messageId', 'severity')
ORDER BY column_name;

\echo '== 2. New indexes exist (expect 3 rows, the first one UNIQUE) =='
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'EmailEvent'
  AND indexname IN ('EmailEvent_mailgunEventId_key',
                    'EmailEvent_messageId_contactEmail_idx',
                    'EmailEvent_campaignId_contactEmail_idx')
ORDER BY indexname;

\echo '== 3. Enum value UNSUBSCRIBED exists (expect true) =='
SELECT EXISTS (
  SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'EmailEventType' AND e.enumlabel = 'UNSUBSCRIBED'
) AS has_unsubscribed;

\echo '== 4. No duplicate webhook events remain (expect 0) =='
SELECT COUNT(*) AS duplicate_event_keys
FROM (
  SELECT COALESCE("mailgunEventId", "mailgunId")
  FROM "EmailEvent"
  WHERE "eventType" <> 'SENT' AND COALESCE("mailgunEventId", "mailgunId") IS NOT NULL
  GROUP BY 1
  HAVING COUNT(*) > 1
) t;

\echo '== 5. Backfill complete (expect 0 and 0; non-zero before the post-deploy re-run is normal) =='
SELECT
  (SELECT COUNT(*) FROM "EmailEvent"
   WHERE "eventType" <> 'SENT' AND "mailgunId" IS NOT NULL AND "mailgunEventId" IS NULL) AS webhook_rows_missing_event_id,
  (SELECT COUNT(*) FROM "EmailEvent"
   WHERE "eventType" = 'SENT' AND "mailgunId" IS NOT NULL AND "messageId" IS NULL)     AS sent_rows_missing_message_id;

\echo '== 6. Every backed-up row points at a row that was kept (expect 0) =='
SELECT COUNT(*) AS orphaned_backup_rows
FROM email_event_backup."EmailEvent_duplicates" b
LEFT JOIN "EmailEvent" e ON e."id" = b."keptId"
WHERE e."id" IS NULL;

\echo '== 7. Backed-up rows per event type =='
SELECT "eventType", COUNT(*) AS backed_up_rows
FROM email_event_backup."EmailEvent_duplicates"
GROUP BY "eventType"
ORDER BY "eventType";

\echo '== 8. Per-campaign sanity: delivered recipients never exceed sent recipients (expect 0 rows) =='
SELECT c."campaignId", c.sent_recipients, c.delivered_recipients
FROM (
  SELECT "campaignId",
         COUNT(DISTINCT "contactEmail") FILTER (WHERE "eventType" = 'SENT')      AS sent_recipients,
         COUNT(DISTINCT "contactEmail") FILTER (WHERE "eventType" = 'DELIVERED') AS delivered_recipients
  FROM "EmailEvent"
  WHERE "campaignId" IS NOT NULL
  GROUP BY "campaignId"
) c
WHERE c.delivered_recipients > c.sent_recipients
LIMIT 50;
