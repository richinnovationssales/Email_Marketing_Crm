# Email event idempotency migration (manual run)

Fixes the analytics mismatch where "delivered" exceeds "sent" and the bounce rate
goes above 100%. The database side of the fix:

- stops the same Mailgun webhook event from being stored twice (unique `mailgunEventId`),
- removes the duplicates already stored, after copying them to a backup schema,
- stores the Mailgun message id on every row so each outcome can be tied to its send,
- stores failure severity so temporary failures (retries) are not counted as bounces,
- adds `UNSUBSCRIBED` so unsubscribes are no longer counted as spam complaints.

Nothing existing is altered or dropped. Only new nullable columns, one enum value
and three indexes are added. The only rows removed are exact duplicates of a
Mailgun event, and each one is copied to `email_event_backup."EmailEvent_duplicates"` first.

## Files

| File | What it does | Changes data |
|---|---|---|
| `01_preflight.sql` | Checks version, size, duplicates, blockers | No |
| `02_apply_production.sql` | Runs the migration in one transaction with a write lock | Yes |
| `03_verify.sql` | Confirms every step worked | No |
| `04_rollback.sql` | Makes the data safe for the old code again, optional full undo | Yes |
| `../../migrations/20260925120000_email_event_idempotency/migration.sql` | The migration itself, used by `02_apply_production.sql` and by `prisma migrate deploy` on new databases | Yes |

## Requirements

- PostgreSQL 12 or newer (preflight check 1).
- `psql`, run from this directory, because `02_apply_production.sql` includes the
  migration file with `\ir`. For a GUI client, see the last section.
- A quiet period of a few minutes, with no campaign being sent.

## Order of operations

The order matters. The new backend code reads the new columns, so it must be
deployed **after** step 3. The old code works fine with the new columns, so
there is no downtime between steps 3 and 6.

1. **Back up the database.**
   ```bash
   pg_dump "$DATABASE_URL" -Fc -f before_email_event_idempotency.dump
   ```

2. **Preflight** (read-only). Save the output.
   ```bash
   psql "$DATABASE_URL" -f 01_preflight.sql | tee preflight_output.txt
   ```
   Continue only if:
   - check 1 shows `ok = t`,
   - check 4 returns **no rows**. If it returns rows, stop and share them. The
     migration would refuse to run anyway.
   - check 7 returns no rows (no campaign is sending),
   - check 8 shows no long-running transactions.

   Check 5 shows how many duplicate rows will be moved to the backup.

3. **Apply.**
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 02_apply_production.sql | tee apply_output.txt
   ```
   On a first run, `rows_after + backed_up_total` equals `rows_before`.
   If anything fails, the transaction rolls back and nothing is changed. Fix the
   cause and run it again.

4. **Verify** (read-only). Every check states its expected result.
   ```bash
   psql "$DATABASE_URL" -f 03_verify.sql | tee verify_output.txt
   ```

5. **Record the migration in Prisma's history,** so `prisma migrate deploy` doesn't try to run it again:
   ```bash
   npx prisma migrate resolve --applied 20260925120000_email_event_idempotency
   ```
   If this step is missed, a later `migrate deploy` re-runs the migration. That is
   harmless, because every statement is idempotent, but it would run without the lock.

6. **Deploy the backend** from branch `fix/analytics-delivered-mismatch`.

7. **Run the apply script once more,** then verify again. Rows the old code wrote
   between steps 3 and 6 have no event id or message id yet. This pass backfills
   them and removes any duplicates among them.
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 02_apply_production.sql
   psql "$DATABASE_URL" -f 03_verify.sql
   ```
   Check 5 in the verification must now show `0` and `0`.

8. **Recompute cached campaign totals** for every client:
   ```bash
   npm run analytics:recalculate:prod -- --dry-run   # preview
   npm run analytics:recalculate:prod                # write
   ```

9. **Deploy the frontend** from branch `fix/analytics-delivered-mismatch`.

10. **Fix the Mailgun webhook setup,** whenever convenient. Keep exactly one webhook
    URL per event type across account-level webhooks, the system domain and each
    client's custom domain. The code now ignores duplicates, but this removes them
    at the source.

11. **After one to two weeks,** once you're satisfied, drop the backup:
    ```sql
    DROP SCHEMA email_event_backup CASCADE;
    ```
    Keep it until then. The full undo in `04_rollback.sql` needs it.

## Locking and duration

`02_apply_production.sql` holds a lock on `"EmailEvent"` until it commits.
Queries on that table wait during the run, reads included. Nothing else is
locked. The run takes roughly seconds per few hundred thousand rows. Preflight
check 3 shows the table size. If the lock can't be acquired within 15 seconds,
the script gives up without changing anything. Mailgun retries webhooks that
time out, so no events are lost.

## What will change in the numbers

Delivered, bounced, opened and clicked are now counted once per email sent, for
the emails sent in the selected date range. Existing figures will drop. The
delivery rate will settle near the real value, and the bounce rate falls
well below 100%. Tell clients beforehand that earlier figures were inflated.

Legacy note: webhook rows stored before this change have no message id. They
are matched to their send by campaign, recipient and time, so the two cycles of a
recurring campaign are kept apart.

## Rollback

- **Rolling back the code only:** run `04_rollback.sql` as it is. It converts
  `UNSUBSCRIBED` rows back to `COMPLAINED`, the value the old code expects. The
  new columns and indexes don't affect the old code.
- **Full undo:** uncomment PART B in `04_rollback.sql`. It restores the removed
  duplicates from the backup and drops the new columns and indexes. This brings
  back the inflated numbers. Then run
  `npx prisma migrate resolve --rolled-back 20260925120000_email_event_idempotency`.
- **Last resort:** restore the `pg_dump` from step 1.

## Using a GUI client instead of psql

Turn off auto-commit and run the following as one script. Then run `COMMIT;`, or
`ROLLBACK;` if anything errored.

```sql
BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE "EmailEvent" IN SHARE ROW EXCLUSIVE MODE;
-- paste the full contents of
-- prisma/migrations/20260925120000_email_event_idempotency/migration.sql here
```

Run `01_preflight.sql` and `03_verify.sql` as they are. The `\echo` lines are
psql-only, so remove them or ignore the errors they cause.

## Tested

The full sequence ran on a copy of the current schema seeded with the production
failure patterns: duplicated webhooks, temporary-failure retries, recurring
cycles, sends just before the date window, and a second client. It covered a
first run, a re-run, the post-deploy re-run, the guard abort, both rollback
parts, re-apply after rollback, and a run of the Prisma migration on an empty
database. After the migration, `prisma migrate diff` reports no drift.
