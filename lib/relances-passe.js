import { aujourdhuiParis, relanceDue, texteRelance } from "./relances.js";

// Passe quotidienne des relances automatiques (maquette PRO-06.2), sans
// dépendance serveur : envoi, contexte, entreprise et PDF sont fournis par
// lib/relances-serveur.js (et simulés dans les tests).
// J+3 rappel aimable, J+15 relance ferme par e-mail avec la facture ;
// J+30 la mise en demeure est préparée et l'entrepreneur prévenu, elle
// n'est jamais envoyée par Koji seul.

export const reglageRelances = (db, userId) => Boolean(db.relancesAuto?.[userId]?.actif);

export function changerReglageRelances(db, userId, actif) {
  db.relancesAuto = db.relancesAuto || {};
  db.relancesAuto[userId] = { actif: Boolean(actif), majLe: new Date().toISOString() };
  return db.relancesAuto[userId];
}

const creditee = (db, invoice) => (db.invoices || [])
  .filter((a) => a.kind === "avoir" && a.refInvoiceId === invoice.id && a.status !== "Annulee")
  .reduce((s, a) => s - Number(a.amountTtc || 0), 0);

const idNotif = () => `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function passerRelances(db, {
  aujourdhui = aujourdhuiParis(),
  maxEnvois = 200,
  envoyer,
  contexte = async () => ({ quote: null, project: null }),
  entreprise = async () => ({ nom: "", email: "" }),
  pdf = () => null,
  nomPdf = () => "facture.pdf",
  nouvelId = idNotif
} = {}) {
  const fait = { envoyees: [], preparees: [], erreurs: [] };
  const cache = new Map();
  const now = new Date().toISOString();
  for (const invoice of db.invoices || []) {
    if (!invoice.userId || !reglageRelances(db, invoice.userId)) continue;
    const level = relanceDue(invoice, aujourdhui, creditee(db, invoice));
    if (!level) continue;
    if (level === "demeure") {
      invoice.demeurePrete = now;
      invoice.updatedAt = now;
      db.notifications = db.notifications || [];
      db.notifications.unshift({
        id: nouvelId(),
        userId: invoice.userId,
        type: "facture.demeure",
        title: `Mise en demeure prête · ${invoice.client || "client"}`,
        message: `Facture ${invoice.invoiceNumber} impayée depuis 30 jours : Koji a préparé la mise en demeure, à relire et envoyer en recommandé.`,
        actionUrl: `/facturation/impayes?demeure=${invoice.id}`,
        actionLabel: "Préparer la mise en demeure",
        read: false,
        createdAt: now
      });
      fait.preparees.push(invoice.id);
      continue;
    }
    if (!invoice.clientEmail) continue;
    if (fait.envoyees.length >= maxEnvois) break;
    const { quote, project } = await contexte(invoice);
    if (!cache.has(invoice.userId)) cache.set(invoice.userId, await entreprise(invoice.userId));
    const ent = cache.get(invoice.userId);
    const sent = await envoyer({
      to: invoice.clientEmail,
      subject: `${level === "ferme" ? "Relance" : "Rappel"} : facture ${invoice.invoiceNumber}`,
      message: texteRelance(level, invoice, { entreprise: ent.nom, societe: quote?.clientType === "societe", aujourdhui }),
      replyTo: quote?.company?.email || ent.email || undefined,
      pdfBuffer: pdf({ invoice, quote, project, db }),
      pdfFilename: nomPdf(invoice)
    });
    if (!sent?.ok) {
      fait.erreurs.push({ id: invoice.id, erreur: sent?.error || "envoi" });
      continue;
    }
    invoice.reminders = [...(Array.isArray(invoice.reminders) ? invoice.reminders : []), { level, channel: "email", at: now, auto: true }];
    invoice.updatedAt = now;
    fait.envoyees.push({ id: invoice.id, level });
  }
  return fait;
}
