-- Migration 0006 : colonnes typees sur users (unification source de verite)

ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'entreprise';
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS portal_identifier TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Marquer les comptes existants
UPDATE users SET account_type = 'entreprise' WHERE is_pro = true AND account_type IS NULL;
UPDATE users SET account_type = 'particulier' WHERE is_pro = false AND account_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
