-- =============================================================================
-- 01_preflight.sql  (READ-ONLY: changes nothing)
-- Run before 02_apply_production.sql and save the output.
--   psql "$DATABASE_URL" -f 01_preflight.sql > preflight_output.txt
-- =============================================================================

\echo '== 1. PostgreSQL version (must be 12 or newer: server_version_num >= 120000) =='
SELECT current_setting('server_version') AS server_version,
       current_setting('server_version_num')::int AS server_version_num,
       current_setting('server_version_num')::int >= 120000 AS ok;

\echo '== 2. Already applied? (all false on first run) =='
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'EmailEvent' AND column_name = 'mailgunEventId') AS has_mailgunEventId,
  EXISTS (SELECT 1 FROM pg_indexes
          WHERE indexname = 'EmailEvent_mailgunEventId_key')                  AS has_unique_index,
  EXISTS (SELECT 1 FROM information_schema.schemata
          WHERE schema_name = 'email_event_backup')                           AS has_backup_schema;

\echo '== 3. Table size and rows per event type (record these numbers) =='
SELECT pg_size_pretty(pg_total_relation_size('"EmailEvent"')) AS total_size,
       (SELECT COUNT(*) FROM "EmailEvent")                       AS total_rows;

SELECT "eventType", COUNT(*) AS row_count
FROM "EmailEvent"
GROUP BY "eventType"
ORDER BY "eventType";

\echo '== 4. Guard check: event ids shared by different event types or recipients (must return 0 rows) =='
SELECT "mailgunId" AS event_key,
       COUNT(*) AS row_count,
       array_agg(DISTINCT "eventType"::text) AS event_types,
       array_agg(DISTINCT "contactEmail") AS recipients
FROM "EmailEvent"
WHERE "eventType" <> 'SENT' AND "mailgunId" IS NOT NULL
GROUP BY 1
HAVING COUNT(DISTINCT "eventType") > 1 OR COUNT(DISTINCT "contactEmail") > 1
LIMIT 50;

\echo '== 5. Duplicate webhook rows that will be moved to the backup schema =='
SELECT "eventType",
       COUNT(*)                                AS row_count,
       COUNT(DISTINCT "mailgunId")             AS distinct_events,
       COUNT(*) - COUNT(DISTINCT "mailgunId")  AS rows_to_remove
FROM "EmailEvent"
WHERE "eventType" <> 'SENT' AND "mailgunId" IS NOT NULL
GROUP BY "eventType"
ORDER BY "eventType";

\echo '== 6. Webhook rows with no event id (left untouched) =='
SELECT "eventType", COUNT(*) AS row_count
FROM "EmailEvent"
WHERE "eventType" <> 'SENT' AND "mailgunId" IS NULL
GROUP BY "eventType";

\echo '== 7. Campaigns currently sending (should be 0 rows before you run the migration) =='
SELECT id, name, status, "updatedAt"
FROM "Campaign"
WHERE status = 'SENDING';

\echo '== 8. Sessions that could block the write lock (long transactions touching the DB) =='
SELECT pid, state, now() - xact_start AS xact_age, left(query, 120) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND xact_start IS NOT NULL
  AND now() - xact_start > interval '30 seconds'
ORDER BY xact_start;
