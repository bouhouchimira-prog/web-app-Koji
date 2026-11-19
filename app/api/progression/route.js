import { badRequest, ok } from "../../../lib/http";
import { readDb } from "../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";
import { demandesDe } from "../../../lib/kojipage-serveur";
import { verifications } from "../../../lib/kojipage";
import { etatParcours } from "../../../lib/parcours-grade";
import { donneesEntreprise, prefsParcours } from "../../../lib/parcours-serveur";
import { defisSemaine, sceauVerifie } from "../../../lib/progression";

// Ma progression (maquette PRO-21) : défis de la semaine, sceau Vérifié,
// et le grade de « Mon parcours » (PRO-26) — une seule source des niveaux.
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const userId = entreprise.userId;
  const [db, webUser] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise)]);
  const donnees = await donneesEntreprise(db, entreprise, webUser);
  const etat = etatParcours(donnees, prefsParcours(db, userId));
  return ok({
    // Les versions déjà publiées de l'app Koji Pro lisent encore niveau.label,
    // points, niveaux, prochain et condition : on les garde, tirés du grade.
    niveau: { ...etat.niveau, label: etat.niveau.grade.label },
    points: etat.niveau.xp,
    niveaux: etat.grades,
    prochain: etat.niveau.prochainGrade,
    condition: etat.niveau.prochainGrade ? `niveau ${etat.niveau.prochainGrade.niveau}` : "",
    grades: etat.grades,
    preuves: etat.preuves,
    talents: { points: etat.talents.points, libres: etat.talents.libres, avantages: etat.talents.avantages },
    ...defisSemaine({ quotes: donnees.quotes, photos: donnees.photos, demandes: demandesDe(db, userId) }),
    sceau: sceauVerifie({ verifs: verifications(webUser.business || {}), avis: donnees.avis })
  });
}
