-- Service agreement (Tjänsteavtal) signatures — run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS service_agreements (
  id                bigserial primary key,
  school_id         uuid not null references schools(id) on delete cascade,
  user_id           uuid references auth.users(id),
  agreement_version text not null,
  signed_at         timestamptz not null default now(),
  signer_name       text,
  signer_title      text,
  ip_address        text,
  user_agent        text
);

CREATE UNIQUE INDEX IF NOT EXISTS service_agreements_school_version_idx
  ON service_agreements (school_id, agreement_version);
