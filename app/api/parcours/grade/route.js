import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../../lib/entreprise-auth";
import { distinctionsValides, etatParcours } from "../../../../lib/parcours-grade";
import { donneesEntreprise, ecrirePrefsParcours, prefsParcours } from "../../../../lib/parcours-serveur";

// Mon parcours v2 (maquette PRO-26) : grade, niveau, expérience du mois,
// hauts faits, aperçu côté particulier, talents. Lecture seule (aucun
// jeton crédité ici, contrairement à GET /api/parcours).
export async function GET(request) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  const [db, webUser] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise)]);
  return ok(etatParcours(await donneesEntreprise(db, entreprise, webUser), prefsParcours(db, entreprise.userId)));
}

// POST { action: "distinctions", ids: [3 au plus] } : les distinctions
// montrées au particulier, parmi les hauts faits publics obtenus.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Connexion requise.", 401);
  if (body.action !== "distinctions") return badRequest("Action inconnue.");
  if (!Array.isArray(body.ids) || body.ids.length > 3) return badRequest("Choisissez trois distinctions au plus.");
  const userId = entreprise.userId;
  const [db, webUser] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise)]);
  const donnees = await donneesEntreprise(db, entreprise, webUser);
  const faits = etatParcours(donnees, prefsParcours(db, userId)).hautsFaits;
  const ids = distinctionsValides(body.ids, faits);
  if (ids.length !== new Set(body.ids.map(String)).size) return badRequest("Seuls les hauts faits publics obtenus peuvent être montrés au particulier.");
  const frais = await readDb();
  ecrirePrefsParcours(frais, userId, { distinctions: ids });
  await writeDb(frais);
  return ok(etatParcours(donnees, prefsParcours(frais, userId)));
}
