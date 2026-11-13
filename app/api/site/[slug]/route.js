import { badRequest, ok } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { buildWebUser } from "../../../../lib/user-profile";
import { publicSiteView } from "../../../../lib/company-sites";
import { statsAvis } from "../../../../lib/avis";

// Route PUBLIQUE (aucune session requise pour un site publié) — meme
// principe que app/api/signatures/[token]/route.js : resolution par un
// identifiant public (ici le slug), jamais d'id invente, jamais de champ
// sensible expose (publicSiteView filtre deja SIRET/IBAN/etc.). Le profil
// entreprise (nom/logo/telephone/adresse) vit dans la table Supabase
// partagee `users` (colonne business_info JSONB, voir lib/user-profile.js),
// pas dans le blob JSON — service_role requis ici puisque le visiteur n'a
// aucune session.
//
// Un site NON publie reste consultable par sa propre proprietaire (bouton
// "Aperçu" depuis app/profil/page.jsx, 23 septembre) — session verifiee
// requise dans ce cas uniquement, jamais pour un site deja publie.
export async function GET(request, context) {
  const { slug } = await context.params;
  const db = await readDb();
  const site = db.companySites.find((item) => item.slug === slug);
  if (!site) return badRequest("Ce site n'existe pas ou n'est plus publié.", 404);

  if (!site.published) {
    const viewerId = await getVerifiedUserId(request);
    if (!viewerId || viewerId !== site.userId) {
      return badRequest("Ce site n'existe pas ou n'est plus publié.", 404);
    }
  }

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase.from("users").select("email, business_info").eq("id", site.userId).maybeSingle();
  const webUser = buildWebUser({ id: site.userId, email: profile?.email || "", profile });

  // Avis des clients (PRO-02.6) : tous publiés, positifs comme négatifs,
  // avec la réponse de l'entreprise ; jamais d'e-mail ni de nom complet.
  const avis = (db.avis || []).filter((a) => a.userId === site.userId).sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe)));
  return ok({
    site: {
      ...publicSiteView(site, webUser.business, webUser.professions),
      published: site.published,
      avis: avis.map((a) => ({ id: a.id, auteur: a.auteur, note: a.note, criteres: a.criteres || {}, texte: a.texte || "", date: a.creeLe, verifie: Boolean(a.verifie), reponse: a.reponse?.texte || "" })),
      avisStats: statsAvis(avis)
    }
  });
}
