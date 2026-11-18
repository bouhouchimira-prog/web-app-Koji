import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { buildWebUser } from "../../../../lib/user-profile";
import { publicSiteView } from "../../../../lib/company-sites";
import { statsAvis } from "../../../../lib/avis";
import { couleurDe, delaiReponseMoyen, libellePrix, offreKojiPage, photosRealisation, sectionsDe, statutRealisation, verifications } from "../../../../lib/kojipage";
import { compterVisite, demandesDe, refsDuSite, urlsPhotos, urlPublique } from "../../../../lib/kojipage-serveur";
import { contenuCarte } from "../../../../lib/kojipage-carte";

// KojiPage publique (maquette PRO-13.2) — route PUBLIQUE, aucune session
// pour une page en ligne. Sert la version PUBLIÉE (« Publier les
// modifications ») ; le propriétaire voit son brouillon avec ?apercu=1.
// Une ancienne adresse renvoie la nouvelle. Jamais de SIRET complet,
// d'IBAN ni de champ interne : seulement ce qu'un visiteur doit voir.
export async function GET(request, context) {
  const { slug } = await context.params;
  const params = new URL(request.url).searchParams;
  const db = await readDb();
  let site = (db.companySites || []).find((item) => item.slug === slug);
  if (!site) {
    const ancien = (db.companySites || []).find((item) => (item.anciensSlugs || []).includes(slug));
    if (ancien?.published) return ok({ redirect: ancien.slug });
    return badRequest("Ce site n'existe pas ou n'est plus publié.", 404);
  }

  const viewerId = await getVerifiedUserId(request).catch(() => null);
  const proprietaire = viewerId && viewerId === site.userId;
  if (!site.published && !proprietaire) return badRequest("Ce site n'existe pas ou n'est plus publié.", 404);

  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase.from("users").select("*").eq("id", site.userId).maybeSingle();
  const webUser = buildWebUser({ id: site.userId, email: profile?.email || "", profile });
  const offre = offreKojiPage(webUser);

  // Contenu : la version publiée, ou le brouillon en aperçu pour le propriétaire.
  const contenu = proprietaire && params.get("apercu") ? site : { ...site, ...(site.publie || {}) };
  if (!proprietaire) {
    compterVisite(db, site, { source: params.get("src") === "carte" ? "carte" : "" });
    await writeDb(db).catch(() => null);
  }

  const urls = await urlsPhotos(refsDuSite({ ...contenu, publie: null }));
  const sections = sectionsDe(contenu);
  const avis = offre.avis && sections.avis ? (db.avis || []).filter((a) => a.userId === site.userId).sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe))) : [];
  const verif = verifications(webUser.business || {});
  const b = webUser.business || {};
  const vue = publicSiteView(contenu, b, webUser.professions);
  const delai = delaiReponseMoyen(demandesDe(db, site.userId));
  return ok({
    site: {
      ...vue,
      published: site.published,
      apercu: Boolean(proprietaire && params.get("apercu")),
      url: urlPublique(site.slug),
      couleur: couleurDe(offre.couleur ? contenu.couleur : "marine"),
      sections: { ...sections, formulaire: sections.formulaire && offre.demandes && contenu.showContactForm !== false, avis: sections.avis && offre.avis },
      indexable: site.indexable !== false,
      dirigeant: contenu.contactName || "",
      photoDirigeant: urls[contenu.contactPhotoDataUrl] || "",
      realisations: (contenu.realisations || []).filter((r) => statutRealisation(r) === "publiee").map((r) => {
        const p = photosRealisation(r);
        return { id: r.id, name: r.name, lieu: r.lieu || "", duree: r.duree || "", texte: r.texte || "", avant: p.avant.map((x) => urls[x]).filter(Boolean), apres: p.apres.map((x) => urls[x]).filter(Boolean) };
      }),
      prestations: (contenu.prestations || []).map((p) => ({ nom: p.nom, detail: p.detail, delai: p.delai, prix: libellePrix(p) })),
      avis: avis.map((a) => ({ id: a.id, auteur: a.auteur, note: a.note, texte: a.texte || "", date: a.creeLe, verifie: Boolean(a.verifie), reponse: a.reponse?.texte || "" })),
      avisStats: statsAvis(avis),
      // Preuve (PRO-26, version 1) : chantiers livrés avec un PV signé par le client.
      chantiersLivres: (db.clotures || []).filter((c) => c.userId === site.userId && c.pv?.signeLe).length,
      delaiReponse: delai,
      carte: offre.carte ? (({ adresseTexte, adresse, ...k }) => ({ ...k, adresse: adresse ? adresseTexte : "" }))(contenuCarte(contenu, webUser)) : null,
      verifie: verif.sceau,
      decennale: verif.items.find((i) => i.id === "decennale")?.ok ? { assureur: b.documents?.decennale?.insurer || b.decennaleInsurer || "", jusqua: verif.decennaleJusqua } : null,
      entreprise: {
        forme: b.formeJuridique || "",
        ville: b.city || "",
        siret: String(b.siret || "").replace(/\s/g, "")
      }
    }
  });
}
