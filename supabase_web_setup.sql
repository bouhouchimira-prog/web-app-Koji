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

-- ── particulier_users_state (4 octobre) ──────────────────────────────────
-- Les comptes particuliers (Koji) vivaient jusqu'ici dans koji_web_state,
-- au milieu de tout le reste (offres, devis, historique...) — un simple
-- login devait donc transporter 1,27 Mo pour n'en utiliser que 21 Ko. Meme
-- principe de table que koji_web_state, juste dediee aux comptes (voir
-- lib/particulier-users.js), pour que les routes qui ne touchent QUE les
-- comptes (connexion Google, activation, profil) sautent completement le
-- gros bloc partage. Meme posture de securite : service_role uniquement.
CREATE TABLE IF NOT EXISTS particulier_users_state (
  id INT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE particulier_users_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON particulier_users_state FROM anon, authenticated;

-- ── radar_offer_drafts (9 octobre) ───────────────────────────────────────
-- Refonte du parcours de creation d'offre (Radar des Chantiers) en un seul
-- chat pilote par l'IA avec tool use (lib/radar-offer-draft.js,
-- app/api/radar-chat/route.js) : l'etat de l'offre en cours de collecte
-- doit pouvoir etre ecrit plusieurs fois par message (un appel d'outil =
-- une ecriture), donc PAS dans koji_web_state (1,27 Mo, reecrit en entier a
-- chaque sauvegarde) — une ligne par brouillon d'offre, ecrite directement,
-- jamais le gros blob partage. Meme posture de securite que les tables
-- ci-dessus : service_role uniquement, jamais d'acces direct anon/authenticated
-- (les comptes particuliers ne sont pas des comptes Supabase Auth).
CREATE TABLE IF NOT EXISTS radar_offer_drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_cours',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS radar_offer_drafts_user_id_idx ON radar_offer_drafts(user_id);
CREATE INDEX IF NOT EXISTS radar_offer_drafts_conversation_id_idx ON radar_offer_drafts(conversation_id);

ALTER TABLE radar_offer_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON radar_offer_drafts FROM anon, authenticated;

-- ── commandes (12 octobre) ───────────────────────────────────────────────
-- Nouvelle page d'accueil de l'outil Fournitures (tableau de bord) : une
-- commande passee aupres d'un fournisseur, pour un chantier, avec un
-- statut (a_commander / confirmee / expediee / livree / en_retard) et une
-- date de livraison. Table liee aux tables deja partagees avec l'app
-- Flutter (fournisseurs, chantiers) — meme posture de securite : service_role
-- uniquement.
CREATE TABLE IF NOT EXISTS commandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fournisseur_id UUID REFERENCES fournisseurs(id),
  chantier_id UUID REFERENCES chantiers(id),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  montant_ht NUMERIC NOT NULL DEFAULT 0,
  date_livraison DATE,
  statut TEXT NOT NULL DEFAULT 'a_commander',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commandes_user_id_idx ON commandes(user_id);

ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON commandes FROM anon, authenticated;

-- Seuil d'alerte de stock bas, par article (fournitures n'avait jusque-la
-- qu'une quantite, jamais de seuil a partir duquel la "recommander").
-- 0 = jamais signale (article pas encore configure).
ALTER TABLE fournitures ADD COLUMN IF NOT EXISTS seuil_alerte NUMERIC NOT NULL DEFAULT 0;
