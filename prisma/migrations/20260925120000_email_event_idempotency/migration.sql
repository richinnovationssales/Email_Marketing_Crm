-- =============================================================================
-- Email event idempotency + analytics correctness
-- =============================================================================
-- What this does
--   1. Adds nullable columns "mailgunEventId", "messageId", "severity" to "EmailEvent"
--      and the enum value UNSUBSCRIBED. Nothing existing is altered or dropped.
--   2. Copies duplicate webhook rows (same Mailgun event id stored more than once)
--      into the separate schema "email_event_backup", then removes them from
--      "EmailEvent", keeping the earliest copy of each event.
--   3. Backfills "mailgunEventId" for webhook rows and "messageId" for SENT rows.
--   4. Adds a UNIQUE index on "mailgunEventId" and two lookup indexes.
--
-- Safety properties
--   * Idempotent: every step can run again. Re-running after the new code is
--     deployed sweeps up rows written by the old code in between.
--   * Aborts with no changes if any Mailgun event id is shared by rows with a
--     different event type or recipient (that would mean the id is not an event id).
--   * No row is deleted without first being copied to email_event_backup.
--   * Requires PostgreSQL 12+ (ALTER TYPE ... ADD VALUE inside a transaction).
--
-- Production: run via prisma/manual/2026-09-25-email-event-idempotency/02_apply_production.sql
-- (adds a transaction and a write lock around this same SQL). See 00_README.txt there.
-- =============================================================================

-- 1. Schema additions --------------------------------------------------------
ALTER TYPE "EmailEventType" ADD VALUE IF NOT EXISTS 'UNSUBSCRIBED';

ALTER TABLE "EmailEvent" ADD COLUMN IF NOT EXISTS "mailgunEventId" TEXT;
ALTER TABLE "EmailEvent" ADD COLUMN IF NOT EXISTS "messageId" TEXT;
ALTER TABLE "EmailEvent" ADD COLUMN IF NOT EXISTS "severity" TEXT;

-- 2. Guard: the dedupe key must identify exactly one event --------------------
DO $$
DECLARE
  conflicting BIGINT;
BEGIN
  SELECT COUNT(*) INTO conflicting
  FROM (
    SELECT COALESCE("mailgunEventId", "mailgunId") AS event_key
    FROM "EmailEvent"
    WHERE "eventType" <> 'SENT'
      AND COALESCE("mailgunEventId", "mailgunId") IS NOT NULL
    GROUP BY 1
    HAVING COUNT(DISTINCT "eventType") > 1
        OR COUNT(DISTINCT "contactEmail") > 1
  ) t;

  IF conflicting > 0 THEN
    RAISE EXCEPTION
      'Aborting: % Mailgun event id(s) are shared by rows with a different event type or recipient. Nothing was changed. Run 01_preflight.sql check 4 to inspect them.',
      conflicting;
  END IF;
END $$;

-- 3. Back up and remove duplicate webhook rows --------------------------------
CREATE SCHEMA IF NOT EXISTS email_event_backup;

CREATE TABLE IF NOT EXISTS email_event_backup."EmailEvent_duplicates" (
  "id"             TEXT PRIMARY KEY,
  "clientId"       TEXT NOT NULL,
  "campaignId"     TEXT,
  "contactEmail"   TEXT NOT NULL,
  "eventType"      TEXT NOT NULL,
  "timestamp"      TIMESTAMP(3) NOT NULL,
  "mailgunId"      TEXT,
  "errorMessage"   TEXT,
  "metadata"       TEXT,
  "mailgunEventId" TEXT,
  "messageId"      TEXT,
  "severity"       TEXT,
  "keptId"         TEXT NOT NULL,          -- the row that was kept for this event
  "backedUpAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

WITH ranked AS (
  SELECT
    "id",
    FIRST_VALUE("id") OVER w AS kept_id,
    ROW_NUMBER()      OVER w AS rn
  FROM "EmailEvent"
  WHERE "eventType" <> 'SENT'
    AND COALESCE("mailgunEventId", "mailgunId") IS NOT NULL
  WINDOW w AS (
    PARTITION BY COALESCE("mailgunEventId", "mailgunId")
    ORDER BY ("mailgunEventId" IS NULL), "timestamp", "id"
  )
),
removed AS (
  DELETE FROM "EmailEvent" e
  USING ranked r
  WHERE e."id" = r."id" AND r.rn > 1
  RETURNING e.*, r.kept_id
)
INSERT INTO email_event_backup."EmailEvent_duplicates" (
  "id", "clientId", "campaignId", "contactEmail", "eventType", "timestamp",
  "mailgunId", "errorMessage", "metadata", "mailgunEventId", "messageId",
  "severity", "keptId"
)
SELECT
  "id", "clientId", "campaignId", "contactEmail", "eventType"::TEXT, "timestamp",
  "mailgunId", "errorMessage", "metadata", "mailgunEventId", "messageId",
  "severity", kept_id
FROM removed
ON CONFLICT ("id") DO NOTHING;

-- 4. Backfill new columns ------------------------------------------------------
-- Webhook rows: the legacy "mailgunId" column holds the Mailgun event id.
UPDATE "EmailEvent"
SET "mailgunEventId" = "mailgunId"
WHERE "eventType" <> 'SENT'
  AND "mailgunEventId" IS NULL
  AND "mailgunId" IS NOT NULL;

-- SENT rows: the legacy "mailgunId" column holds the batch message id "<id@domain>".
-- Store it without angle brackets, the form webhook payloads use.
UPDATE "EmailEvent"
SET "messageId" = NULLIF(btrim(btrim(btrim("mailgunId"), '<>')), '')
WHERE "eventType" = 'SENT'
  AND "messageId" IS NULL
  AND "mailgunId" IS NOT NULL;

-- 5. Indexes (names match what Prisma generates for schema.prisma) -------------
CREATE UNIQUE INDEX IF NOT EXISTS "EmailEvent_mailgunEventId_key"
  ON "EmailEvent"("mailgunEventId");

CREATE INDEX IF NOT EXISTS "EmailEvent_messageId_contactEmail_idx"
  ON "EmailEvent"("messageId", "contactEmail");

CREATE INDEX IF NOT EXISTS "EmailEvent_campaignId_contactEmail_idx"
  ON "EmailEvent"("campaignId", "contactEmail");
