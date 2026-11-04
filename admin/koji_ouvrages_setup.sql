-- ============================================
-- KOJI_OUVRAGES — catalogue partage web <-> mobile
-- Source unique pour le catalogue d'ouvrages (remplace progressivement
-- data/catalog-ouvrages.json et le blob kojiOuvrages).
-- ============================================

CREATE TABLE IF NOT EXISTS koji_ouvrages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_shared BOOLEAN NOT NULL DEFAULT false,        -- true = ouvrage partage (admin)
  famille TEXT NOT NULL,
  label TEXT NOT NULL,
  unite TEXT,
  prix_unitaire_ht NUMERIC(12,2),
  temps_unitaire NUMERIC(8,4),
  metier TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE koji_ouvrages ENABLE ROW LEVEL SECURITY;

-- Chaque utilisateur lit ses propres ouvrages + les ouvrages partages
CREATE POLICY "koji_ouvrages_select" ON koji_ouvrages
  FOR SELECT USING (
    user_id = auth.uid()
    OR is_shared = true
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );

-- Chaque utilisateur ecrit ses propres ouvrages
CREATE POLICY "koji_ouvrages_insert" ON koji_ouvrages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "koji_ouvrages_update" ON koji_ouvrages
  FOR UPDATE USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );

CREATE POLICY "koji_ouvrages_delete" ON koji_ouvrages
  FOR DELETE USING (
    user_id = auth.uid()
    OR auth.jwt() ->> 'email' = 'ablexpertrenov@gmail.com'
  );

-- Index pour la recherche par famille / metier
CREATE INDEX IF NOT EXISTS idx_koji_ouvrages_famille ON koji_ouvrages(famille);
CREATE INDEX IF NOT EXISTS idx_koji_ouvrages_metier ON koji_ouvrages(metier);
CREATE INDEX IF NOT EXISTS idx_koji_ouvrages_shared ON koji_ouvrages(is_shared) WHERE is_shared = true;
