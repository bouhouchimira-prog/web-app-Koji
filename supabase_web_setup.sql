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

-- The web app's API routes connect with the publishable (anon) key,
-- so allow anon read/write on this table.
ALTER TABLE koji_web_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "koji_web_state_select" ON koji_web_state;
DROP POLICY IF EXISTS "koji_web_state_insert" ON koji_web_state;
DROP POLICY IF EXISTS "koji_web_state_update" ON koji_web_state;

CREATE POLICY "koji_web_state_select" ON koji_web_state
  FOR SELECT USING (true);

CREATE POLICY "koji_web_state_insert" ON koji_web_state
  FOR INSERT WITH CHECK (true);

CREATE POLICY "koji_web_state_update" ON koji_web_state
  FOR UPDATE USING (true) WITH CHECK (true);
