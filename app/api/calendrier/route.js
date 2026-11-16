import { badRequest, ok } from "../../../lib/http";
import { readDb, writeDb } from "../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";
import { agendaDuJour, conflits, decaler, estFerie, finApres, jourLong, livraisons, lotsAPlanifier, premierCreneau, joursOccupes, resumeSemaine, premierOuvre } from "../../../lib/calendrier-pro";
import { aRelancer } from "../../../lib/devis-liste";
import { SEUIL_VIGILANCE, vigilance } from "../../../lib/contacts-pro";
import { normalizeEmail } from "../../../lib/contacts";
import { chargerChantiers } from "../../../lib/depenses-serveur";
import { bonsDe } from "../../../lib/fournitures-serveur";
import { sendClientMessageEmail } from "../../../lib/mailer";
import { fixText } from "../../../lib/text";

// Calendrier (maquettes PRO-11 à 11.4) : ce que la grille du site et
// l'agenda de l'app ajoutent aux tâches et rendez-vous : fériés, livraisons
// des bons, conflits avec proposition, lots à planifier, documents des
// sous-traitants, agenda du jour ; planifier un lot, décaler, prévenir.
const jour = (v) => String(v || "").slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const plus = (j, n) => new Date(Date.parse(`${j}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const lundi = (j) => { const d = new Date(`${j}T12:00:00Z`); return plus(j, -((d.getUTCDay() + 6) % 7)); };
const CRENEAUX = { journee: ["08:00", "17:00"], matin: ["08:00", "12:00"], apresmidi: ["13:30", "17:30"] };

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  const db = await readDb();
  const userId = entreprise.userId;
  const { chantiers, quotes } = await chargerChantiers(entreprise);
  const titres = new Map(chantiers.map((c) => [c.projectId, c.title]));
  return { entreprise, db, userId, chantiers, quotes, titres, taches: (db.tasks || []).filter((t) => t.userId === userId), workers: (db.workers || []).filter((w) => w.userId === userId) };
}

// Sous-traitant de l'équipe (worker) → sa fiche Contacts (même e-mail ou même nom).
function contactDuWorker(db, userId, w) {
  const nom = String(w.name || "").toLowerCase().trim();
  return (db.contacts || []).find((c) => c.userId === userId && !c.archived && (c.roles || []).includes("sous_traitant")
    && ((w.email && normalizeEmail(c.email) === normalizeEmail(w.email)) || (nom && String(c.companyName || `${c.firstName || ""} ${c.lastName || ""}`).toLowerCase().trim() === nom))) || null;
}

export async function GET(request) {
  let ctx;
  try { ctx = await contexte(request); } catch (e) { return badRequest(e.message, 502); }
  if (ctx.erreur) return ctx.erreur;
  const { db, userId, chantiers, quotes, titres, taches, workers, entreprise } = ctx;
  const url = new URL(request.url);
  const auj = today();
  const debut = jour(url.searchParams.get("debut")) || lundi(auj);
  const fin = jour(url.searchParams.get("fin")) || plus(debut, 6);
  const jourAgenda = jour(url.searchParams.get("jour")) || auj;
  const { data: rows } = await entreprise.supabase.from("calendar_events").select("*").eq("user_id", userId);
  const evenements = (rows || []).map((r) => ({ id: r.id, title: r.title || "Rendez-vous", eventType: r.event_type || "", startAt: r.start_at, endAt: r.end_at || r.start_at, allDay: Boolean(r.all_day), projectId: r.project_id || "", projectTitle: titres.get(r.project_id) || "", clientName: r.client_name || "", address: r.address || "", status: r.status || "" }));
  const livs = livraisons(bonsDe(db, userId), { debut: plus(debut, -7), fin: plus(fin, 28), titres, aujourdhui: auj });
  const webUser = await loadEntrepriseProfile(entreprise);
  const heuresParJour = Number(webUser.business?.hoursPerDay) || 7;
  const relances = quotes.filter((q) => aRelancer(q, auj)).map((q) => {
    const derniere = jour((q.relances || []).map((r) => r.le).sort().at(-1) || q.sentAt);
    return { id: q.id, client: q.client || "client", numero: q.quoteNumber || "", jours: Math.round((Date.parse(`${auj}T12:00:00Z`) - Date.parse(`${derniere}T12:00:00Z`)) / 86400000) };
  });
  // Documents des sous-traitants qui interviennent dans les 4 semaines.
  const docs = [];
  for (const w of workers.filter((x) => x.type === "Sous-traitant")) {
    const prochaine = taches.filter((t) => !t.done && (t.workerIds || []).includes(w.id) && jour(t.startDate || t.dueDate) >= auj && jour(t.startDate || t.dueDate) <= plus(auj, 28)).sort((a, b) => jour(a.startDate).localeCompare(jour(b.startDate)))[0];
    if (!prochaine) continue;
    const c = contactDuWorker(db, userId, w);
    if (!c) continue;
    const v = vigilance(c, { cumulHt: SEUIL_VIGILANCE, aujourdhui: auj });
    for (const d of v.docs.filter((x) => !x.facultatif && x.etat !== "ok")) {
      docs.push({ workerId: w.id, contactId: c.id, worker: w.name, doc: d.cle, nom: d.nom, texte: d.texte, bloquant: d.etat !== "echeance", avant: `${titres.get(prochaine.projectId) || prochaine.project || "Chantier"}${prochaine.room ? ` ${prochaine.room}` : ""} (${jourLong(jour(prochaine.startDate || prochaine.dueDate))})` });
    }
  }
  const feries = [];
  for (let d = debut; d <= plus(fin, 0); d = plus(d, 1)) if (estFerie(d)) feries.push(d);
  const noms = new Map(workers.map((w) => [w.id, w.name]));
  const semaine = Array.from({ length: 7 }, (_, i) => plus(lundi(jourAgenda), i)).map((d) => ({ jour: d, ferie: estFerie(d), n: agendaDuJour({ jour: d, taches, evenements, livraisons: livs, titres, noms }).length }));
  return ok({
    debut, fin, feries,
    resume: resumeSemaine({ taches, workers, livraisons: livs, debut, fin }),
    livraisons: livs.filter((l) => l.date >= debut && l.date <= fin),
    conflits: conflits(taches, workers, { debut, fin: plus(fin, 21), titres }),
    livraisonsBloquantes: livs.filter((l) => l.bloquant && l.date >= auj),
    documents: docs,
    aPlanifier: lotsAPlanifier(chantiers.filter((c) => c.quote && (c.quote.status === "Signe" || c.quote.signatureStatus === "Signe")), taches, { heuresParJour }),
    agenda: { jour: jourAgenda, items: agendaDuJour({ jour: jourAgenda, taches, evenements, livraisons: livs, relances: jourAgenda === auj ? relances : [], titres, noms }) },
    semaine,
    chantiers: chantiers.filter((c) => !c.archive).map((c) => ({ projectId: c.projectId, title: c.title, address: c.address, lots: c.quote ? [...new Set((c.quote.items || []).map((i) => String(i.room || "Chantier").trim() || "Chantier"))] : [] })),
    workers: workers.map((w) => ({ id: w.id, name: w.name, type: w.type || "", email: w.email ? "oui" : "" }))
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  let ctx;
  try { ctx = await contexte(request, body); } catch (e) { return badRequest(e.message, 502); }
  if (ctx.erreur) return ctx.erreur;
  const { db, userId, chantiers, titres, workers, entreprise } = ctx;
  db.tasks = db.tasks || [];
  const now = new Date().toISOString();

  // Créneau proposé pour un lot : après le lot précédent, intervenant libre.
  if (body.action === "proposer") {
    const jours = Math.max(1, Math.round(Number(body.jours) || 1));
    const occupes = new Set();
    for (const id of Array.isArray(body.workerIds) ? body.workerIds : []) for (const d of joursOccupes(db.tasks.filter((t) => t.userId === userId), id)) occupes.add(d);
    const apres = jour(body.apres) || premierOuvre(today());
    return ok({ creneau: premierCreneau(occupes, apres > today() ? apres : premierOuvre(today()), jours) });
  }

  if (body.action === "planifier-lot") {
    const ch = chantiers.find((c) => c.projectId === body.projectId);
    if (!ch) return badRequest("Chantier introuvable.", 404);
    const lot = fixText(String(body.lot || "")).trim().slice(0, 120);
    const debut = premierOuvre(jour(body.debut) || today());
    const jours = Math.max(1, Math.round(Number(body.jours) || 1));
    const fin = finApres(debut, jours);
    const workerIds = (Array.isArray(body.workerIds) ? body.workerIds : []).filter((id) => workers.some((w) => w.id === id));
    const [h1, h2] = CRENEAUX[body.creneau] || CRENEAUX.journee;
    let lotTaches = db.tasks.filter((t) => t.userId === userId && t.projectId === ch.projectId && (t.room || "") === lot && !t.done);
    if (!lotTaches.length) {
      const t = { id: `task-${Date.now()}`, userId, projectId: ch.projectId, project: ch.title, label: lot || "Lot", room: lot, done: false, status: "En attente", createdAt: now, updatedAt: now };
      db.tasks.unshift(t);
      lotTaches = [t];
    }
    for (const t of lotTaches) Object.assign(t, { startDate: debut, endDate: fin, dueDate: fin, startTime: h1, endTime: h2, ...(workerIds.length ? { workerIds } : {}), effectif: Math.max(1, Number(body.effectif) || 1), updatedAt: now });
    const prevenus = [];
    if (body.prevenir) {
      const webUser = await loadEntrepriseProfile(entreprise);
      for (const w of workers.filter((x) => workerIds.includes(x.id) && x.email)) {
        await sendClientMessageEmail({ to: w.email, subject: `${ch.title} · ${lot} · ${jourLong(debut)}`, message: `Bonjour,\n\n${webUser.business?.raisonSociale || "Nous"} vous attend sur le chantier ${ch.title}${ch.address ? `, ${ch.address}` : ""} pour « ${lot} » : du ${jourLong(debut)} au ${jourLong(fin)} (${h1.replace(":", " h ")} – ${h2.replace(":", " h ")}).\n\nMerci de confirmer.`, replyTo: webUser.email || undefined }).then(() => prevenus.push(w.name)).catch(() => {});
      }
    }
    await writeDb(db);
    return ok({ debut, fin, taches: lotTaches.map((t) => t.id), prevenus });
  }

  const t = db.tasks.find((x) => x.id === body.taskId && x.userId === userId);
  if (!t) return badRequest("Tâche introuvable.", 404);
  if (body.action === "decaler") {
    Object.assign(t, decaler(t, jour(body.debut) || today()), { updatedAt: now });
  } else if (body.action === "changer") {
    const ids = (Array.isArray(body.workerIds) ? body.workerIds : []).filter((id) => workers.some((w) => w.id === id));
    if (!ids.length) return badRequest("Choisissez un intervenant.");
    t.workerIds = ids;
    t.updatedAt = now;
  } else if (body.action === "prevenir") {
    const webUser = await loadEntrepriseProfile(entreprise);
    const dest = workers.filter((w) => (t.workerIds || []).includes(w.id) && w.email);
    if (!dest.length) return badRequest("Aucun intervenant de cette tâche n'a d'e-mail.");
    for (const w of dest) await sendClientMessageEmail({ to: w.email, subject: `${titres.get(t.projectId) || t.project || "Chantier"} · ${t.room || t.label}`, message: `Bonjour ${w.name},\n\n${t.label}${t.room ? ` (${t.room})` : ""} : ${jourLong(jour(t.startDate || t.dueDate))}${t.endDate && t.endDate !== t.startDate ? ` → ${jourLong(jour(t.endDate))}` : ""}.\n\n${webUser.business?.raisonSociale || ""}`, replyTo: webUser.email || undefined });
    return ok({ prevenus: dest.map((w) => w.name) });
  } else {
    return badRequest("Action inconnue.");
  }
  await writeDb(db);
  return ok({ tache: { id: t.id, startDate: t.startDate, endDate: t.endDate, workerIds: t.workerIds || [] } });
}

