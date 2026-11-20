-- 0014 — Table des urgences (maquette PRO-17, 20 novembre 2026)
--
-- Jusqu'ici les urgences vivaient dans le gros bloc JSON (koji_web_state), où
-- la dernière écriture gagne : deux artisans qui acceptaient la même urgence
-- au même instant pouvaient tous deux croire l'avoir obtenue.
--
-- Chaque urgence a maintenant sa ligne, avec un numéro de version. Le site
-- n'écrit une ligne que si elle est encore à la version qu'il a lue
-- (UPDATE ... WHERE id = ... AND version = ...) : la base ne laisse passer
-- qu'une seule des deux acceptations, l'autre reçoit « déjà prise par un
-- autre artisan ». Voir lib/urgences-stock.js.
--
-- Sans risque : le site garde l'ancien fonctionnement tant que cette table
-- n'existe pas, et bascule tout seul (en moins d'une minute) une fois ce
-- script exécuté. Les urgences déjà présentes dans le bloc sont recopiées ici
-- sans être modifiées ; le bloc lui-même n'est pas touché par ce script.
-- Peut être exécuté plusieurs fois.
-- À exécuter dans Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS public.urgences (
  id          text PRIMARY KEY,
  client_id   text NOT NULL,
  artisan_id  text,
  statut      text NOT NULL,
  version     integer NOT NULL DEFAULT 1,
  donnees     jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS urgences_statut_idx  ON public.urgences (statut);
CREATE INDEX IF NOT EXISTS urgences_client_idx  ON public.urgences (client_id);
CREATE INDEX IF NOT EXISTS urgences_artisan_idx ON public.urgences (artisan_id);
CREATE INDEX IF NOT EXISTS urgences_updated_idx ON public.urgences (updated_at DESC);

-- Lecture et écriture par le serveur seulement (clé de service), comme
-- koji_web_state : aucune règle pour les rôles anon et authenticated, qui
-- n'ont donc accès à rien (adresse et téléphone des particuliers).
ALTER TABLE public.urgences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.urgences FROM anon, authenticated;

-- Reprise des urgences déjà enregistrées dans le bloc (lecture seule du bloc).
INSERT INTO public.urgences (id, client_id, artisan_id, statut, donnees, created_at)
SELECT
  u->>'id',
  COALESCE(u->>'clientId', ''),
  NULLIF(u->'artisan'->>'userId', ''),
  COALESCE(u->>'statut', ''),
  u,
  COALESCE(NULLIF(u->>'createdAt', '')::timestamptz, now())
FROM public.koji_web_state s,
     jsonb_array_elements(
       CASE WHEN jsonb_typeof(s.data->'urgences') = 'array' THEN s.data->'urgences' ELSE '[]'::jsonb END
     ) AS u
WHERE s.id = 1
  AND COALESCE(u->>'id', '') <> ''
ON CONFLICT (id) DO NOTHING;
