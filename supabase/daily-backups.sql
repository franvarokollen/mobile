-- ─────────────────────────────────────────────────────────────
-- Lurkollen — Daily auto-backup via pg_cron
-- Run this once in: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- 1. Enable pg_cron (already on by default in Supabase, just in case)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Function that builds a snapshot for one school and saves it
CREATE OR REPLACE FUNCTION lurkollen_create_backup(p_school_id uuid, p_prefix text DEFAULT 'auto')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name    text;
  v_snapshot jsonb;
BEGIN
  v_name := p_prefix || '-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24-MI-SS');

  SELECT jsonb_build_object(
    'backedUpAt', now(),
    'students', COALESCE(
      (SELECT jsonb_object_agg(id::text, data)
         FROM students WHERE school_id = p_school_id),
      '{}'::jsonb
    ),
    'status', COALESCE(
      (SELECT jsonb_object_agg(date::text, day_data)
         FROM (
           SELECT date,
                  jsonb_object_agg(student_id::text, status) AS day_data
             FROM status_logs
            WHERE school_id = p_school_id
            GROUP BY date
         ) d),
      '{}'::jsonb
    ),
    'guardians', COALESCE(
      (SELECT jsonb_object_agg(student_id::text, data)
         FROM guardians WHERE school_id = p_school_id),
      '{}'::jsonb
    ),
    'extra', COALESCE(
      (SELECT jsonb_object_agg(student_id::text, data)
         FROM extra WHERE school_id = p_school_id),
      '{}'::jsonb
    ),
    'flags', COALESCE(
      (SELECT jsonb_object_agg(date::text, data)
         FROM flags WHERE school_id = p_school_id),
      '{}'::jsonb
    ),
    'settings', COALESCE(
      (SELECT data FROM settings WHERE school_id = p_school_id LIMIT 1),
      '{}'::jsonb
    )
  ) INTO v_snapshot;

  INSERT INTO backups (school_id, name, data, created_at)
  VALUES (p_school_id, v_name, v_snapshot, now())
  ON CONFLICT (school_id, name) DO NOTHING;

  -- Keep only the 30 most recent backups per school
  DELETE FROM backups
  WHERE school_id = p_school_id
    AND name NOT IN (
      SELECT name FROM backups
       WHERE school_id = p_school_id
       ORDER BY created_at DESC
       LIMIT 30
    );

  RETURN v_name;
END;
$$;

-- 3. Function that runs for all active schools
CREATE OR REPLACE FUNCTION lurkollen_daily_backups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM lurkollen_create_backup(id)
    FROM schools;
END;
$$;

-- 4. Schedule: runs every day at 02:00 UTC
--    (Remove any existing schedule first to avoid duplicates)
SELECT cron.unschedule('lurkollen-daily-backups');   -- safe to run even if it doesn't exist yet
SELECT cron.schedule(
  'lurkollen-daily-backups',
  '0 2 * * *',
  'SELECT lurkollen_daily_backups()'
);

-- To verify the schedule was created:
-- SELECT * FROM cron.job WHERE jobname = 'lurkollen-daily-backups';

-- To disable the schedule later:
-- SELECT cron.unschedule('lurkollen-daily-backups');
