import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { resolveEntreprise, loadEntrepriseProfile } from "../../../lib/entreprise-auth";
import { chargerChantiers } from "../../../lib/depenses-serveur";
import { makeWorkerLoginId } from "../../../lib/worker-auth";
import { addWorkerNotification } from "../../../lib/worker-portal";
import { sendClientMessageEmail } from "../../../lib/mailer";
import { fixText } from "../../../lib/text";
import { ajouterJours, csvHeures, documentsAExpirer, dureePointage, grilleSemaine, heures4Semaines, heuresDecimales, invitationValide, lundiDe, messageInvitation, paris, remarquesSemaine, ROLES } from "../../../lib/equipe-pro";
import { creerInvitation, equipeDe, ficheCourte, lignesApprentissage, resumeEquipe, sousTraitantsDe } from "../../../lib/equipe-serveur";

// Équipe (maquettes PRO-16 à 16.3) : qui est où aujourd'hui, heures de la
// semaine (corriger, valider, rappel, comptable), fiche compagnon,
// ajouter un compagnon avec un lien d'invitation (pas de mot de passe),
// ce que les heures apprennent aux devis.
const j10 = (v) => String(v || "").slice(0, 10);
const HHMM = /^\d{2}:\d{2}$/;
const LANGUES = ["fr", "pt", "ar", "tr", "ro", "pl", "ta", "zh", "en", "es", "it", "de"];

async function contexte(request, body) {
  const entreprise = await resolveEntreprise(request, body);
  if (!entreprise) return { erreur: badRequest("Connexion requise.", 401) };
  const [db, webUser] = await Promise.all([readDb(), loadEntrepriseProfile(entreprise)]);
  return { entreprise, db, userId: entreprise.userId, webUser, nomEntreprise: webUser.business?.raisonSociale || webUser.name || "Votre entreprise" };
}

const lienInvitation = (request, code) => `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/compagnon/${code}`;
function invitationPour(request, w, nomEntreprise) {
  if (!invitationValide(w.invitation)) return null;
  const lien = lienInvitation(request, w.invitation.code);
  return { code: w.invitation.code, lien, creeLe: w.invitation.creeLe, message: messageInvitation({ prenom: String(w.name || "").split(" ")[0], entreprise: nomEntreprise, lien }) };
}

export async function GET(request) {
  const ctx = await contexte(request);
  if (ctx.erreur) return ctx.erreur;
  const { entreprise, db, userId, nomEntreprise } = ctx;
  const url = new URL(request.url);
  let chantiersListe = [];
  let quotes = [];
  try { ({ chantiers: chantiersListe, quotes } = await chargerChantiers(entreprise, { archives: true })); } catch { /* titres seulement */ }
  const chantiers = new Map(chantiersListe.map((c) => [c.projectId, { title: c.title, adresse: c.address }]));
  const maintenant = new Date().toISOString();
  const r = resumeEquipe(db, userId, { chantiers, maintenant });

  const id = url.searchParams.get("id");
  if (id) {
    const w = r.equipe.find((x) => x.id === id);
    if (!w) return badRequest("Compagnon introuvable.", 404);
    const lundi = lundiDe(r.auj);
    const cetteSemaine = r.taches.filter((t) => (t.workerIds || []).includes(w.id) && j10(t.startDate || t.dueDate) <= ajouterJours(lundi, 6) && j10(t.endDate || t.dueDate || t.startDate) >= lundi);
    const projets = [...new Set(cetteSemaine.map((t) => t.projectId))].map((p) => chantiers.get(p)?.title || cetteSemaine.find((t) => t.projectId === p)?.project || "Chantier");
    return ok({
      fiche: {
        ...ficheCourte(w),
        email: w.email || "",
        coutHoraire: Number(w.hourlyRate) || 0,
        depuis: j10(w.hireDate || w.createdAt),
        heures: heures4Semaines(r.entries, w.id, maintenant),
        semaine: { chantiers: projets, minutes: r.grille.lignes.find((l) => l.workerId === w.id)?.total || 0 },
        documents: (w.documents || []).slice().sort((a, b) => String(a.jusqua).localeCompare(String(b.jusqua))),
        conges: w.conges || [],
        invitation: invitationPour(request, w, nomEntreprise),
        dejaConnecte: Boolean(w.lastLoginAt || w.invitation?.utiliseLe)
      },
      roles: ROLES
    });
  }

  const semaine = url.searchParams.get("semaine");
  if (semaine !== null) {
    const lundi = lundiDe(j10(semaine) || r.auj);
    const grille = lundi === lundiDe(r.auj) ? r.grille : grilleSemaine(r.equipe, r.entries, lundi, { maintenant });
    // Chantiers de chaque compagnon dans la semaine (vue téléphone).
    const parWorker = Object.fromEntries(r.equipe.map((w) => {
      const jours = new Map();
      for (let i = 0; i < 5; i += 1) {
        const d = ajouterJours(lundi, i);
        const e = r.entries.find((x) => x.workerId === w.id && x.date === d && x.projectId);
        const t = e ? null : r.taches.find((x) => (x.workerIds || []).includes(w.id) && j10(x.startDate || x.dueDate) <= d && j10(x.endDate || x.dueDate || x.startDate) >= d);
        const p = e?.projectId || t?.projectId;
        if (p) jours.set(p, (jours.get(p) || 0) + 1);
      }
      return [w.id, [...jours].map(([p, n]) => ({ chantier: chantiers.get(p)?.title || "Chantier", jours: n }))];
    }));
    const validation = (db.semainesValidees?.[userId] || []).find((v) => v.lundi === lundi) || null;
    return ok({
      grille,
      remarques: remarquesSemaine(grille),
      validation,
      parWorker,
      sousTraitants: sousTraitantsDe(db, userId).map((w) => ({ id: w.id, nom: w.name })),
      comptableEmail: db.reglagesDepenses?.[userId]?.comptableEmail || "",
      depuisOrdinateur: r.entries.filter((e) => e.date >= lundi && e.date <= ajouterJours(lundi, 6) && e.depuis === "ordinateur").map((e) => `${e.workerId}:${e.date}`)
    });
  }

  const docs = documentsAExpirer(r.equipe, maintenant);
  return ok({
    entreprise: nomEntreprise,
    aujourdhui: r.auj,
    equipe: r.lignes,
    kpis: {
      surChantier: r.lignes.filter((l) => l.statut === "arrive").length,
      total: r.lignes.length,
      heuresSemaine: r.grille.total,
      aValider: r.equipe.length > 0 && !(db.semainesValidees?.[userId] || []).some((v) => v.lundi === r.grille.lundi)
    },
    documents: docs,
    remarques: remarquesSemaine(r.grille),
    appris: lignesApprentissage(db, userId, quotes, chantiers),
    roles: ROLES
  });
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return badRequest("Requête invalide."); }
  const ctx = await contexte(request, body);
  if (ctx.erreur) return ctx.erreur;
  const { db, userId, nomEntreprise } = ctx;
  const action = String(body.action || "");
  const maintenant = new Date().toISOString();
  const equipe = equipeDe(db, userId);
  const w = body.id ? equipe.find((x) => x.id === body.id) : null;
  const trace = (type, label, entityId, meta = {}) => addHistory(db, { userId, type, label, entityId, entityType: "worker", meta });

  if (action === "ajouter") {
    const nom = fixText(String(body.nom || "")).trim().slice(0, 80);
    if (!nom) return badRequest("Le prénom et le nom sont nécessaires.");
    const telephone = fixText(String(body.telephone || "")).trim().slice(0, 30);
    const role = ROLES[body.role] ? body.role : "compagnon";
    const [firstName, ...reste] = nom.split(" ");
    const nouveau = {
      id: `w-${Date.now()}`, userId, loginId: makeWorkerLoginId(db.workers || []), portalRole: "worker", type: "Ouvrier",
      firstName, lastName: reste.join(" "), name: nom, role: fixText(String(body.metier || "Compagnon")).slice(0, 60), profession: fixText(String(body.metier || "Compagnon")).slice(0, 60),
      roleEquipe: role, langue: LANGUES.includes(body.langue) ? body.langue : "fr", phone: telephone, email: fixText(String(body.email || "")).trim().slice(0, 120),
      hourlyRate: Number(body.coutHoraire) || 0, weeklyContractHours: 35, attendanceNotifiedWeeks: [], hireDate: j10(maintenant), status: "Disponible", availability: "Disponible",
      links: [], documents: [], conges: [], active: true, createdAt: maintenant
    };
    creerInvitation(nouveau, maintenant);
    db.workers = [nouveau, ...(db.workers || [])];
    trace("worker.created", `Compagnon ajouté : ${nom}`, nouveau.id);
    const invitation = invitationPour(request, nouveau, nomEntreprise);
    if (nouveau.email) await sendClientMessageEmail({ to: nouveau.email, subject: `${nomEntreprise} vous invite sur Koji`, message: invitation.message }).catch(() => null);
    await writeDb(db);
    return ok({ id: nouveau.id, invitation }, 201);
  }

  if (action === "masquer-appris") {
    db.comptePrefs = db.comptePrefs || {};
    const p = (db.comptePrefs[userId] = db.comptePrefs[userId] || {});
    p.apprisMasques = [...new Set([...(p.apprisMasques || []), String(body.cle || "")])].slice(-200);
    await writeDb(db);
    return ok({ ok: true });
  }

  if (action === "valider" || action === "rappel" || action === "comptable" || action === "corriger") {
    const lundi = lundiDe(j10(body.lundi || body.date) || paris(maintenant).jour);
    const entries = (db.attendanceEntries || []).filter((e) => equipe.some((x) => x.id === e.workerId));

    if (action === "corriger") {
      const cible = equipe.find((x) => x.id === body.workerId);
      const date = j10(body.date);
      if (!cible || !date) return badRequest("Compagnon ou jour manquant.");
      if (body.conge) {
        cible.conges = [...(cible.conges || []).filter((c) => !(c.du === date && c.au === date)), { du: date, au: date, motif: "congé" }];
        trace("attendance.conge", `${cible.name} : congé le ${date.split("-").reverse().join("/")}`, cible.id, { workerId: cible.id });
        await writeDb(db);
        return ok({ ok: true });
      }
      const minutes = Math.round(Number(body.minutes) * 60) / 60;
      if (!(minutes >= 0 && minutes <= 16 * 60)) return badRequest("Durée invalide (0 à 16 h).");
      cible.conges = (cible.conges || []).filter((c) => !(c.du === date && c.au === date));
      const jourEntries = (db.attendanceEntries || []).filter((e) => e.workerId === cible.id && e.date === date);
      const avant = jourEntries.reduce((n, e) => n + dureePointage(e, maintenant), 0);
      const debut = HHMM.test(body.debut) ? body.debut : jourEntries[0]?.startTime || "08:00";
      const [h, m] = debut.split(":").map(Number);
      const finMin = h * 60 + m + Math.round(minutes);
      const fin = `${String(Math.floor(finMin / 60) % 24).padStart(2, "0")}:${String(finMin % 60).padStart(2, "0")}`;
      const correction = { avant, apres: Math.round(minutes), le: maintenant, motif: fixText(String(body.motif || "")).slice(0, 200) };
      db.attendanceEntries = (db.attendanceEntries || []).filter((e) => !(e.workerId === cible.id && e.date === date));
      db.attendanceEntries.unshift({
        id: jourEntries[0]?.id || `att-${Date.now()}`, userId, workerId: cible.id, workerName: cible.name, projectId: jourEntries.find((e) => e.projectId)?.projectId || "",
        date, startTime: debut, endTime: fin, durationMinutes: Math.round(minutes), source: "corrige", depuis: jourEntries[0]?.depuis || "",
        corrections: [...jourEntries.flatMap((e) => e.corrections || []), correction], note: "", createdAt: jourEntries[0]?.createdAt || maintenant, updatedAt: maintenant
      });
      trace("attendance.corrected", `Heures corrigées : ${cible.name}, ${date.split("-").reverse().join("/")} (${heuresDecimales(avant)} → ${heuresDecimales(minutes)})`, cible.id, { workerId: cible.id });
      await writeDb(db);
      return ok({ ok: true });
    }

    const grille = grilleSemaine(equipe, entries, lundi, { maintenant });

    if (action === "valider") {
      // Les cases douteuses prennent la proposition de Koji (durée habituelle).
      for (const l of grille.lignes) for (const c of l.cases) {
        if (c.statut !== "douteux") continue;
        const e = (db.attendanceEntries || []).find((x) => x.id === c.entryId);
        if (e && c.proposition) {
          const [h, m] = String(e.startTime || "08:00").split(":").map(Number);
          const f = h * 60 + m + c.proposition;
          Object.assign(e, { endTime: `${String(Math.floor(f / 60) % 24).padStart(2, "0")}:${String(f % 60).padStart(2, "0")}`, durationMinutes: c.proposition, source: "corrige", corrections: [...(e.corrections || []), { avant: 0, apres: c.proposition, le: maintenant, motif: "départ non pointé, durée habituelle" }], updatedAt: maintenant });
        }
      }
      for (const e of db.attendanceEntries || []) if (equipe.some((x) => x.id === e.workerId) && e.date >= lundi && e.date <= ajouterJours(lundi, 6) && e.endTime) e.valideLe = maintenant;
      db.semainesValidees = db.semainesValidees || {};
      db.semainesValidees[userId] = [...(db.semainesValidees[userId] || []).filter((v) => v.lundi !== lundi), { lundi, valideLe: maintenant, minutes: grille.total }];
      trace("attendance.week_validated", `Heures validées : semaine du ${lundi.split("-").reverse().join("/")} (${heuresDecimales(grille.total)})`, lundi);
      await writeDb(db);
      return ok({ ok: true, validation: db.semainesValidees[userId].at(-1) });
    }

    if (action === "rappel") {
      const date = j10(body.date);
      const ids = Array.isArray(body.workerIds) ? body.workerIds : [];
      const cibles = equipe.filter((x) => ids.includes(x.id));
      for (const c of cibles) addWorkerNotification(db, { workerId: c.id, type: "worker.rappel_pointage", title: "Pointage manquant", message: `Vous n'avez pas pointé le ${date.split("-").reverse().join("/")}. Ouvrez Koji pour indiquer vos heures ou prévenez ${nomEntreprise}.` });
      await writeDb(db);
      return ok({ ok: true, envoyes: cibles.length, telephones: cibles.filter((c) => c.phone).map((c) => ({ id: c.id, nom: c.name, telephone: c.phone })) });
    }

    // comptable
    const to = fixText(String(body.to || db.reglagesDepenses?.[userId]?.comptableEmail || "")).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return badRequest("Adresse du comptable à renseigner.");
    const fin = ajouterJours(lundi, 4);
    const envoi = await sendClientMessageEmail({
      to,
      subject: `${nomEntreprise} · heures de la semaine du ${lundi.split("-").reverse().join("/")}`,
      message: `Bonjour,\n\nVoici les heures et absences de l'équipe de ${nomEntreprise}, du ${lundi.split("-").reverse().join("/")} au ${fin.split("-").reverse().join("/")} (fichier joint, une ligne par compagnon et par jour).\n\nTotal : ${heuresDecimales(grille.total)}.\n\nEnvoyé depuis Koji Pro.`,
      attachments: [{ filename: `heures-${lundi}.csv`, content: Buffer.from(csvHeures(grille), "utf8"), contentType: "text/csv" }]
    });
    if (!envoi?.ok) return badRequest(envoi?.error || "L'e-mail n'a pas pu partir.", 502);
    db.reglagesDepenses = db.reglagesDepenses || {};
    db.reglagesDepenses[userId] = { ...(db.reglagesDepenses[userId] || {}), comptableEmail: to };
    trace("attendance.sent_accountant", `Heures envoyées au comptable (semaine du ${lundi.split("-").reverse().join("/")})`, lundi);
    await writeDb(db);
    return ok({ ok: true, to });
  }

  if (!w) return badRequest("Compagnon introuvable.", 404);

  if (action === "inviter") {
    creerInvitation(w, maintenant);
    trace("worker.invited", `Invitation renvoyée : ${w.name}`, w.id);
    const invitation = invitationPour(request, w, nomEntreprise);
    if (w.email) await sendClientMessageEmail({ to: w.email, subject: `${nomEntreprise} vous invite sur Koji`, message: invitation.message }).catch(() => null);
    await writeDb(db);
    return ok({ invitation });
  }

  if (action === "modifier") {
    if (body.nom !== undefined) { const nom = fixText(String(body.nom)).trim().slice(0, 80); if (nom) { const [prenom, ...reste] = nom.split(" "); Object.assign(w, { name: nom, firstName: prenom, lastName: reste.join(" ") }); } }
    if (body.telephone !== undefined) w.phone = fixText(String(body.telephone)).trim().slice(0, 30);
    if (body.metier !== undefined) { w.profession = fixText(String(body.metier)).trim().slice(0, 60); w.role = w.profession; }
    if (body.langue !== undefined && LANGUES.includes(body.langue)) w.langue = body.langue;
    if (body.role !== undefined && ROLES[body.role]) w.roleEquipe = body.role;
    if (body.coutHoraire !== undefined) w.hourlyRate = Math.max(0, Math.min(500, Number(body.coutHoraire) || 0));
    w.updatedAt = maintenant;
    trace("worker.updated", `Fiche mise à jour : ${w.name}`, w.id);
    await writeDb(db);
    return ok({ fiche: ficheCourte(w) });
  }

  if (action === "document") {
    const nom = fixText(String(body.nom || "")).trim().slice(0, 80);
    const jusqua = j10(body.jusqua);
    if (!nom || !/^\d{4}-\d{2}-\d{2}$/.test(jusqua)) return badRequest("Nom du document et date de fin de validité nécessaires.");
    w.documents = [...(w.documents || []), { id: `doc-${Date.now()}`, nom, jusqua, ajouteLe: maintenant }];
    trace("worker.document", `Document ajouté : ${nom} (${w.name})`, w.id);
    await writeDb(db);
    return ok({ documents: w.documents });
  }

  if (action === "retirer-document") {
    w.documents = (w.documents || []).filter((d) => d.id !== body.documentId);
    await writeDb(db);
    return ok({ documents: w.documents });
  }

  if (action === "retirer") {
    w.active = false;
    w.invitation = null;
    w.updatedAt = maintenant;
    trace("worker.removed", `Retiré de l'équipe : ${w.name}`, w.id);
    await writeDb(db);
    return ok({ ok: true });
  }

  return badRequest("Action inconnue.");
}
