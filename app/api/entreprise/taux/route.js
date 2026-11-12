import { badRequest, ok } from "../../../../lib/http";
import { readDb, writeDb } from "../../../../lib/db";
import { getVerifiedUserId } from "../../../../lib/server-auth";
import { tauxParFamille, tauxParMetier } from "../../../../lib/demarrage";

// Taux horaires par métier (démarrage guidé, étape 3 ; site et app Koji Pro).
// Enregistrés par famille d'ouvrage dans db.tauxParFamille[userId] : la
// bibliothèque de l'entreprise les applique aux ouvrages sans taux propre
// (lib/ouvrages.js::appliquerTauxMetiers), donc aux devis, au Devis guidé et
// au prix recommandé du Radar. Le taux des autres postes reste le taux
// journalier du profil (PATCH /api/auth/profile).
const TAUX_MAX = 500;

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const db = await readDb();
  const parFamille = db.tauxParFamille?.[userId]?.taux || {};
  return ok({ taux: tauxParMetier(parFamille), parFamille });
}

export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return badRequest("Requête invalide.");
  }
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const saisis = body?.taux && typeof body.taux === "object" ? body.taux : {};
  for (const valeur of Object.values(saisis)) {
    const n = Number(valeur);
    if (valeur !== "" && valeur !== null && (!Number.isFinite(n) || n < 0 || n > TAUX_MAX)) {
      return badRequest(`Un taux doit être compris entre 0 et ${TAUX_MAX} € de l'heure.`);
    }
  }
  const parFamille = tauxParFamille(saisis);

  const db = await readDb();
  db.tauxParFamille = db.tauxParFamille || {};
  if (Object.keys(parFamille).length) {
    db.tauxParFamille[userId] = { taux: parFamille, updatedAt: new Date().toISOString() };
  } else {
    delete db.tauxParFamille[userId];
  }
  await writeDb(db);
  return ok({ taux: tauxParMetier(parFamille), parFamille });
}
