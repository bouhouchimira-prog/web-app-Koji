// Paiement en ligne des factures par le particulier (décision d'Amira du
// 19 nov.) : Stripe Connect, comptes Express, l'argent va à l'entreprise,
// jamais à Koji. Règles pures, testées dans tests/unit/paiement-en-ligne.test.js ;
// les appels à Stripe sont dans lib/paiement-en-ligne-serveur.js.
//
// Charge directe sur le compte connecté (Checkout créé « au nom » du compte
// de l'entreprise, en-tête Stripe-Account) plutôt qu'un paiement à
// destination : l'entreprise qui a émis la facture est le marchand (son nom
// sur le relevé du client, son reçu), les fonds ne passent jamais par le
// solde de Koji, et un litige ou un remboursement se règle d'abord sur le
// solde de l'entreprise. Avec un paiement à destination (même avec
// on_behalf_of), l'argent arrive d'abord chez Koji et les litiges sont
// débités du solde de Koji.

import { encaisse, resteDu } from "./encaissements.js";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const euros = (n) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(r2(n));

// Textes de la maquette CLI-02 (site, puis app sous le bouton).
export const NOTE_PAIEMENT_EN_LIGNE = "Carte ou virement, par notre prestataire de paiement agréé. Koji ne détient pas les fonds ; le reçu arrive dans Documents.";
export const MENTION_BOUTON_PAYER = "Paiement par carte ou virement, sécurisé par notre prestataire.";
export const NOTE_PAIEMENT_MIXTE = "Paiement en ligne quand l'entreprise le propose, par notre prestataire de paiement agréé ; sinon, réglez par virement avec les coordonnées indiquées sur la facture. Koji ne détient pas les fonds.";

// Montant minimal d'un paiement par carte en euros chez Stripe.
export const MINIMUM_EUROS = 0.5;

// ─── Interrupteur général et commission (variables d'environnement) ────

// Rien n'apparaît tant que PAIEMENT_EN_LIGNE_ACTIF ne vaut pas 1 (activation
// de Connect par Bilal dans le tableau de bord Stripe d'abord).
export function interrupteurActif(env = process.env) {
  return ["1", "true", "oui", "on"].includes(String(env?.PAIEMENT_EN_LIGNE_ACTIF || "").trim().toLowerCase());
}

const nombreEnv = (v) => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// Commission de Koji (application_fee_amount, en centimes) : 0 par défaut.
// PAIEMENT_EN_LIGNE_COMMISSION_POURCENT (ex. 1,5) et
// PAIEMENT_EN_LIGNE_COMMISSION_FIXE_CENTIMES (ex. 25). Décision à prendre
// avec Bilal ; jamais plus que le montant payé.
export function commissionCentimes(montantCentimes, env = process.env) {
  const montant = Math.max(0, Math.round(Number(montantCentimes) || 0));
  const pourcent = Math.min(nombreEnv(env?.PAIEMENT_EN_LIGNE_COMMISSION_POURCENT), 100);
  const fixe = Math.round(nombreEnv(env?.PAIEMENT_EN_LIGNE_COMMISSION_FIXE_CENTIMES));
  const total = Math.round(montant * pourcent / 100) + fixe;
  return Math.min(total, montant);
}

export const centimes = (montantEuros) => Math.round(r2(montantEuros) * 100);

// ─── État du compte de l'entreprise (business_info, lu chez Stripe) ────

// Champs « _ » de business_info : jamais modifiés par le formulaire du profil
// (lib/user-profile.js). _stripeConnectAccountId et _stripeConnectOnboarded
// sont ceux de l'échéancier du Radar (app/api/billing/connect) : un seul
// compte connecté par entreprise.
export function etatDepuisStripe(account = {}, maintenant = new Date().toISOString()) {
  const encaissements = account.charges_enabled === true;
  const virements = account.payouts_enabled === true;
  const exigences = Array.isArray(account.requirements?.currently_due) ? account.requirements.currently_due.length : 0;
  return {
    _stripeConnectAccountId: String(account.id || ""),
    _stripeConnectCharges: encaissements,
    _stripeConnectPayouts: virements,
    _stripeConnectDetails: account.details_submitted === true,
    _stripeConnectOnboarded: encaissements && virements,
    _stripeConnectExigences: exigences,
    _stripeConnectBloque: String(account.requirements?.disabled_reason || ""),
    _stripeConnectMajLe: maintenant
  };
}

export function etatCompte(business = {}) {
  const b = business || {};
  return {
    compte: String(b._stripeConnectAccountId || ""),
    encaissements: b._stripeConnectCharges === true,
    virements: b._stripeConnectPayouts === true,
    dossierEnvoye: b._stripeConnectDetails === true,
    exigences: Number(b._stripeConnectExigences) || 0,
    bloque: String(b._stripeConnectBloque || ""),
    suspendu: b._paiementEnLigneSuspendu === true
  };
}

// Le bouton « Payer » n'existe que si Stripe a confirmé que le compte de
// l'entreprise peut encaisser ET verser sur son compte bancaire, et que
// l'entreprise ne l'a pas mis en pause.
export function peutEncaisser(business = {}, { actif = interrupteurActif() } = {}) {
  if (!actif) return false;
  const e = etatCompte(business);
  return Boolean(e.compte) && e.encaissements && e.virements && !e.suspendu;
}

// Ce que voit l'entreprise (PRO-15.2 et PRO-06.3). « actif » n'est vrai que
// lorsque Stripe l'a confirmé.
export function vueComptePro(business = {}, { actif = interrupteurActif() } = {}) {
  const e = etatCompte(business);
  const base = { disponible: actif, actif: false, compte: Boolean(e.compte), encaissements: e.encaissements, virements: e.virements, tableau: Boolean(e.compte) && e.dossierEnvoye };
  if (!actif) return { ...base, etat: "indisponible", detail: "bientôt · prestataire et frais par paiement à fixer", action: null };
  if (!e.compte) return { ...base, etat: "a_activer", detail: "vérification d'identité de l'entreprise à l'activation · frais par paiement à fixer", action: { id: "inscription", libelle: "Activer le paiement en ligne" } };
  if (!e.dossierEnvoye) return { ...base, etat: "a_finaliser", detail: "inscription commencée · à terminer chez notre prestataire de paiement", action: { id: "inscription", libelle: "Terminer l'inscription" } };
  if (!e.encaissements || !e.virements) {
    const manque = !e.encaissements ? "les paiements ne sont pas encore ouverts" : "les virements vers votre banque ne sont pas encore ouverts";
    const detail = e.exigences > 0
      ? `le prestataire demande ${e.exigences > 1 ? `${e.exigences} informations` : "une information"} de plus · ${manque}`
      : `vérification de votre entreprise en cours chez le prestataire · ${manque}`;
    return { ...base, etat: "verification", detail, action: e.exigences > 0 ? { id: "inscription", libelle: "Compléter chez le prestataire" } : null };
  }
  if (e.suspendu) return { ...base, etat: "suspendu", detail: "en pause · vos clients règlent par virement", action: { id: "reprendre", libelle: "Réactiver" } };
  return { ...base, etat: "actif", actif: true, detail: "actif · vos clients paient leurs factures en ligne, l'argent arrive sur votre compte", action: { id: "pause", libelle: "Mettre en pause" } };
}

// Retour de l'inscription chez Stripe (Account Links) : la page d'où
// l'entreprise est partie ; « relancer » quand le lien a expiré.
export function urlsInscription(appUrl, depuis = "profil") {
  const base = String(appUrl || "").replace(/\/+$/, "");
  if (depuis === "app") return { return_url: `${base}/paiement-retour?app=pro&etat=retour`, refresh_url: `${base}/paiement-retour?app=pro&etat=relancer` };
  const page = depuis === "encaissements" ? `${base}/facturation?onglet=encaissements&` : `${base}/profil?tab=devis&`;
  return { return_url: `${page}paiement=retour`, refresh_url: `${page}paiement=relancer` };
}

// ─── Montant à payer (calculé par le serveur, jamais par le navigateur) ─

export function creditDe(invoice, factures = []) {
  return r2(factures
    .filter((a) => a.kind === "avoir" && a.refInvoiceId === invoice?.id && a.status !== "Annulee")
    .reduce((s, a) => s + Math.abs(Number(a.amountTtc) || 0), 0));
}

// { ok, du, centimes } ou { ok: false, erreur, code }.
export function montantAPayer(invoice, factures = []) {
  if (!invoice || invoice.kind === "avoir" || invoice.archived || invoice.status !== "Emise") {
    return { ok: false, erreur: "Cette facture ne se règle pas en ligne.", code: 409 };
  }
  const du = resteDu(invoice, creditDe(invoice, factures));
  if (du <= 0.01) return { ok: false, erreur: "Cette facture est déjà réglée.", code: 409 };
  if (du < MINIMUM_EUROS) return { ok: false, erreur: "Montant trop faible pour un paiement en ligne : réglez par virement.", code: 409 };
  return { ok: true, du, centimes: centimes(du) };
}

// Une session déjà ouverte pour le même montant se réutilise (pas de
// double paiement par deux onglets, pas de session créée à chaque clic).
export function sessionReutilisable(invoice, montantCentimes, maintenantMs = Date.now()) {
  const s = invoice?.paiementEnLigne;
  if (!s?.sessionId || !s.url) return null;
  if (Number(s.centimes) !== Number(montantCentimes)) return null;
  if (!(Date.parse(s.expireLe || "") > maintenantMs + 60000)) return null;
  return s;
}

// Où Stripe renvoie le particulier après le paiement (ou l'abandon).
export function urlsRetour(appUrl, { retour = "chantier", quoteId = "" } = {}) {
  const base = String(appUrl || "").replace(/\/+$/, "");
  if (retour === "app") {
    return { success_url: `${base}/paiement-retour?app=client&etat=ok`, cancel_url: `${base}/paiement-retour?app=client&etat=annule` };
  }
  const page = retour === "paiements" || !quoteId
    ? `${base}/client/paiements?`
    : `${base}/client/chantier/${encodeURIComponent(quoteId)}?onglet=paiements&`;
  return { success_url: `${page}paiement=ok`, cancel_url: `${page}paiement=annule` };
}

// Paramètres de la session Stripe Checkout (créée sur le compte connecté).
export function parametresCheckout({ invoice, entrepriseNom = "", montantCentimes, commission = 0, urls, email = "", clientId = "", expireLe }) {
  const nom = `Facture ${invoice.invoiceNumber || ""}`.trim();
  const metadata = {
    kojiFactureId: String(invoice.id),
    kojiFactureNumero: String(invoice.invoiceNumber || ""),
    kojiEntrepriseId: String(invoice.userId || ""),
    kojiClientId: String(clientId || "")
  };
  const params = {
    mode: "payment",
    locale: "fr",
    client_reference_id: String(invoice.id),
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: montantCentimes,
        product_data: {
          name: nom.slice(0, 120),
          ...(entrepriseNom || invoice.projectTitle ? { description: [entrepriseNom, invoice.projectTitle].filter(Boolean).join(" · ").slice(0, 300) } : {})
        }
      }
    }],
    payment_intent_data: {
      description: `${nom}${entrepriseNom ? ` · ${entrepriseNom}` : ""}`.slice(0, 300),
      metadata,
      ...(commission > 0 ? { application_fee_amount: commission } : {})
    },
    metadata,
    success_url: urls.success_url,
    cancel_url: urls.cancel_url,
    expires_at: Math.floor(Date.parse(expireLe) / 1000)
  };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) params.customer_email = String(email);
  return params;
}

// ─── Webhook Connect : paiement confirmé ──────────────────────────────

const METHODES_CARTE = new Set(["card", "link", "apple_pay", "google_pay", "amazon_pay", "revolut_pay", "paypal", "klarna"]);
export const moyenDepuisStripe = (type = "") => (METHODES_CARTE.has(String(type)) || !type ? "carte" : "virement");

// Un événement qui confirme que l'argent est payé.
export function evenementPaye(evenement = {}) {
  const s = evenement.data?.object || {};
  if (s.mode !== "payment") return false;
  if (evenement.type === "checkout.session.async_payment_succeeded") return true;
  return evenement.type === "checkout.session.completed" && s.payment_status === "paid";
}

const idPaymentIntent = (s) => (typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || "");

const jourParis = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(iso));

// Ajoute le paiement à la facture, une seule fois (même PaymentIntent,
// même session ou même événement : doublon). Renvoie
// { statut: "enregistre" | "doublon" | "ignore", raison?, invoice, paiement, solde, excedent }.
export function appliquerPaiementEnLigne(db, { evenement, compteEntreprise = "", moyen = "carte", maintenant = new Date().toISOString() } = {}) {
  const s = evenement?.data?.object || {};
  const meta = s.metadata || {};
  if (!evenementPaye(evenement)) return { statut: "ignore", raison: "pas un paiement confirmé" };
  const invoice = (db.invoices || []).find((f) => f.id === meta.kojiFactureId);
  if (!invoice) return { statut: "ignore", raison: "facture inconnue" };
  if (!invoice.userId || invoice.userId !== meta.kojiEntrepriseId) return { statut: "ignore", raison: "entreprise différente" };
  if (!evenement.account || evenement.account !== compteEntreprise) return { statut: "ignore", raison: "compte Stripe différent" };

  const pi = idPaymentIntent(s);
  const paiements = Array.isArray(invoice.payments) ? invoice.payments : [];
  const deja = paiements.find((p) => (pi && p.stripePaymentIntent === pi) || (s.id && p.stripeSession === s.id) || p.stripeEvenement === evenement.id);
  if (deja) return { statut: "doublon", invoice, paiement: deja };

  const amount = r2((Number(s.amount_total) || 0) / 100);
  if (!(amount > 0)) return { statut: "ignore", raison: "montant nul" };

  const credite = creditDe(invoice, db.invoices || []);
  const due = invoice.status === "Emise" ? resteDu(invoice, credite) : 0;
  const excedent = r2(Math.max(0, amount - due));
  const quand = Number.isFinite(Number(evenement.created)) && Number(evenement.created) > 0 ? new Date(Number(evenement.created) * 1000).toISOString() : maintenant;
  const paiement = {
    id: `pay-en-ligne-${String(pi || s.id).slice(-24)}`,
    amount,
    date: jourParis(quand),
    moyen: moyen === "virement" ? "virement" : "carte",
    reference: String(pi || s.id).slice(0, 140),
    source: "en ligne",
    enLigne: true,
    stripePaymentIntent: pi,
    stripeSession: String(s.id || ""),
    stripeEvenement: String(evenement.id || ""),
    stripeCompte: String(evenement.account),
    clientId: String(meta.kojiClientId || ""),
    recuLe: maintenant
  };
  if (excedent > 0.01) paiement.excedent = excedent;
  invoice.payments = [...paiements, paiement];
  const reste = resteDu(invoice, credite);
  paiement.resteFacture = reste;
  const solde = invoice.status === "Emise" && reste <= 0.01;
  if (solde) {
    invoice.status = "Payee";
    invoice.paidAt = `${paiement.date}T12:00:00.000Z`;
  }
  if (invoice.paiementEnLigne?.sessionId === s.id) delete invoice.paiementEnLigne;
  invoice.updatedAt = maintenant;
  return { statut: "enregistre", invoice, paiement, solde, excedent: paiement.excedent || 0 };
}

// Reste sur le chantier : marché (devis + avenants signés) − encaissé
// (même calcul que le reçu de PRO-06.3, app/api/invoices).
export function resteSurChantier(db, invoice, quote) {
  if (!quote?.id) return null;
  const avenants = (db.avenants || []).filter((a) => a.quoteId === quote.id && a.status === "Signe").reduce((s, a) => s + Number(a.totalTtcDelta || 0), 0);
  const total = r2(Number(quote.totalTtc || quote.totalHt || 0) + avenants);
  const recu = (db.invoices || [])
    .filter((f) => f.kind !== "avoir" && f.quoteId === quote.id && f.status !== "Annulee" && !f.archived)
    .reduce((s, f) => s + encaisse(f), 0);
  return r2(Math.max(0, total - recu));
}

// Notifications : l'entreprise (catégorie paiement, e-mail selon ses
// réglages) et le particulier qui a payé.
export function notificationsPaiement({ invoice, paiement, solde, entrepriseNom = "", maintenant = new Date().toISOString() }) {
  const numero = invoice.invoiceNumber || "";
  const client = String(invoice.client || "Votre client").trim();
  const moyen = paiement.moyen === "virement" ? "par virement en ligne" : "par carte en ligne";
  const suite = solde ? "La facture est réglée." : `Reste dû sur la facture : ${euros(paiement.resteFacture)}.`;
  const notifs = [{
    id: `notif-paiement-${paiement.id}`,
    userId: invoice.userId,
    type: "paiement.recu",
    title: `Paiement reçu en ligne : ${euros(paiement.amount)} · ${numero}`.trim(),
    message: `${client} a payé ${euros(paiement.amount)} ${moyen}. ${suite} L'argent arrive sur votre compte bancaire selon le calendrier de virements du prestataire.${paiement.excedent ? ` Attention : ${euros(paiement.excedent)} de plus que le reste dû, à rembourser au client.` : ""}`,
    actionUrl: "/facturation?onglet=encaissements",
    actionLabel: "Voir les encaissements",
    invoiceId: invoice.id,
    read: false,
    createdAt: maintenant
  }];
  if (paiement.clientId) {
    notifs.push({
      id: `notif-paiement-client-${paiement.id}`,
      userId: paiement.clientId,
      accountType: "particulier",
      type: "paiement.recu",
      title: `Paiement reçu : ${euros(paiement.amount)}`,
      message: `${entrepriseNom || "L'entreprise"} a bien reçu votre paiement pour la facture ${numero}. ${solde ? "La facture est réglée." : `Il reste ${euros(paiement.resteFacture)} à payer sur cette facture.`} Le reçu est dans Documents.`,
      quoteId: invoice.quoteId || "",
      actionUrl: invoice.quoteId ? `/client/chantier/${encodeURIComponent(invoice.quoteId)}?onglet=documents` : "/client/paiements",
      actionLabel: "Voir le reçu",
      read: false,
      createdAt: maintenant
    });
  }
  return notifs;
}

// Reçus des paiements en ligne d'une facture (onglet Documents).
export const paiementsEnLigne = (invoice) => (Array.isArray(invoice?.payments) ? invoice.payments.filter((p) => p.enLigne === true) : []);
export const lienRecu = (invoice, paiement) => `/api/client/factures/${encodeURIComponent(invoice.id)}/recu?paiement=${encodeURIComponent(paiement.id)}`;
