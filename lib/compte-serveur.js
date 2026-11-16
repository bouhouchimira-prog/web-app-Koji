// Profil et compte (PRO-15 à 15.6) côté serveur : réglages du compte dans
// db.comptePrefs[userId] { notifications, langue }, e-mails des
// notifications selon ces réglages (silence le soir et le dimanche),
// tâches du matin (e-mails différés, documents qui expirent, résumé du
// lundi).
import { decisionEmail, documentsExpirant, enSilence, evenementDe, normaliserPrefs, reglagesLangue } from "./compte-pro.js";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "https://getkoji.io";
const FRAICHEUR_MS = 10 * 60 * 1000;

export function prefsCompte(db, userId) {
  const p = db.comptePrefs?.[userId] || {};
  return { notifications: normaliserPrefs(p.notifications), langue: reglagesLangue(p.langue) };
}

export function enregistrerPrefs(db, userId, { notifications, langue } = {}) {
  db.comptePrefs = db.comptePrefs || {};
  const p = (db.comptePrefs[userId] = db.comptePrefs[userId] || {});
  if (notifications) p.notifications = normaliserPrefs(notifications);
  if (langue) p.langue = reglagesLangue({ ...(p.langue || {}), ...langue });
  return prefsCompte(db, userId);
}

function corpsEmail(n) {
  const lien = n.actionUrl ? `${/^https?:/.test(n.actionUrl) ? "" : SITE()}${n.actionUrl}` : "";
  return [n.message || "", lien ? `\n${n.actionLabel || "Ouvrir dans Koji"} : ${lien}` : "", "\nVous recevez cet e-mail parce que cette alerte est activée dans Paramètres › Notifications."].filter(Boolean).join("\n");
}

async function emailsDe(ids) {
  const { getSupabaseAdmin } = await import("./supabase.js");
  const { data } = await getSupabaseAdmin().from("users").select("id,email").in("id", [...new Set(ids)]);
  return new Map((data || []).map((u) => [u.id, u.email]));
}

async function envoyer(notifs) {
  if (!notifs.length) return;
  const { sendClientMessageEmail } = await import("./mailer.js");
  const emails = await emailsDe(notifs.map((n) => n.userId));
  for (const n of notifs) {
    const to = emails.get(n.userId);
    if (!to) { n.canal = "sans-adresse"; continue; }
    const r = await sendClientMessageEmail({ to, subject: `Koji Pro · ${n.title || "Notification"}`, message: corpsEmail(n) }).catch(() => null);
    n.canal = r && r.ok === false ? "echec" : "email";
    n.canalLe = new Date().toISOString();
  }
}

// Appelé juste avant chaque écriture de la base : une notification toute
// neuve d'un type réglable part par e-mail, ou attend la fin du silence.
// Ne lève jamais d'erreur : une notification ne doit pas bloquer une écriture.
export async function traiterNotifications(db, maintenant = new Date().toISOString()) {
  try {
    const neuves = (db.notifications || []).slice(0, 25).filter((n) => n && !n.canal && n.userId && evenementDe(n.type) && Date.parse(maintenant) - Date.parse(n.createdAt || 0) < FRAICHEUR_MS);
    if (!neuves.length) return;
    const aEnvoyer = [];
    for (const n of neuves) {
      const d = decisionEmail(db.comptePrefs?.[n.userId]?.notifications, n.type, maintenant);
      if (d === "envoyer") aEnvoyer.push(n);
      else n.canal = d === "differer" ? "differe" : "aucun";
    }
    await envoyer(aEnvoyer);
  } catch { /* une alerte ne bloque jamais l'écriture */ }
}

// Tâches du matin (appelées par la tâche planifiée quotidienne, 8 h à Paris).
export async function tachesDuMatin(db, maintenant = new Date().toISOString()) {
  const bilan = { differes: 0, documents: 0, resumes: 0 };
  if (enSilence(maintenant)) return bilan; // dimanche : tout attend lundi
  const jour = maintenant.slice(0, 10);

  // 1. E-mails mis en attente pendant le silence.
  const differes = (db.notifications || []).filter((n) => n.canal === "differe");
  await envoyer(differes);
  bilan.differes = differes.length;

  // 2. Documents de l'entreprise qui expirent (30 jours, 7 jours, jour même).
  const { getSupabaseAdmin } = await import("./supabase.js");
  const { buildWebUser } = await import("./user-profile.js");
  const { data: rows } = await getSupabaseAdmin().from("users").select("*").eq("is_pro", true);
  const comptes = (rows || []).map((profile) => buildWebUser({ id: profile.id, email: profile.email || "", profile }));
  const nouvelles = [];
  for (const u of comptes) {
    for (const doc of documentsExpirant(u.business || {}, maintenant)) {
      if (![30, 7, 0].includes(doc.jours)) continue;
      const id = `notif-doc-${u.id}-${doc.id}-${doc.jusqua}-${doc.jours}`;
      if ((db.notifications || []).some((n) => n.id === id)) continue;
      nouvelles.push({
        id, userId: u.id, type: "document.expire",
        title: doc.jours === 0 ? `${doc.nom} : expire aujourd'hui` : `${doc.nom} : expire dans ${doc.jours} jours`,
        message: `Votre ${doc.nom.toLowerCase()} est valable jusqu'au ${doc.jusqua.split("-").reverse().join("/")}. Remplacez l'attestation dans votre profil pour qu'elle reste sur vos devis et votre KojiPage.`,
        actionUrl: "/profil", actionLabel: "Ouvrir mon profil", read: false, createdAt: maintenant
      });
    }
  }

  // 3. Résumé de la semaine, le lundi.
  const lundi = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date(maintenant)).startsWith("lun");
  if (lundi) {
    const depuis = new Date(Date.parse(maintenant) - 7 * 86400000).toISOString();
    for (const u of comptes) {
      if (!normaliserPrefs(db.comptePrefs?.[u.id]?.notifications).evenements.resume_semaine.email) continue;
      const id = `notif-resume-${u.id}-${jour}`;
      if ((db.notifications || []).some((n) => n.id === id)) continue;
      const mes = (liste) => (liste || []).filter((x) => x.userId === u.id);
      const signes = (db.notifications || []).filter((n) => n.userId === u.id && n.type === "quote.signed" && n.createdAt >= depuis).length;
      const demandes = mes(db.companySiteLeads).filter((l) => l.createdAt >= depuis).length;
      const echues = mes(db.invoices).filter((i) => ["Emise", "Partielle"].includes(i.status) && i.dueDate && i.dueDate < jour).length;
      const aRepondre = mes(db.companySiteLeads).filter((l) => !l.reponduLe && !l.declineeLe).length;
      if (!signes && !demandes && !echues && !aRepondre) continue;
      const lignes = [
        signes ? `${signes} devis signé${signes > 1 ? "s" : ""} la semaine dernière` : "",
        demandes ? `${demandes} demande${demandes > 1 ? "s" : ""} reçue${demandes > 1 ? "s" : ""} par votre KojiPage` : "",
        aRepondre ? `${aRepondre} demande${aRepondre > 1 ? "s" : ""} à laquelle répondre` : "",
        echues ? `${echues} facture${echues > 1 ? "s" : ""} échue${echues > 1 ? "s" : ""} à relancer` : ""
      ].filter(Boolean);
      nouvelles.push({ id, userId: u.id, type: "resume.semaine", title: "Votre semaine", message: lignes.join("\n"), actionUrl: "/", actionLabel: "Ouvrir Koji Pro", read: false, createdAt: maintenant });
      bilan.resumes += 1;
    }
  }
  if (nouvelles.length) {
    db.notifications = [...nouvelles, ...(db.notifications || [])];
    bilan.documents = nouvelles.filter((n) => n.type === "document.expire").length;
    // Envoi direct, hors du délai de fraîcheur : chaque e-mail suit le réglage du compte.
    const aEnvoyer = nouvelles.filter((n) => {
      const d = decisionEmail(db.comptePrefs?.[n.userId]?.notifications, n.type, maintenant);
      if (d !== "envoyer") n.canal = d === "differer" ? "differe" : "aucun";
      return d === "envoyer";
    });
    await envoyer(aEnvoyer);
  }
  return bilan;
}

// CGV déposées par l'entreprise (PRO-15.2), pour les joindre au devis envoyé.
export async function cgvPourEnvoi(supabase, userId) {
  const { data } = await supabase.from("users").select("business_info").eq("id", userId).maybeSingle();
  if (!data?.business_info?.cgv?.nom) return null;
  const { getSupabaseAdmin } = await import("./supabase.js");
  const fichier = await getSupabaseAdmin().storage.from("quote_attachments").download(`compte/${userId}/cgv.pdf`);
  if (fichier.error || !fichier.data) return null;
  return { filename: "Conditions-generales-de-vente.pdf", buffer: Buffer.from(await fichier.data.arrayBuffer()) };
}
