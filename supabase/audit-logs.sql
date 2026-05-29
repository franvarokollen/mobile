-- Audit log table — run once in Supabase SQL Editor
-- Stores every status change: who changed what, from/to, when

CREATE TABLE IF NOT EXISTS audit_logs (
  id          bigserial primary key,
  school_id   uuid not null references schools(id) on delete cascade,
  date        date not null,
  student_id  text not null,
  old_status  text,
  new_status  text,
  changed_by  text,
  changed_at  timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS audit_logs_school_date_idx
  ON audit_logs (school_id, changed_at desc);
