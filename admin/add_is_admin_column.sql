-- ============================================
-- IS_ADMIN — flag admin sur la table users
-- Remplace la dependance a la liste d'emails codee en dur (lib/auth.js
-- ADMIN_EMAILS) par un flag en base, extensible a plusieurs admins.
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- Marquer les 2 admins historiques
UPDATE users SET is_admin = true
WHERE email IN ('bouhouchimira@gmail.com', 'ablexpertrenov@gmail.com');

-- Index pour les lookups
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
