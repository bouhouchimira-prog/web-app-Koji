import { randomUUID } from "node:crypto";
import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { chantierDuClient } from "../../../../lib/portal-acces";
import { auteurPublic, normaliserCriteres, noteValide } from "../../../../lib/avis";
import { factureDeSolde } from "../../../../lib/cloture-chantier";
import { clotureOuNouvelle } from "../../../../lib/cloture-db";

// Avis du client sur son chantier (maquette PRO-02.6, Koji Client « donner
// son avis ») : note globale, quatre critères, texte, accord pour publier
// les photos avant / après (sans adresse ni visage). Possible une fois le
// PV signé ou la facture de solde émise ; « vérifié » quand le chantier est
// facturé dans Koji. Un avis par chantier, publié tel quel.

function etat(db, chantier) {
  const cloture = (db.clotures || []).find((c) => c.projectId === chantier.id && c.userId === chantier.user_id) || null;
  const solde = factureDeSolde(db.invoices || [], { projectId: chantier.id });
  return { cloture, solde, possible: Boolean(cloture?.pv?.signeLe || solde) };
}

export async function GET(request) {
  const db = await readDb();
  const r = await chantierDuClient(request, db, new URL(request.url).searchParams.get("quoteId"));
  if (r.erreur) return badRequest(r.erreur, r.code);
  const { possible } = etat(db, r.chantier);
  const avis = (db.avis || []).find((a) => a.projectId === r.chantier.id) || null;
  return ok({ avis, possible });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const db = await readDb();
  const r = await chantierDuClient(request, db, body.quoteId);
  if (r.erreur) return badRequest(r.erreur, r.code);
  const { chantier, quote, user } = r;
  const { possible, solde } = etat(db, chantier);
  if (!possible) return badRequest("Vous pourrez donner votre avis à la fin du chantier.");
  if ((db.avis || []).some((a) => a.projectId === chantier.id)) return badRequest("Vous avez déjà donné votre avis sur ce chantier.", 409);
  if (!noteValide(body.note)) return badRequest("Choisissez une note de 1 à 5 étoiles.");
  const texte = String(body.texte || "").trim().slice(0, 1500);

  const maintenant = new Date().toISOString();
  const avis = {
    id: randomUUID(),
    userId: chantier.user_id,
    projectId: chantier.id,
    quoteId: quote.id,
    clientId: user.id,
    auteur: auteurPublic(user.name || quote.client || ""),
    note: Number(body.note),
    criteres: normaliserCriteres(body.criteres || {}),
    texte,
    accordPhotos: Boolean(body.accordPhotos),
    accordLe: body.accordPhotos ? maintenant : "",
    verifie: Boolean(solde),
    creeLe: maintenant,
    reponse: null,
    realisation: null
  };
  db.avis = [...(db.avis || []), avis];
  const cloture = clotureOuNouvelle(db, chantier.id, chantier.user_id);
  cloture.avis = { ...(cloture.avis || {}), recuLe: maintenant };
  addHistory(db, { userId: chantier.user_id, type: "chantier.avis_recu", label: `Avis reçu : ${avis.note} sur 5`, entityId: chantier.id, entityType: "project", meta: { projectId: chantier.id } });
  await writeDb(db);
  return ok({ avis }, 201);
}
