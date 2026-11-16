import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { chantierDuClient } from "../../../../lib/portal-acces";
import { messageClient, PAIEMENT_DEFAUT } from "../../../../lib/sous-traitance";
import { getSupabaseAdmin } from "../../../../lib/supabase";
import { buildWebUser } from "../../../../lib/user-profile";

// Koji Client (maquette PRO-14.1, « accepter le sous-traitant ») : le client
// accepte le sous-traitant et ses conditions de paiement (loi n° 75-1334,
// art. 3). GET ?quoteId= · POST { quoteId, id, accord }.
function enAttente(db, chantier) {
  return (db.contratsSousTraitance || []).filter((c) => c.projectId === chantier.id && c.userId === chantier.user_id && c.presenteLe && !c.accepteLe && !c.refuseLe);
}

export async function GET(request) {
  const db = await readDb();
  const r = await chantierDuClient(request, db, new URL(request.url).searchParams.get("quoteId"));
  if (r.erreur) return badRequest(r.erreur, r.code);
  const liste = enAttente(db, r.chantier);
  if (!liste.length) return ok({ contrats: [] });
  const { data: profile } = await getSupabaseAdmin().from("users").select("*").eq("id", r.chantier.user_id).maybeSingle();
  const entreprise = buildWebUser({ id: r.chantier.user_id, email: profile?.email || "", profile }).business?.raisonSociale || "Votre entreprise";
  return ok({ contrats: liste.map((c) => ({ id: c.id, sousTraitant: c.sousTraitant, lot: c.lot, chantier: c.chantier, message: messageClient({ ...c, entreprise }), paiement: c.paiement || PAIEMENT_DEFAUT })) });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const db = await readDb();
  const r = await chantierDuClient(request, db, body.quoteId);
  if (r.erreur) return badRequest(r.erreur, r.code);
  const c = enAttente(db, r.chantier).find((x) => x.id === body.id);
  if (!c) return badRequest("Plus rien à accepter.", 404);
  const maintenant = new Date().toISOString();
  const accord = body.accord === true;
  if (accord) c.accepteLe = maintenant; else c.refuseLe = maintenant;
  db.notifications.unshift({
    id: `notif-st-${c.id}-${Date.now()}`,
    userId: c.userId,
    type: "sous-traitance.client",
    title: accord ? "Le client accepte le sous-traitant" : "Le client refuse le sous-traitant",
    message: `${c.sousTraitant} · ${c.lot}`,
    actionUrl: `/reseau-pro/contrat?id=${c.id}`,
    actionLabel: "Voir le contrat",
    read: false,
    createdAt: maintenant
  });
  addHistory(db, { userId: c.userId, type: accord ? "sous-traitance.accepte" : "sous-traitance.refuse", label: `${accord ? "Sous-traitant accepté" : "Sous-traitant refusé"} par le client : ${c.sousTraitant}`, entityId: c.projectId, entityType: "project", meta: { projectId: c.projectId } });
  await writeDb(db);
  return ok({ accord });
}
