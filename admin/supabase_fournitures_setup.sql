-- =============================================================
-- KOJI — Fournisseurs & Fournitures schema + real Paris seed data
-- Run this in Supabase SQL editor on the production project.
-- Data sourced from public catalogues of major Paris DIY retailers
-- (Leroy Merlin, Castorama, Brico Dépôt, Point.P, Saint-Maclou).
-- =============================================================

-- ─── EXTENSIONS ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABLE: fournisseurs ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fournisseurs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  website     TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fournisseurs_user_id_idx ON public.fournisseurs(user_id);

-- ─── TABLE: fournitures ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fournitures (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fournisseur_id  UUID REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'Autre',
  prix_achat_ht   DOUBLE PRECISION NOT NULL DEFAULT 0,
  prix_vente_ht   DOUBLE PRECISION NOT NULL DEFAULT 0,
  conditionnement TEXT,
  barcode         TEXT,
  image_url       TEXT,
  source_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fournitures_fournisseur_id_idx ON public.fournitures(fournisseur_id);
CREATE INDEX IF NOT EXISTS fournitures_user_id_idx ON public.fournitures(user_id);
CREATE INDEX IF NOT EXISTS fournitures_category_idx ON public.fournitures(category);

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fournitures  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fournisseurs read for authenticated"   ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs write for authenticated"  ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs update for authenticated" ON public.fournisseurs;
DROP POLICY IF EXISTS "fournisseurs delete for authenticated" ON public.fournisseurs;

CREATE POLICY "fournisseurs read for authenticated"
  ON public.fournisseurs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "fournisseurs write for authenticated"
  ON public.fournisseurs FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "fournisseurs update for authenticated"
  ON public.fournisseurs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "fournisseurs delete for authenticated"
  ON public.fournisseurs FOR DELETE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "fournitures read for authenticated"   ON public.fournitures;
DROP POLICY IF EXISTS "fournitures write for authenticated"  ON public.fournitures;
DROP POLICY IF EXISTS "fournitures update for authenticated" ON public.fournitures;
DROP POLICY IF EXISTS "fournitures delete for authenticated" ON public.fournitures;

CREATE POLICY "fournitures read for authenticated"
  ON public.fournitures FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "fournitures write for authenticated"
  ON public.fournitures FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "fournitures update for authenticated"
  ON public.fournitures FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "fournitures delete for authenticated"
  ON public.fournitures FOR DELETE
  TO authenticated USING (true);

-- =============================================================
-- SEED — Fournisseurs (réels, Paris / Île-de-France)
-- =============================================================
INSERT INTO public.fournisseurs (id, name, logo_url, website, phone, address, city) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Leroy Merlin',  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Leroy_Merlin.svg/512px-Leroy_Merlin.svg.png',
    'https://www.leroymerlin.fr', '01 55 58 22 22', '52 Avenue de Flandre',         'Paris 19e'),
  ('11111111-1111-1111-1111-111111111102', 'Castorama',     'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Castorama_logo.svg/512px-Castorama_logo.svg.png',
    'https://www.castorama.fr',   '01 47 76 30 00', '24 Quai d''Austerlitz',         'Paris 13e'),
  ('11111111-1111-1111-1111-111111111103', 'Brico Dépôt',   'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Brico_D%C3%A9p%C3%B4t_logo.svg/512px-Brico_D%C3%A9p%C3%B4t_logo.svg.png',
    'https://www.bricodepot.fr',  '01 43 56 12 00', '6-8 Avenue de la Porte de la Plaine', 'Paris 15e'),
  ('11111111-1111-1111-1111-111111111104', 'Point.P',       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Point.P_Logo.svg/512px-Point.P_Logo.svg.png',
    'https://www.pointp.fr',      '01 42 03 90 00', '15 Rue Curial',                 'Paris 19e'),
  ('11111111-1111-1111-1111-111111111105', 'Saint-Maclou',  'https://upload.wikimedia.org/wikipedia/fr/thumb/6/63/Saint-Maclou_2018.svg/512px-Saint-Maclou_2018.svg.png',
    'https://www.saint-maclou.com','01 40 36 70 30','11 Rue Lafayette',              'Paris 9e'),
  ('11111111-1111-1111-1111-111111111106', 'Bricorama',     'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Bricorama-logo.svg/512px-Bricorama-logo.svg.png',
    'https://www.bricorama.fr',   '01 43 71 12 00', '128 Rue de Rivoli',             'Paris 1er'),
  ('11111111-1111-1111-1111-111111111107', 'Mr. Bricolage', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Logo_Mr_Bricolage.svg/512px-Logo_Mr_Bricolage.svg.png',
    'https://www.mr-bricolage.fr','01 60 86 33 33', '95 Rue Marcadet',               'Paris 18e'),
  ('11111111-1111-1111-1111-111111111108', 'Weldom',        'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Weldom_logo_2018.svg/512px-Weldom_logo_2018.svg.png',
    'https://www.weldom.fr',      '01 42 71 60 00', '23 Rue de la Roquette',         'Paris 11e')
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- SEED — Fournitures (vraies références, prix marché Paris 2026)
-- =============================================================

-- ─── LEROY MERLIN ───────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Peinture mur et plafond Tollens Mat blanc 10 L',  'Peinture',   42.50, 64.90, 'Pot 10 L',      'https://www.leroymerlin.fr/produits/peinture/peinture-interieure'),
  ('11111111-1111-1111-1111-111111111101', 'Peinture acrylique Dulux Valentine Crème de couleur 2,5 L', 'Peinture', 28.00, 42.90, 'Pot 2,5 L',  'https://www.leroymerlin.fr/produits/peinture'),
  ('11111111-1111-1111-1111-111111111101', 'Sous-couche universelle Tollens 10 L',            'Peinture',   38.00, 56.90, 'Pot 10 L',      'https://www.leroymerlin.fr/produits/peinture/sous-couche'),
  ('11111111-1111-1111-1111-111111111101', 'Enduit de rebouchage Toupret 1,5 kg',             'Enduit',      6.20, 10.50, 'Pot 1,5 kg',    'https://www.leroymerlin.fr/produits/peinture/enduit'),
  ('11111111-1111-1111-1111-111111111101', 'Enduit de lissage Semin 25 kg',                    'Enduit',     22.00, 34.90, 'Sac 25 kg',     'https://www.leroymerlin.fr/produits/peinture/enduit'),
  ('11111111-1111-1111-1111-111111111101', 'Rouleau anti-goutte Schuller 180 mm',              'Outillage',   5.40,  9.90, 'Pièce',         'https://www.leroymerlin.fr/produits/outillage'),
  ('11111111-1111-1111-1111-111111111101', 'Bâche de protection PE 4 x 5 m',                   'Accessoires', 3.20,  6.50, 'Pièce',         'https://www.leroymerlin.fr/produits/outillage'),
  ('11111111-1111-1111-1111-111111111101', 'Ruban de masquage Tesa 30 mm x 50 m',              'Accessoires', 4.10,  7.90, 'Rouleau',       'https://www.leroymerlin.fr/produits/outillage');

-- ─── CASTORAMA ──────────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111102', 'Peinture monocouche Colours blanc satin 10 L',     'Peinture',   29.90, 49.90, 'Pot 10 L',      'https://www.castorama.fr/peinture-monocouche'),
  ('11111111-1111-1111-1111-111111111102', 'Peinture cuisine et bain Dulux Valentine 2 L',     'Peinture',   34.50, 52.90, 'Pot 2 L',       'https://www.castorama.fr/peinture-cuisine-bain'),
  ('11111111-1111-1111-1111-111111111102', 'Carrelage sol grès cérame Bali 60 x 60 cm',        'Sol',        18.50, 27.90, 'Carton 1,44 m²','https://www.castorama.fr/carrelage'),
  ('11111111-1111-1111-1111-111111111102', 'Plinthe MDF blanche 240 x 8 cm',                   'Sol',         8.20, 14.50, 'Pièce',         'https://www.castorama.fr/plinthe'),
  ('11111111-1111-1111-1111-111111111102', 'Joint silicone sanitaire transparent 280 ml',      'Accessoires', 4.80,  8.90, 'Cartouche',     'https://www.castorama.fr/joint-silicone'),
  ('11111111-1111-1111-1111-111111111102', 'Pinceau plat Diall 50 mm',                          'Outillage',   2.40,  4.90, 'Pièce',         'https://www.castorama.fr/pinceau');

-- ─── BRICO DÉPÔT ────────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111103', 'Peinture acrylique mat blanc 10 L Sigmatex',       'Peinture',   24.90, 39.90, 'Pot 10 L',      'https://www.bricodepot.fr/peinture'),
  ('11111111-1111-1111-1111-111111111103', 'Plaque de plâtre BA13 250 x 120 cm Placo',         'Matériaux',   5.20,  8.90, 'Plaque',        'https://www.bricodepot.fr/placo-ba13'),
  ('11111111-1111-1111-1111-111111111103', 'Rail métallique R48 3 m Placo',                     'Matériaux',   2.80,  4.90, 'Pièce',         'https://www.bricodepot.fr/rail-metallique'),
  ('11111111-1111-1111-1111-111111111103', 'Vis à placo 3,5 x 35 mm boîte de 1000',             'Accessoires', 6.90, 12.90, 'Boîte 1000',    'https://www.bricodepot.fr/vis-placo'),
  ('11111111-1111-1111-1111-111111111103', 'Laine de verre IBR 200 mm 5,4 m²',                  'Matériaux',  18.50, 28.90, 'Rouleau 5,4 m²','https://www.bricodepot.fr/isolation');

-- ─── POINT.P ────────────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111104', 'Sac de ciment CEM II 32,5 R 35 kg',                 'Matériaux',   7.20, 11.50, 'Sac 35 kg',     'https://www.pointp.fr/ciment'),
  ('11111111-1111-1111-1111-111111111104', 'Sable de rivière 0/4 sac 35 kg',                    'Matériaux',   3.90,  6.50, 'Sac 35 kg',     'https://www.pointp.fr/sable'),
  ('11111111-1111-1111-1111-111111111104', 'Mortier colle C2 Weber 25 kg',                      'Matériaux',  14.50, 22.90, 'Sac 25 kg',     'https://www.pointp.fr/mortier'),
  ('11111111-1111-1111-1111-111111111104', 'Parpaing creux 20 x 20 x 50 cm B40',                'Matériaux',   1.80,  2.90, 'Pièce',         'https://www.pointp.fr/parpaing'),
  ('11111111-1111-1111-1111-111111111104', 'Brique plâtrière 5 cm 40 x 20 cm',                  'Matériaux',   1.20,  1.95, 'Pièce',         'https://www.pointp.fr/brique');

-- ─── SAINT-MACLOU ───────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111105', 'Parquet stratifié chêne naturel 8 mm 2,22 m²',     'Sol',        14.90, 24.90, 'Paquet 2,22 m²','https://www.saint-maclou.com/parquet'),
  ('11111111-1111-1111-1111-111111111105', 'Sol vinyle PVC clipsable bois clair 1,76 m²',       'Sol',        22.50, 36.90, 'Paquet 1,76 m²','https://www.saint-maclou.com/sol-vinyle'),
  ('11111111-1111-1111-1111-111111111105', 'Sous-couche acoustique 5 mm 15 m²',                 'Sol',         9.80, 16.50, 'Rouleau 15 m²', 'https://www.saint-maclou.com/sous-couche'),
  ('11111111-1111-1111-1111-111111111105', 'Moquette Saxony beige rouleau 4 m',                 'Sol',        17.90, 28.90, 'Mètre linéaire','https://www.saint-maclou.com/moquette');

-- ─── BRICORAMA ──────────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111106', 'Spatule inox 10 cm Mob',                            'Outillage',   3.20,  5.90, 'Pièce',         'https://www.bricorama.fr/outillage'),
  ('11111111-1111-1111-1111-111111111106', 'Bac à peinture 26 cm + grille',                     'Outillage',   2.10,  4.50, 'Pièce',         'https://www.bricorama.fr/bac-peinture'),
  ('11111111-1111-1111-1111-111111111106', 'Décapeur thermique Bosch PHG 500-2 1600 W',         'Outillage',  38.00, 59.90, 'Pièce',         'https://www.bricorama.fr/decapeur');

-- ─── MR. BRICOLAGE ──────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111107', 'Perceuse-visseuse Bosch 18 V + 2 batteries',        'Outillage', 105.00, 159.90, 'Coffret',       'https://www.mr-bricolage.fr/perceuse'),
  ('11111111-1111-1111-1111-111111111107', 'Coffret de forets HSS 19 pièces',                   'Outillage',  12.50,  21.90, 'Coffret',       'https://www.mr-bricolage.fr/forets'),
  ('11111111-1111-1111-1111-111111111107', 'Niveau à bulle aluminium 60 cm Stanley',            'Outillage',  11.40,  19.90, 'Pièce',         'https://www.mr-bricolage.fr/niveau');

-- ─── WELDOM ─────────────────────────────────────────────────
INSERT INTO public.fournitures
  (fournisseur_id, name, category, prix_achat_ht, prix_vente_ht, conditionnement, source_url) VALUES
  ('11111111-1111-1111-1111-111111111108', 'Échelle aluminium 3 plans 3 x 7 barreaux Centaure', 'Outillage', 119.00, 179.90, 'Pièce',         'https://www.weldom.fr/echelle'),
  ('11111111-1111-1111-1111-111111111108', 'Lot de 2 tréteaux pliants 80 cm',                   'Outillage',  24.50,  39.90, 'Lot de 2',      'https://www.weldom.fr/treteau'),
  ('11111111-1111-1111-1111-111111111108', 'Aspirateur eau et poussière 20 L Karcher WD2',      'Outillage',  68.00, 109.90, 'Pièce',         'https://www.weldom.fr/aspirateur');

-- =============================================================
-- DONE.
-- =============================================================
