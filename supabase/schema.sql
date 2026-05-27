-- Mobilkollen Online — Supabase Schema
-- Run this in your Supabase project: SQL Editor → New Query → paste → Run
-- https://app.supabase.com → your project → SQL Editor

-- ── STUDENTS ──────────────────────────────────────────────────────────────────
-- Stores the full student object as JSONB. school_id isolates each school's data.
create table if not exists students (
  school_id text not null default 'default',
  id        text not null,
  data      jsonb not null default '{}',
  primary key (school_id, id)
);

-- ── DAILY STATUS LOGS ─────────────────────────────────────────────────────────
-- One row per (school, date, student) — status is any configured key (no CHECK constraint so custom statuses work)
create table if not exists status_logs (
  school_id  text not null default 'default',
  date       date not null,
  student_id text not null,
  status     text not null,
  primary key (school_id, date, student_id)
);
-- If you have an existing deployment, run this once to drop the old check constraint:
-- ALTER TABLE status_logs DROP CONSTRAINT IF EXISTS status_logs_status_check;

-- Auto-purge logs older than 90 days (matches original server behaviour)
-- Supabase doesn't run cron natively on free tier — call this from your app or a pg_cron job
-- create extension if not exists pg_cron;
-- select cron.schedule('purge-old-logs', '0 2 * * *', $$
--   delete from status_logs where date < now() - interval '90 days';
-- $$);

-- ── GUARDIANS ─────────────────────────────────────────────────────────────────
-- One row per student per school. data = { fname1, lname1, mobile1, email1, ... }
create table if not exists guardians (
  school_id  text not null default 'default',
  student_id text not null,
  data       jsonb not null default '{}',
  primary key (school_id, student_id)
);

-- ── EXTRA FLAGS ───────────────────────────────────────────────────────────────
-- Per-student per-school extras: slots, starred, athome, keepphone
create table if not exists extra (
  school_id  text not null default 'default',
  student_id text not null,
  data       jsonb not null default '{}',
  primary key (school_id, student_id)
);

-- ── ABSENCE FLAGS ─────────────────────────────────────────────────────────────
-- Per-date flags: explained / unreported markers (stored as JSONB blob per date)
create table if not exists flags (
  school_id text not null default 'default',
  date      date not null,
  data      jsonb not null default '{}',
  primary key (school_id, date)
);

-- ── SETTINGS ─────────────────────────────────────────────────────────────────
-- One row per school — stores configurable settings (statuses, flags, class list, etc.)
create table if not exists settings (
  school_id text not null default 'default',
  data      jsonb not null default '{}',
  primary key (school_id)
);

-- ── BACKUPS ───────────────────────────────────────────────────────────────────
create table if not exists backups (
  school_id  text not null default 'default',
  name       text not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (school_id, name)
);

-- ── ADMIN METADATA ───────────────────────────────────────────────────────────
-- Internal company tracking per school — never exposed to school users
create table if not exists admin_school_meta (
  school_id       text primary key,
  display_name    text,
  status          text not null default 'trial',   -- trial | active | suspended | churned
  contact_name    text not null default '',
  contact_email   text not null default '',
  contact_phone   text not null default '',
  contract_signed boolean not null default false,
  contract_date   date,
  gdpr_signed     boolean not null default false,
  gdpr_date       date,
  billing_added   boolean not null default false,
  billing_ref     text not null default '',
  onboarded       boolean not null default false,
  onboarded_date  date,
  license_seats   integer not null default 0,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── ROW LEVEL SECURITY (enable now, add policies when SSO is ready) ────────────
alter table students    enable row level security;
alter table status_logs enable row level security;
alter table guardians   enable row level security;
alter table extra       enable row level security;
alter table flags       enable row level security;
alter table backups     enable row level security;
alter table settings    enable row level security;

-- TEMPORARY: allow all access via service_role key (your API functions use this)
-- When you add SSO, replace these with per-user policies.
create policy "service_role full access on students"
  on students for all using (true) with check (true);
create policy "service_role full access on status_logs"
  on status_logs for all using (true) with check (true);
create policy "service_role full access on guardians"
  on guardians for all using (true) with check (true);
create policy "service_role full access on extra"
  on extra for all using (true) with check (true);
create policy "service_role full access on flags"
  on flags for all using (true) with check (true);
create policy "service_role full access on backups"
  on backups for all using (true) with check (true);
create policy "service_role full access on settings"
  on settings for all using (true) with check (true);
