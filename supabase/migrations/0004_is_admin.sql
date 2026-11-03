-- Migration 0004 : colonne is_admin sur users (remplace la liste d'emails)

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

UPDATE users SET is_admin = true
WHERE email IN ('bouhouchimira@gmail.com', 'ablexpertrenov@gmail.com');

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
