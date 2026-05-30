-- Billing records — run once in Supabase SQL Editor
-- One row per school per calendar month

CREATE TABLE IF NOT EXISTS billing_records (
  id              bigserial primary key,
  school_id       uuid not null references schools(id) on delete cascade,
  year            integer not null,
  month           integer not null,          -- 1–12
  student_count   integer not null default 0, -- snapshotted at generation time
  fee_setup       numeric(10,2) not null default 0,  -- one-time, manually toggled
  fee_monthly     numeric(10,2) not null default 0,
  fee_per_student numeric(10,2) not null default 0,
  fee_support     numeric(10,2) not null default 0,
  fee_additional  numeric(10,2) not null default 0,
  notes           text,
  status          text not null default 'draft', -- draft | sent | paid
  generated_at    timestamptz not null default now(),
  sent_at         timestamptz,
  paid_at         timestamptz,
  UNIQUE (school_id, year, month)
);

CREATE INDEX IF NOT EXISTS billing_records_period_idx
  ON billing_records (year, month);
