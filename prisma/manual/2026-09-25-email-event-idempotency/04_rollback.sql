-- =============================================================================
-- 04_rollback.sql
-- Only needed if you must go back to the previous application version.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 04_rollback.sql
--
-- PART A always runs: it makes the data readable by the old code again.
-- PART B is commented out: it also restores the removed duplicate rows and
-- drops the new columns and indexes. Doing that brings back the inflated
-- analytics, so only uncomment it if you need the database exactly as before.
--
-- Everything runs in one transaction; on any error nothing is changed.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;
SET LOCAL lock_timeout = '15s';

-- PART A: the old code stores unsubscribes as COMPLAINED and does not know
-- the UNSUBSCRIBED value. Convert them back. (Postgres cannot drop an enum
-- value; leaving UNSUBSCRIBED defined but unused is harmless.)
UPDATE "EmailEvent" SET "eventType" = 'COMPLAINED' WHERE "eventType" = 'UNSUBSCRIBED';

-- PART B (optional, full undo) ----------------------------------------------
-- DROP INDEX IF EXISTS "EmailEvent_mailgunEventId_key";
-- DROP INDEX IF EXISTS "EmailEvent_messageId_contactEmail_idx";
-- DROP INDEX IF EXISTS "EmailEvent_campaignId_contactEmail_idx";
--
-- INSERT INTO "EmailEvent" (
--   "id", "clientId", "campaignId", "contactEmail", "eventType", "timestamp",
--   "mailgunId", "errorMessage", "metadata"
-- )
-- SELECT
--   b."id", b."clientId", b."campaignId", b."contactEmail",
--   (CASE WHEN b."eventType" = 'UNSUBSCRIBED' THEN 'COMPLAINED' ELSE b."eventType" END)::"EmailEventType",
--   b."timestamp", b."mailgunId", b."errorMessage", b."metadata"
-- FROM email_event_backup."EmailEvent_duplicates" b
-- -- rows whose client or campaign was deleted since the backup are skipped
-- WHERE EXISTS (SELECT 1 FROM "Client" c WHERE c."id" = b."clientId")
--   AND (b."campaignId" IS NULL OR EXISTS (SELECT 1 FROM "Campaign" c WHERE c."id" = b."campaignId"))
-- ON CONFLICT ("id") DO NOTHING;
--
-- ALTER TABLE "EmailEvent" DROP COLUMN IF EXISTS "mailgunEventId";
-- ALTER TABLE "EmailEvent" DROP COLUMN IF EXISTS "messageId";
-- ALTER TABLE "EmailEvent" DROP COLUMN IF EXISTS "severity";
--
-- After PART B, tell Prisma the migration is no longer applied:
--   npx prisma migrate resolve --rolled-back 20260925120000_email_event_idempotency

COMMIT;
