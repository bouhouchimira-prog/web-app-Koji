import { badRequest, ok } from "../../../../lib/http";
import { ADMIN_SCOPE, getUserScope, readDb, resolveUserId, writeDb } from "../../../../lib/db";
import { fixText } from "../../../../lib/text";

// Dernier relevé bancaire rapproché (maquette PRO-06.3) : seulement le
// résumé et les virements sans facture à rattacher ; le relevé lui-même
// n'est pas conservé.
export async function GET(request) {
  const db = await readDb();
  const userId = await getUserScope(request, db);
  if (!userId || userId === ADMIN_SCOPE) return ok({ releve: null });
  return ok({ releve: db.releves?.[userId] || null });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const db = await readDb();
  const userId = await resolveUserId(request, body, db);
  if (!userId) return badRequest("Connexion requise.", 401);
  if (userId === ADMIN_SCOPE) return badRequest("Propre à chaque entreprise.", 400);
  const jour = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
  const sansFacture = (Array.isArray(body.sansFacture) ? body.sansFacture : []).slice(0, 50).map((l) => ({
    date: jour(l.date),
    libelle: fixText(String(l.libelle || "")).slice(0, 140),
    montant: Math.round(Number(l.montant || 0) * 100) / 100
  })).filter((l) => l.montant > 0);
  db.releves = db.releves || {};
  db.releves[userId] = {
    dernierJour: jour(body.dernierJour),
    lignes: Math.max(0, Math.min(10000, Number(body.lignes) || 0)),
    rapprochees: Math.max(0, Math.min(10000, Number(body.rapprochees) || 0)),
    sansFacture,
    deposeLe: new Date().toISOString()
  };
  await writeDb(db);
  return ok({ releve: db.releves[userId] });
}
