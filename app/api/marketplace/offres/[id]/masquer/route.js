import { badRequest, ok } from "../../../../../../lib/http";
import { readDb, writeDb } from "../../../../../../lib/db";
import { resolveEntreprise } from "../../../../../../lib/entreprise-auth";
import { RAISONS_PAS_INTERESSE } from "../../../../../../lib/radar-jetons";

// « Pas intéressé » (maquette PRO-04) : le chantier quitte le Radar de
// l'entreprise, avec une raison facultative qui ajuste ses préférences. Le
// client n'en est jamais informé. DELETE : le chantier revient.
export async function POST(request, context) {
  const body = await request.json().catch(() => ({}));
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const { id } = await context.params;
  const db = await readDb();
  if (!(db.chantierOffres || []).some((o) => o.id === id)) return badRequest("Chantier introuvable.", 404);
  const raison = RAISONS_PAS_INTERESSE.includes(body.raison) ? body.raison : "";
  db.radarMasques = (db.radarMasques || []).filter((m) => !(m.userId === entreprise.userId && m.offerId === id));
  db.radarMasques.push({ userId: entreprise.userId, offerId: id, raison, le: new Date().toISOString() });
  await writeDb(db);
  return ok({ masque: true, raison });
}

export async function DELETE(request, context) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const { id } = await context.params;
  const db = await readDb();
  db.radarMasques = (db.radarMasques || []).filter((m) => !(m.userId === entreprise.userId && m.offerId === id));
  await writeDb(db);
  return ok({ masque: false });
}
