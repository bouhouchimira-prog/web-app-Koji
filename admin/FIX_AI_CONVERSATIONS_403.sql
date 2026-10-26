-- ============================================
-- CORRECTIF : 403 sur ai_conversations (26 octobre)
-- Trouve par un audit Selenium automatise du compte admin.
-- A executer dans l'editeur SQL Supabase.
-- ============================================
--
-- La migration du 25 octobre (table ai_conversations, voir
-- supabase_web_setup.sql cote koji-web) a fait un `REVOKE ALL ... FROM
-- anon, authenticated` puis cree une policy RLS de lecture pour
-- ablexpertrenov@gmail.com / bouhouchimira@gmail.com — mais sans jamais
-- re-accorder le privilege SELECT de base a `authenticated`. Resultat :
-- Postgres refuse la requete avant meme d'evaluer la policy RLS, donc
-- MEME les 2 comptes admin autorises recoivent un 403 "permission denied"
-- en lisant avec la cle anon (koji-admin). C'est pour ca que la page
-- Discussions affichait "Aucune conversation" et que le badge de la
-- sidebar echouait silencieusement sur TOUTES les pages — la table etait
-- bien peuplee, juste illisible par koji-admin depuis sa creation.

GRANT SELECT ON ai_conversations TO authenticated;
