-- =============================================================================
-- 02_apply_production.sql
-- Applies prisma/migrations/20260925120000_email_event_idempotency/migration.sql
-- inside ONE transaction with a write lock on "EmailEvent".
--
-- Run with psql from this directory (or pass the full path to -f):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 02_apply_production.sql
--
-- If anything fails, psql stops, the transaction is rolled back and the
-- database is exactly as it was before. It is safe to fix the cause and re-run.
--
-- While it runs, every query on "EmailEvent" waits, reads included: the
-- ALTER TABLE lock is held until COMMIT. Expect analytics pages to pause for
-- the duration (seconds for a few hundred thousand rows). Webhooks that time
-- out are retried by Mailgun, so none are lost. Run in a quiet period and do
-- not start a campaign send during the run.
-- =============================================================================

\set ON_ERROR_STOP on
\timing on

BEGIN;

-- Give up (and roll back) instead of queueing behind a long-running transaction.
SET LOCAL lock_timeout = '15s';

-- Block concurrent INSERT/UPDATE/DELETE on EmailEvent for the duration, so no
-- new duplicate can be written between the cleanup and the unique index.
LOCK TABLE "EmailEvent" IN SHARE ROW EXCLUSIVE MODE;

\echo '== Row counts before =='
SELECT COUNT(*) AS rows_before FROM "EmailEvent";

\ir ../../migrations/20260925120000_email_event_idempotency/migration.sql

\echo '== Row counts after (rows_after + backed_up_total should equal rows_before on a first run) =='
SELECT (SELECT COUNT(*) FROM "EmailEvent")                            AS rows_after,
       (SELECT COUNT(*) FROM email_event_backup."EmailEvent_duplicates") AS backed_up_total,
       (SELECT COUNT(*) FROM "EmailEvent" WHERE "mailgunEventId" IS NOT NULL) AS rows_with_event_id,
       (SELECT COUNT(*) FROM "EmailEvent" WHERE "eventType" = 'SENT' AND "messageId" IS NOT NULL) AS sent_rows_with_message_id;

COMMIT;

\echo '== Done. Now run 03_verify.sql =='
