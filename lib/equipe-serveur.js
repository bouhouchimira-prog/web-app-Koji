// Équipe Koji Pro (PRO-16 à 16.5), côté serveur : données de l'entreprise
// (qui est où, feuille d'heures, fiche, apprentissages) et vue compagnon
// (sa journée, sa semaine, ses heures, ses documents ; jamais un prix ni un
// nom de client). Règles pures dans lib/equipe-pro.js.
import { randomBytes, randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "./supabase.js";
import { getTaskConsumedMinutes } from "./worker-portal.js";
import { computeQuoteItem } from "./quote-calculations.js";
import { cleLigne } from "./chantiers-liste.js";
import { ajouterJours, apprentissages, dureePointage, enConge, etatDuJour, grilleSemaine, invitationValide, jourCourt, lundiDe, paris, roleDe, ROLES } from "./equipe-pro.js";

export const BUCKET = "quote_attachments";
const j10 = (v) => String(v || "").slice(0, 10);
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Les sous-traitants ne sont jamais dans l'équipe (C. trav. L8241-1).
export const estSousTraitant = (w = {}) => /sous.?traitant/i.test(String(w.type || ""));
export function equipeDe(db, userId) {
  return (db.workers || []).filter((w) => w.userId === userId && !estSousTraitant(w) && w.active !== false);
}
export function sousTraitantsDe(db, userId) {
  return (db.workers || []).filter((w) => w.userId === userId && estSousTraitant(w) && w.active !== false);
}

export function nouveauCode() {
  const b = randomBytes(16);
  let s = "";
  for (let i = 0; s.length < 8; i += 1) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}
export function creerInvitation(worker, maintenant = new Date().toISOString()) {
  worker.invitation = { code: nouveauCode(), creeLe: maintenant };
  return worker.invitation;
}
export function workerParCode(db, code = "") {
  const c = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length !== 8) return null;
  const w = (db.workers || []).find((x) => x.invitation?.code === c);
  return w && w.active !== false && invitationValide(w.invitation) ? w : null;
}

// Chantiers d'une entreprise lus avec la clé serveur (la vue compagnon n'a
// pas de session Supabase) : titre et adresse seulement.
export async function chantiersDe(userId) {
  const { data } = await getSupabaseAdmin().from("chantiers").select("*").eq("user_id", userId);
  return new Map((data || []).map((c) => [c.id, { title: c.reference || "Chantier", adresse: [c.street, c.postal_code, c.city].filter(Boolean).join(", ") }]));
}

const tachesDe = (db, worker) => (db.tasks || []).filter((t) => t.userId === worker.userId && (t.workerIds || []).includes(worker.id));
const couvre = (t, jour) => j10(t.startDate || t.dueDate) <= jour && j10(t.endDate || t.dueDate || t.startDate) >= jour;
const heureTexte = (hhmm) => (hhmm ? hhmm.replace(/^0/, "").replace(":", " h ").replace(/ 00$/, "") : "");

// Ce qu'un compagnon peut voir d'une tâche : pas de prix, pas de client.
export function tacheCompagnon(t = {}, chantiers = new Map()) {
  const c = chantiers.get(t.projectId) || {};
  return {
    id: t.id,
    label: t.label || "Tâche",
    projectId: t.projectId || "",
    chantier: c.title || t.project || "Chantier",
    adresse: c.adresse || t.location || "",
    lot: t.room || "",
    startDate: j10(t.startDate || t.dueDate),
    endDate: j10(t.endDate || t.dueDate || t.startDate),
    startTime: t.startTime || "",
    endTime: t.endTime || "",
    quantite: Number(t.quantity) || 0,
    unite: t.unit || "",
    consigne: t.consigne || t.description || "",
    aPrendre: (Array.isArray(t.supplyNeeds) ? t.supplyNeeds : []).map((s) => ({ label: s.label || s.name || s.designation || "", quantite: Number(s.quantity || s.quantite) || 0, unite: s.unit || s.unite || "" })).filter((s) => s.label),
    fait: Boolean(t.done)
  };
}

// --- Entreprise ------------------------------------------------------------

export function resumeEquipe(db, userId, { chantiers = new Map(), maintenant = new Date().toISOString() } = {}) {
  const equipe = equipeDe(db, userId);
  const auj = paris(maintenant).jour;
  const entries = (db.attendanceEntries || []).filter((e) => e.userId === userId || equipe.some((w) => w.id === e.workerId));
  const taches = (db.tasks || []).filter((t) => t.userId === userId);
  const titres = new Map([...chantiers].map(([id, c]) => [id, c.title]));
  const lignes = equipe.map((w) => ({ ...ficheCourte(w), ...etatDuJour(w, { entries, taches, jour: auj, maintenant, titres }) }));
  const grille = grilleSemaine(equipe, entries, lundiDe(auj), { maintenant });
  return { equipe, entries, taches, lignes, grille, auj };
}

export function ficheCourte(w = {}) {
  return { id: w.id, nom: w.name || "Compagnon", metier: w.profession || w.role || "", role: roleDe(w), roleLabel: ROLES[roleDe(w)].label, telephone: w.phone || "", langue: w.langue || "fr" };
}

// Ce que Koji apprend des heures : lignes des devis signés dont le temps
// passé (minuteurs des tâches) dépasse nettement le temps prévu.
export function lignesApprentissage(db, userId, quotes = [], chantiers = new Map()) {
  const masques = new Set(db.comptePrefs?.[userId]?.apprisMasques || []);
  const taches = (db.tasks || []).filter((t) => t.userId === userId);
  const out = [];
  for (const q of quotes.filter((x) => x.status === "Signe" || x.signatureStatus === "Signe")) {
    (Array.isArray(q.items) ? q.items : []).forEach((item, i) => {
      if (item.variante) return;
      const t = taches.find((x) => x.quoteItemId && x.quoteItemId === cleLigne(item, i)) || taches.find((x) => x.projectId === q.projectId && x.label === item.label);
      if (!t) return;
      const faitesMin = getTaskConsumedMinutes(t);
      const prevuesMin = Math.round((Number(computeQuoteItem(item, q).correctedTimeHours) || 0) * 60);
      const quantite = Number(item.quantity) || 0;
      const cle = `${q.id}:${cleLigne(item, i)}`;
      if (masques.has(cle) || !faitesMin) return;
      out.push({ cle, lot: item.label || t.label, chantier: chantiers.get(q.projectId)?.title || q.project || "", faitesMin, prevuesMin, quantite, unite: item.unit || "", hParUniteBib: quantite ? Math.round((prevuesMin / 60 / quantite) * 100) / 100 : 0, code: item.code || "" });
    });
  }
  return apprentissages(out);
}

// --- Compagnon -------------------------------------------------------------

export function vueCompagnon(db, worker, { chantiers = new Map(), entreprise = "", maintenant = new Date().toISOString() } = {}) {
  const { jour: auj } = paris(maintenant);
  const lundi = lundiDe(auj);
  const taches = tachesDe(db, worker);
  const entries = (db.attendanceEntries || []).filter((e) => e.workerId === worker.id);
  const equipe = (db.workers || []).filter((w) => w.userId === worker.userId && w.id !== worker.id);
  const valides = db.semainesValidees?.[worker.userId] || [];
  const avec = (jour, projectId) => {
    const ids = new Set(taches.length ? (db.tasks || []).filter((t) => t.userId === worker.userId && t.projectId === projectId && couvre(t, jour)).flatMap((t) => t.workerIds || []) : []);
    return equipe.filter((w) => ids.has(w.id) && !estSousTraitant(w)).map((w) => String(w.name || "").split(" ")[0]);
  };
  const duJour = (jour) => taches.filter((t) => couvre(t, jour)).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
  const pointages = (jour) => entries.filter((e) => e.date === jour);
  const minutes = (jour) => pointages(jour).reduce((n, e) => n + dureePointage(e, maintenant), 0);

  const tachesAuj = duJour(auj).map((t) => tacheCompagnon(t, chantiers));
  const ouvert = pointages(auj).find((e) => !e.endTime) || null;
  const premier = pointages(auj).sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)))[0] || null;
  const projetAuj = tachesAuj[0]?.projectId || "";

  const semaine = Array.from({ length: 6 }, (_, i) => ajouterJours(lundi, i)).map((jour) => {
    const ts = duJour(jour);
    const projets = [...new Set(ts.map((t) => t.projectId))];
    const t0 = ts[0];
    return {
      jour, libelle: jourCourt(jour),
      chantier: projets.map((p) => chantiers.get(p)?.title || ts.find((t) => t.projectId === p)?.project || "Chantier").join(" · ") || (enConge(worker, jour) ? "Congé" : jour > auj || !pointages(jour).length ? "Repos" : ""),
      avec: projets[0] ? avec(jour, projets[0]) : [],
      horaire: t0?.startTime ? `${heureTexte(t0.startTime)}${t0.endTime ? ` – ${heureTexte(t0.endTime)}` : ""}` : "",
      minutes: minutes(jour),
      valide: pointages(jour).some((e) => e.valideLe),
      aujourdhui: jour === auj
    };
  });
  const precedente = ajouterJours(lundi, -7);
  const minutesPrec = Array.from({ length: 7 }, (_, i) => minutes(ajouterJours(precedente, i))).reduce((a, b) => a + b, 0);
  return {
    entreprise,
    compagnon: { id: worker.id, prenom: String(worker.name || "").split(" ")[0], nom: worker.name || "", langue: worker.langue || "fr", role: roleDe(worker) },
    journee: {
      jour: auj,
      chantier: tachesAuj[0]?.chantier || "",
      adresse: tachesAuj[0]?.adresse || "",
      projectId: projetAuj,
      horaire: semaine.find((s) => s.jour === auj)?.horaire || "",
      avec: projetAuj ? avec(auj, projetAuj) : [],
      taches: tachesAuj,
      consignes: [...new Set(tachesAuj.map((t) => t.consigne).filter(Boolean))],
      conge: enConge(worker, auj),
      pointage: { arriveA: premier?.startTime || "", ouvert: Boolean(ouvert), minutes: minutes(auj), parti: Boolean(premier && !ouvert) }
    },
    semaine: { lundi, jours: semaine, minutes: semaine.reduce((n, s) => n + s.minutes, 0), validation: valides.find((v) => v.lundi === lundi) || null },
    semainePrecedente: { lundi: precedente, minutes: minutesPrec, validation: valides.find((v) => v.lundi === precedente) || null, contrat: Number(worker.weeklyContractHours) || 35 },
    documents: (worker.documents || []).map((d) => ({ id: d.id, nom: d.nom, jusqua: d.jusqua || "" })),
    messages: (db.notifications || []).filter((n) => n.workerId === worker.id && n.audience === "worker" && !n.read).slice(0, 5).map((n) => ({ id: n.id, titre: n.title, message: n.message, le: n.createdAt })),
    taches: taches.filter((t) => j10(t.endDate || t.dueDate || t.startDate) >= ajouterJours(auj, -7)).map((t) => tacheCompagnon(t, chantiers))
  };
}

// Photo d'un compagnon (fin de tâche ou problème) : rangée avec les photos
// du chantier (PRO-02.2), jamais montrée au client sans son accord.
export async function enregistrerPhotoCompagnon(db, worker, { fichier, projectId, taskId = "", lot = "", phase = "apres" }) {
  const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
  const ext = types[fichier.type];
  if (!ext) throw new Error("Format de photo non accepté (JPEG, PNG, WebP ou HEIC).");
  if (fichier.size > 8 * 1024 * 1024) throw new Error("Photo trop lourde (8 Mo au plus).");
  const id = randomUUID();
  const path = `chantier-photos/${worker.userId}/${projectId}/${id}.${ext}`;
  const { error } = await getSupabaseAdmin().storage.from(BUCKET).upload(path, Buffer.from(await fichier.arrayBuffer()), { contentType: fichier.type, upsert: false });
  if (error) throw new Error("La photo n'a pas pu être enregistrée.");
  const photo = { id, userId: worker.userId, projectId, lot, taskId, reserveId: "", phase, path, takenAt: new Date().toISOString(), author: worker.name || "Compagnon", workerId: worker.id };
  db.chantierPhotos = [...(db.chantierPhotos || []), photo];
  return photo;
}
