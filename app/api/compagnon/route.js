import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getVerifiedWorkerId } from "../../../lib/worker-session";
import { addCompanyNotification, applyWorkerClockAction } from "../../../lib/worker-portal";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { buildWebUser } from "../../../lib/user-profile";
import { fixText } from "../../../lib/text";
import { chantiersDe, enregistrerPhotoCompagnon, tacheCompagnon, vueCompagnon } from "../../../lib/equipe-serveur";

// Vue compagnon (maquettes PRO-16, 16.4, 16.5) : sa journée, sa semaine,
// ses heures, ses documents ; « Je suis arrivé » / « Je pars », cocher une
// tâche, photo de fin, signaler un problème. Session = lien d'invitation
// (cookie) sur le site, jeton Bearer dans l'app. Jamais un prix, jamais le
// nom d'un client.
const LANGUES = ["fr", "pt", "ar", "tr", "ro", "pl", "ta", "zh", "en", "es", "it", "de"];

async function compagnon(request, body = null) {
  const workerId = getVerifiedWorkerId(request, body);
  if (!workerId) return { erreur: badRequest("Session expirée : ouvrez à nouveau le lien reçu par SMS.", 401) };
  const db = await readDb();
  const worker = (db.workers || []).find((w) => w.id === workerId);
  if (!worker || worker.active === false) return { erreur: badRequest("Accès désactivé. Contactez votre entreprise.", 403) };
  return { db, worker };
}

async function nomEntreprise(userId) {
  try {
    const { data } = await getSupabaseAdmin().from("users").select("*").eq("id", userId).maybeSingle();
    const u = data ? buildWebUser({ id: data.id, email: data.email || "", profile: data }) : null;
    return u?.business?.raisonSociale || u?.name || "";
  } catch { return ""; }
}

async function vue(db, worker) {
  const [chantiers, entreprise] = await Promise.all([chantiersDe(worker.userId).catch(() => new Map()), nomEntreprise(worker.userId)]);
  return { chantiers, data: vueCompagnon(db, worker, { chantiers, entreprise }) };
}

export async function GET(request) {
  const c = await compagnon(request);
  if (c.erreur) return c.erreur;
  return ok((await vue(c.db, c.worker)).data);
}

export async function POST(request) {
  const multipart = (request.headers.get("content-type") || "").includes("multipart/form-data");
  let body = {};
  let form = null;
  try { if (multipart) form = await request.formData(); else body = await request.json(); } catch { return badRequest("Envoi invalide."); }
  const c = await compagnon(request, body);
  if (c.erreur) return c.erreur;
  const { db, worker } = c;
  const maintenant = new Date().toISOString();
  const { chantiers, data } = await vue(db, worker);
  const mesTaches = (db.tasks || []).filter((t) => t.userId === worker.userId && (t.workerIds || []).includes(worker.id));
  const notifier = (payload) => addCompanyNotification(db, { userId: worker.userId, workerId: worker.id, ...payload });

  if (form) {
    const fichier = form.get("file");
    const taskId = String(form.get("taskId") || "");
    const mode = String(form.get("mode") || "fin");
    const message = fixText(String(form.get("message") || "")).slice(0, 1000);
    const t = mesTaches.find((x) => x.id === taskId);
    const projectId = t?.projectId || String(form.get("projectId") || data.journee.projectId || "");
    if (!projectId || !(t || mesTaches.some((x) => x.projectId === projectId))) return badRequest("Chantier introuvable pour vous.");
    if (!fichier || typeof fichier === "string") return badRequest("Photo manquante.");
    let photo;
    try { photo = await enregistrerPhotoCompagnon(db, worker, { fichier, projectId, taskId: t?.id || "", lot: t?.room || "", phase: mode === "probleme" ? "pendant" : "apres" }); } catch (e) { return badRequest(e.message, 400); }
    const chantier = chantiers.get(projectId)?.title || "le chantier";
    if (mode === "probleme") {
      db.workerClaims = [{ id: `wc-${Date.now()}`, userId: worker.userId, workerId: worker.id, projectId, taskId: t?.id || "", category: "Problème chantier", message, photoId: photo.id, status: "Envoyee", createdAt: maintenant }, ...(db.workerClaims || [])];
      notifier({ projectId, taskId: t?.id || "", type: "company.worker_claim", title: `Problème signalé par ${worker.name}`, message: `${chantier}${t ? ` · ${t.label}` : ""}${message ? ` : ${message}` : ""} (photo jointe)`, actionUrl: `/chantiers?project=${projectId}`, actionLabel: "Voir le chantier" });
    } else {
      notifier({ projectId, taskId: t?.id || "", type: "company.worker_photo", title: `Photo de fin : ${worker.name}`, message: `${chantier}${t ? ` · ${t.label}` : ""}`, actionUrl: `/chantiers?project=${projectId}`, actionLabel: "Voir les photos" });
    }
    addHistory(db, { userId: worker.userId, type: `worker.photo_${mode}`, label: `Photo ${mode === "probleme" ? "de problème" : "de fin"} : ${worker.name}`, entityId: photo.id, entityType: "chantier-photo", meta: { workerId: worker.id, projectId, taskId: t?.id || "" } });
    await writeDb(db);
    return ok({ ok: true, photoId: photo.id }, 201);
  }

  const action = String(body.action || "");

  if (action === "arrive" || action === "pars") {
    if (action === "arrive" && data.journee.conge) return badRequest("Vous êtes en congé aujourd'hui.");
    const depuis = body.depuis === "ordinateur" ? "ordinateur" : "telephone";
    const r = applyWorkerClockAction(db, { worker, action: action === "arrive" ? "clockIn" : "clockOut", projectId: data.journee.projectId, depuis });
    if (action === "pars" && r?.notOpen) return badRequest("Vous n'avez pas pointé votre arrivée aujourd'hui.");
    await writeDb(db);
    return ok((await vue(db, worker)).data);
  }

  if (action === "tache") {
    const t = mesTaches.find((x) => x.id === body.taskId);
    if (!t) return badRequest("Tâche introuvable.", 404);
    t.done = Boolean(body.fait);
    t.updatedAt = maintenant;
    if (t.done) t.faitPar = { workerId: worker.id, le: maintenant };
    addHistory(db, { userId: worker.userId, type: t.done ? "task.done" : "task.reopened", label: `${t.label} : ${t.done ? "fait" : "à refaire"} (${worker.name})`, entityId: t.id, entityType: "task", meta: { workerId: worker.id, projectId: t.projectId || "" } });
    await writeDb(db);
    return ok({ tache: tacheCompagnon(t, chantiers) });
  }

  if (action === "probleme") {
    const message = fixText(String(body.message || "")).trim().slice(0, 1000);
    if (!message) return badRequest("Écrivez le problème en quelques mots.");
    const t = mesTaches.find((x) => x.id === body.taskId);
    const projectId = t?.projectId || data.journee.projectId || "";
    db.workerClaims = [{ id: `wc-${Date.now()}`, userId: worker.userId, workerId: worker.id, projectId, taskId: t?.id || "", category: "Problème chantier", message, status: "Envoyee", createdAt: maintenant }, ...(db.workerClaims || [])];
    notifier({ projectId, taskId: t?.id || "", type: "company.worker_claim", title: `Problème signalé par ${worker.name}`, message: `${chantiers.get(projectId)?.title || "Chantier"}${t ? ` · ${t.label}` : ""} : ${message}`, actionUrl: projectId ? `/chantiers?project=${projectId}` : "/equipe", actionLabel: "Voir" });
    await writeDb(db);
    return ok({ ok: true });
  }

  if (action === "langue") {
    if (!LANGUES.includes(body.langue)) return badRequest("Langue inconnue.");
    worker.langue = body.langue;
    await writeDb(db);
    return ok({ langue: worker.langue });
  }

  if (action === "lu") {
    for (const n of db.notifications || []) if (n.workerId === worker.id && n.audience === "worker") n.read = true;
    await writeDb(db);
    return ok({ ok: true });
  }

  return badRequest("Action inconnue.");
}
