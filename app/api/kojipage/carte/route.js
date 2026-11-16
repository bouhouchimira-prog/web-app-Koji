import { NextResponse } from "next/server";
import { badRequest } from "../../../../lib/http";
import { readDb } from "../../../../lib/db";
import { loadEntrepriseProfile, resolveEntreprise } from "../../../../lib/entreprise-auth";
import { buildCarteKojiPdf, carteKojiFilename } from "../../../../lib/document-generator";
import { telechargerDataUrl } from "../../../../lib/cloture-db";
import { couleurDe, offreKojiPage, verifications } from "../../../../lib/kojipage";
import { siteDe, urlPublique } from "../../../../lib/kojipage-serveur";
import { contenuCarte } from "../../../../lib/kojipage-carte";

// PDF de la carte de visite (maquette PRO-13.4) : ?format=carte (recto +
// verso), planche (A4, 10 cartes, traits de coupe) ou imprimeur (fonds
// perdus 3 mm). Offres Pro et Business.
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const webUser = await loadEntrepriseProfile(entreprise);
  const offre = offreKojiPage(webUser);
  if (!offre.carte) return badRequest("La carte de visite est incluse dans les offres Pro et Business.", 402);
  const db = await readDb();
  const site = siteDe(db, entreprise.userId);
  if (!site) return badRequest("Créez d'abord votre KojiPage.", 404);
  const params = new URL(request.url).searchParams;
  const format = ["planche", "imprimeur"].includes(params.get("format")) ? params.get("format") : "carte";
  const carte = contenuCarte(site, webUser);
  let logo = carte.logo ? webUser.business?.logoDataUrl || "" : "";
  if (carte.photo && /^kp:/.test(site.contactPhotoDataUrl || "")) {
    logo = await telechargerDataUrl(site.contactPhotoDataUrl.slice(3), /\.png$/.test(site.contactPhotoDataUrl) ? "image/png" : "image/jpeg") || logo;
  } else if (carte.photo && /^data:/.test(site.contactPhotoDataUrl || "")) logo = site.contactPhotoDataUrl;
  const verif = verifications(webUser.business || {});
  const pdf = await buildCarteKojiPdf({
    carte, format, logo,
    couleur: couleurDe(offre.couleur ? site.couleur : "marine"),
    url: urlPublique(site.slug),
    sceau: verif.sceau,
    siret: String(webUser.business?.siret || "").replace(/\s/g, "")
  });
  const nom = carteKojiFilename(carte.nom, format);
  return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${params.get("apercu") ? "inline" : "attachment"}; filename="${nom}"` } });
}
