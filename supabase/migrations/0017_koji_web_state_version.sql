-- 0017 — Version optimiste pour koji_web_state (lot P1-4)
--
-- Ajoute une colonne `version` (entier monotone) à koji_web_state et
-- particulier_users_state, pour permettre un verrouillage optimiste dans
-- lib/db.js : une écriture est refusée si la version en base a changé depuis
-- la lecture (conflit concurrent), au lieu d'écraser silencieusement.
--
-- À exécuter dans Supabase → SQL Editor. Aucune donnée n'est modifiée.

ALTER TABLE koji_web_state
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;

ALTER TABLE particulier_users_state
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0;

-- Initialiser la version à 0 pour les lignes existantes (déjà par défaut).
UPDATE koji_web_state SET version = 0 WHERE version IS NULL;
UPDATE particulier_users_state SET version = 0 WHERE version IS NULL;
