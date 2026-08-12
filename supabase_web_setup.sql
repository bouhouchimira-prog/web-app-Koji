-- One-time setup for the koji web app (web-app-Koji-main).
-- Run this in the Supabase SQL editor of the shared project
-- (https://hbgqbpyufaajqmedxodg.supabase.co → SQL Editor → New query → Run).
--
-- The web app stores its whole application state as a single JSONB row,
-- read/written through lib/db.js. This table is separate from the tables
-- used by koji-admin and the koji-main Flutter app, so it does not
-- interfere with them.

CREATE TABLE IF NOT EXISTS koji_web_state (
  id INT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- This table holds nearly every personal-data collection in the app (users,
-- workers incl. their social security number, clients, quotes' plaintext
-- portal passwords, mail/SMS outbox, ...). It used to have permissive
-- USING (true) policies for the anon role, which is the key shipped to every
-- browser (NEXT_PUBLIC_SUPABASE_ANON_KEY) — anyone holding it could read or
-- overwrite the entire table directly against Supabase, bypassing the app's
-- own scoping logic entirely.
--
-- The app now reads/writes this table exclusively server-side with the
-- SUPABASE_SERVICE_ROLE_KEY (see lib/db.js), which bypasses RLS by design.
-- So RLS here just needs to deny the anon/authenticated roles outright —
-- enabling RLS with no policy for those roles does that by default; no
-- policy is created for them.
ALTER TABLE koji_web_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "koji_web_state_select" ON koji_web_state;
DROP POLICY IF EXISTS "koji_web_state_insert" ON koji_web_state;
DROP POLICY IF EXISTS "koji_web_state_update" ON koji_web_state;

REVOKE ALL ON koji_web_state FROM anon, authenticated;
