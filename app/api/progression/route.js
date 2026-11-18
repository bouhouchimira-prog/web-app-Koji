import { badRequest, ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";
import { chargerChantiers } from "../../../lib/depenses-serveur";
import { demandesDe } from "../../../lib/kojipage-serveur";
import { verifications } from "../../../lib/kojipage";
import { calculerPoints, cloturesAvecAvis, defisSemaine, NIVEAUX, niveauDe, POINTS, sceauVerifie } from "../../../lib/progression";

// Ma progression (maquette PRO-21) : niveau, points, défis de la semaine,
// sceau Vérifié — calculés depuis les données du compte.
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const userId = entreprise.userId;
  const [db, webUser] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise)]);
  let quotes = [];
  try { ({ quotes } = await chargerChantiers(entreprise, { archives: true })); } catch { /* devis indisponibles : 0 point devis */ }
  const mes = (liste) => (liste || []).filter((x) => x.userId === userId);
  const donnees = { quotes, photos: mes(db.chantierPhotos), clotures: mes(db.clotures), avis: mes(db.avis), demandes: demandesDe(db, userId) };
  const p = calculerPoints(donnees);
  const n = niveauDe(p.total, cloturesAvecAvis(donnees.clotures, donnees.avis));
  return ok({
    points: p.total,
    detail: p.detail,
    bareme: POINTS,
    niveau: n.niveau,
    prochain: n.prochain,
    condition: n.condition,
    niveaux: NIVEAUX.map((x, i) => ({ ...x, atteint: i <= n.index, actuel: i === n.index })),
    ...defisSemaine(donnees),
    sceau: sceauVerifie({ verifs: verifications(webUser.business || {}), avis: donnees.avis })
  });
}
