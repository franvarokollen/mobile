-- Super admins — users authorized to access /admin panel
-- Run once in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS super_admins (
  id          bigserial primary key,
  email       text not null unique,
  name        text,
  created_at  timestamptz not null default now(),
  created_by  text  -- email of the admin who added this person
);

-- !! IMPORTANT: seed your own email first, THEN log in !!
-- Replace with your actual Google-authed email:
-- INSERT INTO super_admins (email, name) VALUES ('you@yourcompany.se', 'Your Name');
