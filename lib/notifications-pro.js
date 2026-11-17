// Centre de notifications Koji Pro (maquette PRO-23) : un fait, une action.
// Type → catégorie (icône), regroupement par jour, archivage automatique à
// 30 jours. Règles pures, testées dans tests/unit/notifications-pro.test.js.

export const ARCHIVE_JOURS = 30;

// Catégories de la maquette : devis, paiement, Radar, message, rendez-vous,
// équipe, réserve (+ avis, document, info).
export function categorieDe(type = "") {
  const t = String(type);
  if (/^(quote|avenant|signature)\./.test(t)) return "devis";
  if (/^(invoice|payment|paiement)\.|paiement|acompte/.test(t)) return "paiement";
  if (/^(radar|marketplace)\./.test(t)) return /rdv/.test(t) ? "rdv" : "radar";
  if (/^(client\.note|company\.note|message|reseau\.message|task\.client_note|task\.company_reply)/.test(t)) return "message";
  if (/^(rdv|calendar|visite)\./.test(t)) return "rdv";
  if (/^(worker|company\.worker|company\.time|attendance|task\.)/.test(t)) return "equipe";
  if (/reserve/.test(t)) return "reserve";
  if (/^(avis|site\.avis)/.test(t)) return "avis";
  if (/^document\./.test(t)) return "document";
  if (/^site\./.test(t)) return "message";
  return "info";
}

export const LIBELLES = { devis: "Devis", paiement: "Paiement", radar: "Radar", message: "Message", rdv: "Rendez-vous", equipe: "Équipe", reserve: "Réserve", avis: "Avis", document: "Document", info: "Info" };

const jourParis = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));

export function estArchivee(n = {}, maintenant = new Date().toISOString()) {
  if (n.archived) return true;
  const t = Date.parse(n.createdAt || "");
  return Number.isFinite(t) && Date.parse(maintenant) - t > ARCHIVE_JOURS * 86400000;
}

// « Aujourd'hui », « Hier », « Cette semaine », puis le mois.
export function groupeDe(iso, maintenant = new Date().toISOString()) {
  if (!iso) return "Plus ancien";
  const j = jourParis(iso);
  const auj = jourParis(maintenant);
  const ecart = Math.round((Date.parse(`${auj}T12:00:00Z`) - Date.parse(`${j}T12:00:00Z`)) / 86400000);
  if (ecart <= 0) return "Aujourd'hui";
  if (ecart === 1) return "Hier";
  const d = new Date(`${auj}T12:00:00Z`);
  const lundi = new Date(d);
  lundi.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  if (j >= lundi.toISOString().slice(0, 10)) return "Cette semaine";
  const m = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${j}T12:00:00Z`));
  return m.charAt(0).toUpperCase() + m.slice(1);
}

// Heure dans la liste : « 09:12 » aujourd'hui et hier, « lun. » cette
// semaine, « 3 nov. » avant.
export function heureListe(iso, maintenant = new Date().toISOString()) {
  const g = groupeDe(iso, maintenant);
  const d = new Date(iso);
  if (g === "Aujourd'hui" || g === "Hier") return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Paris" }).format(d);
  if (g === "Cette semaine") return new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "Europe/Paris" }).format(d);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" }).format(d);
}

export function grouper(liste = [], maintenant = new Date().toISOString()) {
  const tri = [...liste].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const groupes = [];
  for (const n of tri) {
    const g = groupeDe(n.createdAt, maintenant);
    if (!groupes.length || groupes.at(-1).titre !== g) groupes.push({ titre: g, items: [] });
    groupes.at(-1).items.push(n);
  }
  return groupes;
}

// Liens de l'objet concerné : une action principale (au plus) et des
// actions secondaires.
export function actionsDe(n = {}) {
  const principale = n.actionUrl ? { label: n.actionLabel || "Ouvrir", href: n.actionUrl } : null;
  const secondaires = [];
  if (n.quoteId && !String(n.actionUrl || "").includes(n.quoteId)) secondaires.push({ label: "Voir le devis", href: `/devis?id=${n.quoteId}` });
  if (n.projectId && !String(n.actionUrl || "").includes(n.projectId)) secondaires.push({ label: "Voir le chantier", href: `/chantiers?project=${n.projectId}` });
  if (!principale && secondaires.length) return { principale: secondaires[0], secondaires: secondaires.slice(1) };
  return { principale, secondaires };
}
