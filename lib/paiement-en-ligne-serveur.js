import { getSupabaseAdmin } from "./supabase.js";
import { addHistory, readDb, writeDb } from "./db.js";
import { loadInvoiceContext } from "./invoice-context.js";
import { normalizeEmail, quoteBelongsToClient } from "./portal-acces.js";
import { avecProfil } from "./document-profil.js";
import { buildRecuPdf, recuFilename } from "./document-generator/index.js";
import { sendInvoiceReminderEmail } from "./mailer.js";
import { appliquerPaiementEnLigne, etatDepuisStripe, evenementPaye, moyenDepuisStripe, notificationsPaiement, resteSurChantier, urlsInscription } from "./paiement-en-ligne.js";

// Paiement en ligne (Stripe Connect) : lectures et écritures côté serveur.
// Règles pures dans lib/paiement-en-ligne.js. Aucune fonction ici n'est
// appelée par les tests unitaires (pas d'appel à Stripe en test).

const montantFr = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(".", ",");

export async function lireProfil(userId) {
  if (!userId) return null;
  const { data, error } = await getSupabaseAdmin().from("users").select("email, full_name, is_pro, business_info").eq("id", userId).maybeSingle();
  if (error) throw new Error(`Lecture du profil impossible: ${error.message}`);
  return data || null;
}

// Fusionne des champs « _ » dans business_info (relu juste avant).
export async function majBusiness(userId, patch) {
  const supabase = getSupabaseAdmin();
  const profil = await lireProfil(userId);
  if (!profil) return null;
  const business = { ...(profil.business_info || {}), ...patch };
  const { error } = await supabase.from("users").update({ business_info: business }).eq("id", userId);
  if (error) throw new Error(`Enregistrement impossible: ${error.message}`);
  return business;
}

export const nomEntreprise = (profil) => String(profil?.business_info?.raisonSociale || profil?.business_info?.companyName || profil?.full_name || "").trim();

// Compte connecté lu chez Stripe ; null s'il n'existe plus.
export async function compteStripe(stripe, accountId) {
  if (!accountId) return null;
  try {
    return await stripe.accounts.retrieve(accountId);
  } catch (error) {
    if (error?.code === "resource_missing" || error?.statusCode === 404 || error?.statusCode === 403) return null;
    throw error;
  }
}

// Relit l'état réel chez Stripe et met à jour business_info s'il a changé.
export async function synchroniserCompte(stripe, userId, business = {}) {
  const accountId = String(business._stripeConnectAccountId || "");
  if (!accountId) return business;
  const account = await compteStripe(stripe, accountId);
  const patch = account
    ? etatDepuisStripe(account)
    : { _stripeConnectAccountId: "", _stripeConnectCharges: false, _stripeConnectPayouts: false, _stripeConnectDetails: false, _stripeConnectOnboarded: false, _stripeConnectMajLe: new Date().toISOString() };
  // Un compte qui ne porte pas cet utilisateur n'est jamais repris.
  if (account?.metadata?.kojiUserId && account.metadata.kojiUserId !== userId) return business;
  const change = ["_stripeConnectAccountId", "_stripeConnectCharges", "_stripeConnectPayouts", "_stripeConnectDetails", "_stripeConnectExigences", "_stripeConnectBloque"].some((k) => (business[k] ?? "") !== (patch[k] ?? ""));
  if (!change) return business;
  return (await majBusiness(userId, patch)) || { ...business, ...patch };
}

// Crée le compte Express de l'entreprise, ou reprend celui qui existe déjà
// (échéancier du Radar compris).
export async function compteDeLEntreprise(stripe, { userId, email, nom, business = {} }) {
  const existant = await compteStripe(stripe, business._stripeConnectAccountId);
  if (existant && (!existant.metadata?.kojiUserId || existant.metadata.kojiUserId === userId)) return existant.id;
  const account = await stripe.accounts.create({
    type: "express",
    country: "FR",
    ...(email ? { email } : {}),
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    ...(nom ? { business_profile: { name: nom.slice(0, 100) } } : {}),
    metadata: { kojiUserId: userId }
  }, { idempotencyKey: `koji-connect-${userId}-${business._stripeConnectAccountId || "neuf"}` });
  await majBusiness(userId, etatDepuisStripe(account));
  return account.id;
}

export async function lienInscription(stripe, accountId, appUrl, depuis) {
  const urls = urlsInscription(appUrl, depuis);
  const link = await stripe.accountLinks.create({ account: accountId, type: "account_onboarding", ...urls });
  return link.url;
}

// La facture du particulier connecté (même vérification que
// /api/client/factures/[id]/pdf) ; null sinon.
export async function factureDuClient({ db, user }, id) {
  const invoice = (db.invoices || []).find((f) => f.id === String(id || ""));
  if (!invoice || invoice.status === "Brouillon" || invoice.archived) return null;
  const { quote, project } = await loadInvoiceContext(invoice);
  const email = normalizeEmail(user.email);
  const aLui = quote
    ? (!invoice.userId || !quote.userId || quote.userId === invoice.userId) && quoteBelongsToClient(quote, project, user, email)
    : Boolean(project && (project.userId === invoice.userId || !invoice.userId)
      && (user.clientAccess?.projectIds?.includes(project.id) || (email && normalizeEmail(project.clientEmail) === email)));
  return aLui ? { invoice, quote, project } : null;
}

// ─── Webhook Connect ──────────────────────────────────────────────────

async function utilisateurDuCompte(accountId) {
  const { data } = await getSupabaseAdmin().from("users").select("id, business_info").eq("business_info->>_stripeConnectAccountId", accountId).limit(2);
  return data?.length === 1 ? data[0] : null;
}

// account.updated : état réel du compte (encaissements, virements).
export async function majCompteDepuisEvenement(account) {
  const userId = account?.metadata?.kojiUserId || (await utilisateurDuCompte(account?.id))?.id || "";
  if (!userId) return { statut: "ignore" };
  const profil = await lireProfil(userId);
  const actuel = String(profil?.business_info?._stripeConnectAccountId || "");
  if (actuel && actuel !== account.id) return { statut: "ignore" };
  await majBusiness(userId, etatDepuisStripe(account));
  return { statut: "enregistre" };
}

// L'entreprise a retiré l'accès de Koji à son compte.
export async function compteDeconnecte(accountId) {
  const u = await utilisateurDuCompte(accountId);
  if (!u) return { statut: "ignore" };
  await majBusiness(u.id, { _stripeConnectCharges: false, _stripeConnectPayouts: false, _stripeConnectOnboarded: false, _stripeConnectMajLe: new Date().toISOString() });
  return { statut: "enregistre" };
}

// Paiement confirmé : paiement ajouté à la facture (sans doublon),
// notifications, puis reçu au client (règle PRO-06.3 : reçu automatique
// pour un paiement en ligne). Lève une erreur si l'écriture échoue, pour que
// Stripe renvoie l'événement.
export async function enregistrerPaiementConfirme(stripe, evenement) {
  if (!evenementPaye(evenement)) return { statut: "ignore" };
  const s = evenement.data.object;
  const meta = s.metadata || {};
  if (!meta.kojiFactureId || !meta.kojiEntrepriseId) return { statut: "ignore" };
  const profil = await lireProfil(meta.kojiEntrepriseId);
  const compte = String(profil?.business_info?._stripeConnectAccountId || "");

  let moyen = "carte";
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
  if (pi) {
    try {
      const intent = await stripe.paymentIntents.retrieve(pi, { expand: ["payment_method"] }, { stripeAccount: evenement.account });
      moyen = moyenDepuisStripe(intent.payment_method?.type || intent.payment_method_types?.[0]);
    } catch { /* moyen inconnu : carte par défaut */ }
  }

  const db = await readDb();
  const avant = (db.invoices || []).find((f) => f.id === meta.kojiFactureId);
  const contexte = avant ? await loadInvoiceContext(avant) : { quote: null, project: null };
  const maintenant = new Date().toISOString();
  const r = appliquerPaiementEnLigne(db, { evenement, compteEntreprise: compte, moyen, maintenant });
  if (r.statut !== "enregistre") return r;

  const { invoice, paiement } = r;
  paiement.resteChantier = resteSurChantier(db, invoice, contexte.quote);
  const nom = nomEntreprise(profil) || String(contexte.quote?.company?.name || "").trim();
  const clientExiste = (db.users || []).some((u) => u.id === paiement.clientId && u.accountType === "particulier");
  const notifs = notificationsPaiement({ invoice, paiement: clientExiste ? paiement : { ...paiement, clientId: "" }, solde: r.solde, entrepriseNom: nom, maintenant });
  db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
  for (const n of notifs.reverse()) if (!db.notifications.some((x) => x.id === n.id)) db.notifications.unshift(n);
  addHistory(db, {
    userId: invoice.userId,
    type: "invoice.payment",
    label: `Paiement en ligne reçu : ${invoice.invoiceNumber || ""} (${montantFr(paiement.amount)} €)`,
    entityId: invoice.id,
    entityType: "invoice",
    meta: { stripePaymentIntent: paiement.stripePaymentIntent, montant: paiement.amount }
  });
  await writeDb(db);

  // Reçu PDF au client, comme « Envoyer un reçu » de PRO-06.3.
  const destinataire = String(invoice.clientEmail || s.customer_details?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinataire)) return { ...r, recu: false };
  let envoi = { ok: false, error: "envoi" };
  try {
    await avecProfil(db, invoice.userId);
    envoi = await sendInvoiceReminderEmail({
      to: destinataire,
      subject: `Paiement reçu : facture ${invoice.invoiceNumber || ""}`.trim(),
      message: `Bonjour,\n\n${nom || "L'entreprise"} a bien reçu votre paiement en ligne de ${montantFr(paiement.amount)} € pour la facture ${invoice.invoiceNumber || ""}. Vous trouverez le reçu en pièce jointe ; il est aussi dans Documents, dans votre espace Koji.${paiement.resteFacture > 0.01 ? `\n\nReste dû sur cette facture : ${montantFr(paiement.resteFacture)} €.` : ""}\n\nMerci.`,
      replyTo: contexte.quote?.company?.email || profil?.email || undefined,
      pdfBuffer: buildRecuPdf({ invoice, paiement, resteFacture: paiement.resteFacture, resteChantier: paiement.resteChantier, quote: contexte.quote, project: contexte.project, db }),
      pdfFilename: recuFilename(invoice, paiement)
    });
  } catch (error) {
    envoi = { ok: false, error: error?.message || "envoi" };
  }
  // Le paiement reste enregistré même si le reçu n'est pas parti.
  try {
    const db2 = await readDb();
    const p = (db2.invoices || []).find((f) => f.id === invoice.id)?.payments?.find((x) => x.id === paiement.id);
    if (p) {
      p.recuEnvoye = Boolean(envoi?.ok);
      if (!envoi?.ok) p.recuErreur = String(envoi?.error || "envoi").slice(0, 200);
      await writeDb(db2);
    }
  } catch { /* trace du reçu seulement */ }
  return { ...r, recu: Boolean(envoi?.ok) };
}
