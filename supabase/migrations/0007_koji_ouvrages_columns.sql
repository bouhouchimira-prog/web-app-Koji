-- Migration 0007 : colonnes code/original_id/hourly_rate/coefficient sur koji_ouvrages
-- Necessaires pour preserver le comportement du catalogue historique :
--  - code        : code metier (ex. PRE-INS-001), utilise par resolveTriggeredOuvrages
--  - original_id : id historique (ex. pre-ins-001), utilise par deletedOuvrages (masquage)

ALTER TABLE koji_ouvrages ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE koji_ouvrages ADD COLUMN IF NOT EXISTS original_id TEXT;
ALTER TABLE koji_ouvrages ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(12,2);
ALTER TABLE koji_ouvrages ADD COLUMN IF NOT EXISTS coefficient NUMERIC(8,4) DEFAULT 1;

-- Index unique COMPLET (pas de predicat WHERE) : requis pour que
-- `upsert(..., { onConflict: "code" })` fonctionne. Un index unique partiel
-- n'est pas reconnu par ON CONFLICT. Les NULL sont autorises en plusieurs
-- exemplaires dans un index unique PostgreSQL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_koji_ouvrages_code ON koji_ouvrages(code);
CREATE INDEX IF NOT EXISTS idx_koji_ouvrages_original_id ON koji_ouvrages(original_id);
