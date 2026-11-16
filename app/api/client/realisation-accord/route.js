import { badRequest, ok } from "../../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../../lib/db";
import { chantierDuClient } from "../../../../lib/portal-acces";
import { photosRealisation } from "../../../../lib/kojipage";
import { urlsPhotos } from "../../../../lib/kojipage-serveur";

// Accord du client pour publier une réalisation de son chantier sur la
// KojiPage (maquette PRO-13, « Accord client demandé ») : photos avant /
// après et ville seulement. Sans accord, rien n'est publié.
function enAttente(db, chantier) {
  const site = (db.companySites || []).find((s) => s.userId === chantier.user_id);
  const r = (site?.realisations || []).find((x) => x.projectId === chantier.id && x.statut === "accord_demande");
  return { site, r };
}

export async function GET(request) {
  const db = await readDb();
  const c = await chantierDuClient(request, db, new URL(request.url).searchParams.get("quoteId"));
  if (c.erreur) return badRequest(c.erreur, c.code);
  const { r } = enAttente(db, c.chantier);
  if (!r) return ok({ demande: null });
  const p = photosRealisation(r);
  const urls = await urlsPhotos(p.toutes);
  return ok({ demande: { id: r.id, titre: r.name, lieu: r.lieu || "", avant: p.avant.map((x) => urls[x]).filter(Boolean), apres: p.apres.map((x) => urls[x]).filter(Boolean) } });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const db = await readDb();
  const c = await chantierDuClient(request, db, body.quoteId);
  if (c.erreur) return badRequest(c.erreur, c.code);
  const { site, r } = enAttente(db, c.chantier);
  if (!r) return badRequest("Aucune demande en attente.", 404);
  const maintenant = new Date().toISOString();
  const accord = body.accord === true;
  // Accord : publiée tout de suite (l'entreprise l'avait déjà choisie) ;
  // refus : la réalisation redevient un brouillon, non publiée.
  for (const liste of [site.realisations, site.publie?.realisations].filter(Array.isArray)) {
    const x = liste.find((y) => y.id === r.id);
    if (x) Object.assign(x, accord ? { statut: "publiee", accordLe: maintenant } : { statut: "brouillon", refusLe: maintenant });
  }
  if (accord && site.publie && !site.publie.realisations?.some((y) => y.id === r.id)) site.publie.realisations = [{ ...r }, ...(site.publie.realisations || [])];
  db.notifications.unshift({
    id: `notif-accord-${r.id}-${Date.now()}`,
    userId: site.userId,
    type: "site.accord",
    title: accord ? "Le client accepte la publication" : "Le client refuse la publication",
    message: `${r.name} · ${accord ? "réalisation publiée sur votre KojiPage" : "la réalisation reste en brouillon"}`,
    actionUrl: "/kojipage/realisations",
    actionLabel: "Voir les réalisations",
    read: false,
    createdAt: maintenant
  });
  addHistory(db, { userId: site.userId, type: accord ? "site.accord" : "site.refus", label: `${accord ? "Accord" : "Refus"} du client : ${r.name}`, entityId: c.chantier.id, entityType: "project", meta: { projectId: c.chantier.id } });
  await writeDb(db);
  return ok({ accord });
}
