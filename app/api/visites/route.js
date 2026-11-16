import { badRequest, ok } from "../../../lib/http";
import { addHistory, readDb, writeDb } from "../../../lib/db";
import { getAuth, getVerifiedUserId, isUuid } from "../../../lib/server-auth";
import { getSupabaseAdmin } from "../../../lib/supabase";
import { fixText } from "../../../lib/text";
import { sendClientMessageEmail } from "../../../lib/mailer";
import { jourLong, veille } from "../../../lib/visite-mode";

// Mode visite (maquette PRO-03.8). La visite est faite dans l'app Koji Pro,
// gardée sur le téléphone hors ligne et envoyée ici au retour du réseau,
// sans action. Le site en montre le compte rendu (photos, cotes, quantités,
// vérifications, notes). Métadonnées dans db.visites ; photos dans le
// bucket privé « quote_attachments » (visites/…, voir ./photos).
//
// - GET : les visites de l'entreprise ; ?id= : une visite, photos en liens
//   signés (1 h).
// - POST { visite } : enregistre la visite (même id, envoyée autant de fois
//   que nécessaire) ; l'heure du téléphone est contrôlée (écart signalé).
// - POST { action: "resume", id, message, devisPromis } : résumé envoyé au
//   client (jamais de prix), rappel « envoyer le devis » la veille au soir.
// - POST { action: "lier", id, quoteId } : le devis préparé depuis la visite.
const BUCKET = "quote_attachments";
const DUREE_LIEN = 3600;
const txt = (v, max = 300) => fixText(String(v ?? "")).trim().slice(0, max);
const jour = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "");
const instant = (v) => (Number.isFinite(new Date(v).getTime()) && String(v || "").length >= 10 ? new Date(v).toISOString() : "");
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) < 1000 ? Math.round(Number(v) * 100) / 100 : undefined);
const liste = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const emailValide = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()) ? String(v).trim() : "");

// Ce qui vient du téléphone, nettoyé. Les chemins des photos ne viennent
// jamais du téléphone : seulement de l'envoi des photos (./photos).
function propre(v, avant) {
  const photosServeur = new Map(((avant?.pieces || []).flatMap((p) => p.photos || [])).filter((p) => p.path).map((p) => [p.id, p]));
  return {
    id: String(v.id),
    eventId: txt(v.eventId, 80),
    client: txt(v.client, 120),
    email: emailValide(v.email),
    adresse: txt(v.adresse, 200),
    demande: txt(v.demande, 2000),
    rdvLe: instant(v.rdvLe),
    debut: instant(v.debut),
    fin: instant(v.fin),
    devisPromis: jour(v.devisPromis) || avant?.devisPromis || "",
    propositions: Object.fromEntries(Object.entries(v.propositions && typeof v.propositions === "object" ? v.propositions : {})
      .slice(0, 20).filter(([, d]) => d === "acceptee" || d === "refusee").map(([k, d]) => [txt(k, 40), d])),
    pieces: liste(v.pieces, 20).map((p) => ({
      id: txt(p?.id, 60),
      nom: txt(p?.nom, 60) || "Pièce",
      cotes: liste(p?.cotes, 60).map((c) => ({
        id: txt(c?.id, 60), libelle: txt(c?.libelle, 60), valeur: num(c?.valeur), largeur: num(c?.largeur), hauteur: num(c?.hauteur), le: instant(c?.le)
      })),
      points: liste(p?.points, 20).map((x) => ({
        id: txt(x?.id, 40), libelle: txt(x?.libelle, 120), court: txt(x?.court, 60), question: txt(x?.question, 160),
        choix: liste(x?.choix, 6).map((c) => txt(c, 60)), reponse: txt(x?.reponse, 120), detail: txt(x?.detail, 300), photoId: txt(x?.photoId, 60)
      })),
      notes: liste(p?.notes, 40).map((n) => ({ id: txt(n?.id, 60), texte: txt(n?.texte, 1000), le: instant(n?.le), lot: txt(n?.lot, 80) })),
      photos: liste(p?.photos, 80).map((ph) => {
        const serveur = photosServeur.get(String(ph?.id));
        return { id: txt(ph?.id, 60), le: instant(ph?.le), pointId: txt(ph?.pointId, 40), ...(serveur ? { path: serveur.path, recuLe: serveur.recuLe } : {}) };
      })
    }))
  };
}

async function avecLiens(visite) {
  const chemins = (visite.pieces || []).flatMap((p) => p.photos || []).map((p) => p.path).filter(Boolean);
  if (!chemins.length) return visite;
  const { data } = await getSupabaseAdmin().storage.from(BUCKET).createSignedUrls(chemins, DUREE_LIEN);
  const url = new Map((data || []).map((l) => [l.path, l.signedUrl]));
  return { ...visite, pieces: visite.pieces.map((p) => ({ ...p, photos: (p.photos || []).map(({ path, ...ph }) => ({ ...ph, envoyee: Boolean(path), url: url.get(path) || "" })) })) };
}

const sansChemins = (v) => ({ ...v, pieces: (v.pieces || []).map((p) => ({ ...p, photos: (p.photos || []).map(({ path, ...ph }) => ({ ...ph, envoyee: Boolean(path) })) })) });

export async function GET(request) {
  const userId = await getVerifiedUserId(request);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  const db = await readDb();
  const miennes = (db.visites || []).filter((v) => v.userId === userId);
  if (id) {
    const v = miennes.find((x) => x.id === id);
    if (!v) return badRequest("Visite introuvable.", 404);
    return ok({ visite: await avecLiens(v) });
  }
  return ok({ visites: miennes.sort((a, b) => String(b.debut || b.recuLe).localeCompare(String(a.debut || a.recuLe))).slice(0, 50).map(sansChemins) });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const userId = await getVerifiedUserId(request, body);
  if (!userId) return badRequest("Session expirée. Reconnectez-vous.", 401);
  const now = new Date().toISOString();
  const db = await readDb();
  db.visites = Array.isArray(db.visites) ? db.visites : [];

  if (body.action === "resume" || body.action === "lier") {
    const index = db.visites.findIndex((v) => v.id === String(body.id || "") && v.userId === userId);
    if (index < 0) return badRequest("Visite introuvable.", 404);
    const visite = db.visites[index];

    if (body.action === "lier") {
      const quoteId = String(body.quoteId || "");
      if (!isUuid(quoteId)) return badRequest("Devis introuvable.");
      const auth = getAuth(request, body);
      const supabase = auth?.supabase || getSupabaseAdmin();
      const { data: row } = await supabase.from("quotes").select("id, user_id, web_extras").eq("id", quoteId).eq("user_id", userId).maybeSingle();
      if (!row) return badRequest("Devis introuvable.", 404);
      await supabase.from("quotes").update({ web_extras: { ...(row.web_extras || {}), visiteId: visite.id } }).eq("id", quoteId).eq("user_id", userId);
      db.visites[index] = { ...visite, quoteId };
      await writeDb(db);
      return ok({ visite: sansChemins(db.visites[index]) });
    }

    // Résumé au client : information, jamais un devis ni un prix.
    const message = txt(body.message, 2000);
    if (!message) return badRequest("Le résumé est vide.");
    if (/\d\s?€|€\s?\d|\beuros?\b/i.test(message)) return badRequest("Le résumé ne donne aucun prix tant que le devis n'est pas envoyé.");
    const devisPromis = jour(body.devisPromis) || visite.devisPromis || "";
    let emailEnvoye = null;
    if (body.envoyer !== false) {
      const to = emailValide(body.email) || visite.email;
      if (!to) return badRequest("Ajoutez l'e-mail du client pour lui envoyer le résumé.");
      const { data: profil } = await getSupabaseAdmin().from("users").select("email, business_info").eq("id", userId).maybeSingle();
      const entreprise = String(profil?.business_info?.raisonSociale || profil?.business_info?._name || "").trim();
      const r = await sendClientMessageEmail({
        to,
        subject: `Votre visite${entreprise ? ` avec ${entreprise}` : ""}`,
        message: entreprise ? `${message}\n\n${entreprise}` : message,
        replyTo: emailValide(profil?.business_info?.emailPro) || emailValide(profil?.email) || undefined
      }).catch((e) => ({ ok: false, error: e.message }));
      emailEnvoye = Boolean(r?.ok);
      if (!emailEnvoye) return badRequest(`Le résumé n'est pas parti : ${r?.error || "erreur d'envoi"}`, 502);
    }
    // Rappel dans les tâches, la veille au soir de la date promise.
    let rappel = null;
    if (devisPromis && !visite.rappelTacheId) {
      rappel = {
        id: `t-${Date.now()}`,
        userId,
        done: false,
        createdAt: now,
        label: fixText(`Envoyer le devis à ${visite.client || "votre client"}, promis pour ${jourLong(devisPromis)}`),
        project: fixText(visite.client || "Visite"),
        projectId: "",
        room: "",
        dueDate: veille(devisPromis),
        startDate: veille(devisPromis),
        endDate: "",
        startTime: "18:00",
        endTime: "",
        location: fixText(visite.adresse || ""),
        durationHours: 1,
        estimatedHours: 1,
        assignedTo: "Moi",
        workerIds: [],
        participantType: "Moi",
        quoteId: visite.quoteId || "",
        quoteItemId: "",
        code: "",
        unit: "",
        quantity: 0,
        supplyNeeds: [],
        subWorks: [],
        status: "À faire"
      };
      db.tasks = [rappel, ...(db.tasks || [])];
    }
    db.visites[index] = { ...visite, devisPromis, resume: message, resumeEnvoyeLe: emailEnvoye ? now : visite.resumeEnvoyeLe || "", ...(rappel ? { rappelTacheId: rappel.id } : {}) };
    await writeDb(db);
    return ok({ visite: sansChemins(db.visites[index]), emailEnvoye, rappel: rappel ? { id: rappel.id, dueDate: rappel.dueDate } : null });
  }

  const v = body.visite && typeof body.visite === "object" ? body.visite : null;
  if (!v || !isUuid(String(v.id || ""))) return badRequest("Visite invalide.");
  const index = db.visites.findIndex((x) => x.id === v.id);
  if (index >= 0 && db.visites[index].userId !== userId) return badRequest("Visite introuvable.", 404);
  const avant = index >= 0 ? db.visites[index] : null;
  // Heure du téléphone contrôlée à l'envoi : un écart est signalé, l'heure
  // des photos reste celle du téléphone (ne vaut pas constat).
  const telephone = instant(body.envoyeLe);
  const ecartSecondes = telephone ? Math.round((Date.now() - new Date(telephone).getTime()) / 1000) : null;
  const visite = {
    ...(avant || {}),
    ...propre(v, avant),
    userId,
    quoteId: avant?.quoteId || "",
    resumeEnvoyeLe: avant?.resumeEnvoyeLe || "",
    recuLe: now,
    ecartSecondes
  };
  if (index >= 0) db.visites[index] = visite;
  else db.visites.unshift(visite);
  // Visite terminée : une notification mène au compte rendu sur ordinateur.
  if (visite.fin && !avant?.fin) {
    db.notifications.unshift({
      id: `notif-visite-${visite.id}`,
      userId,
      type: "visite.terminee",
      title: "Compte rendu de visite prêt",
      message: `Visite${visite.client ? ` chez ${visite.client}` : ""} : photos, cotes, quantités calculées et vérifications.`,
      actionUrl: `/devis/visite?id=${visite.id}`,
      actionLabel: "Voir le compte rendu",
      read: false,
      createdAt: now
    });
    addHistory(db, { userId, type: "visite.terminee", label: `Visite terminée${visite.client ? ` : ${visite.client}` : ""}`, entityId: visite.id, entityType: "visite" });
  }
  await writeDb(db);
  return ok({ visite: sansChemins(visite), recuLe: now, ecartSecondes });
}
