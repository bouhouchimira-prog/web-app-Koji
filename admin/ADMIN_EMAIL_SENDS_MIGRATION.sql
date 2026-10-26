-- ============================================
-- TABLE admin_email_sends (25 octobre)
-- A executer dans l'editeur SQL Supabase
-- ============================================
--
-- Journal des envois reels depuis la page Communications de koji-admin
-- (remplace l'"Historique recent" aujourd'hui entierement invente). Meme
-- barriere RLS que les autres tables koji-admin : seul
-- ablexpertrenov@gmail.com peut lire/ecrire.

CREATE TABLE IF NOT EXISTS admin_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  segment TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_email_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only ablexpertrenov can read admin_email_sends" ON admin_email_sends;
DROP POLICY IF EXISTS "Only ablexpertrenov can insert admin_email_sends" ON admin_email_sends;

CREATE POLICY "Only ablexpertrenov can read admin_email_sends" ON admin_email_sends
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
CREATE POLICY "Only ablexpertrenov can insert admin_email_sends" ON admin_email_sends
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');
