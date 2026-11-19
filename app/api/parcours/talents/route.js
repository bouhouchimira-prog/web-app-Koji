import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../../lib/entreprise-auth";
import { etatParcours } from "../../../../lib/parcours-grade";
import { placerPoint, reorganiser } from "../../../../lib/parcours-talents";
import { donneesEntreprise, ecrirePrefsParcours, prefsParcours } from "../../../../lib/parcours-serveur";

// Talents (maquette PRO-26.1). Le nombre de points de métier vient du
// niveau, recalculé ici depuis les données du compte (jamais du navigateur).
// POST { action: "placer", branche: "radar" | "vitrine" }
// POST { action: "reorganiser", repartition: { radar, vitrine } }
// Réponse : l'état complet de « Mon parcours » (comme GET /api/parcours/grade).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const userId = entreprise.userId;
  const [db, webUser] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise)]);
  const donnees = await donneesEntreprise(db, entreprise, webUser);
  const points = etatParcours(donnees, prefsParcours(db, userId)).niveau.niveau;
  const frais = await readDb();
  const actuel = prefsParcours(frais, userId).talents || {};
  let talents;
  try {
    if (body.action === "placer") talents = placerPoint(actuel, String(body.branche || ""), { points });
    else if (body.action === "reorganiser") talents = reorganiser(actuel, body.repartition && typeof body.repartition === "object" ? body.repartition : {}, { points });
    else return badRequest("Action inconnue.");
  } catch (e) {
    return badRequest(e.message, 409);
  }
  ecrirePrefsParcours(frais, userId, { talents });
  await writeDb(frais);
  return ok(etatParcours(donnees, prefsParcours(frais, userId)));
}
