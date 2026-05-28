-- ─────────────────────────────────────────────────────────────
-- Lurkollen — DPA signatures table
-- Run once in: Supabase → SQL Editor
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dpa_signatures (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id          uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id            uuid        NOT NULL,
  signer_name        text        NOT NULL,
  signed_at          timestamptz DEFAULT now() NOT NULL,
  agreement_version  text        NOT NULL DEFAULT 'v1.0',
  ip_address         text,
  user_agent         text
);

-- Each school can sign multiple versions; one row per school per version is enough
CREATE UNIQUE INDEX IF NOT EXISTS dpa_signatures_school_version
  ON dpa_signatures (school_id, agreement_version);

-- Allow the service role (used by the API) full access
ALTER TABLE dpa_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON dpa_signatures
  USING (true) WITH CHECK (true);
