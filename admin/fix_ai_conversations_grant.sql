-- ============================================
-- FIX : GRANT SELECT sur ai_conversations
-- (signalé par l'audit koji-admin : la table existait mais le SELECT
--  etait refuse pour le role anon/authenticated)
-- ============================================

-- Verifier l'etat actuel :
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
-- WHERE table_name = 'ai_conversations';

-- Accorder le SELECT au role authenticated (koji-admin lit avec la cle anon
-- + session utilisateur ; la RLS fait le filtrage par email admin).
GRANT SELECT ON ai_conversations TO authenticated;

-- S'assurer que la RLS est active et qu'une policy admin existe.
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_conversations admin read" ON ai_conversations;
CREATE POLICY "ai_conversations admin read" ON ai_conversations
  FOR SELECT USING (auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com');

-- VERIFIER :
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'ai_conversations';
