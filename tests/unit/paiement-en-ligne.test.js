import assert from "node:assert/strict";
import {
  appliquerPaiementEnLigne, commissionCentimes, etatDepuisStripe, evenementPaye, interrupteurActif, montantAPayer,
  moyenDepuisStripe, notificationsPaiement, parametresCheckout, peutEncaisser, resteSurChantier, sessionReutilisable,
  urlsInscription, urlsRetour, vueComptePro, NOTE_PAIEMENT_EN_LIGNE, NOTE_PAIEMENT_MIXTE
} from "../../lib/paiement-en-ligne.js";
import { NOTE_PAIEMENT, paiementsDuClient, vueDocuments, vuePaiements } from "../../lib/chantier-client.js";

const sp = (x) => JSON.parse(JSON.stringify(x).split(String.fromCharCode(160)).join(" ").split(String.fromCharCode(8239)).join(" "));

// Paiement en ligne des factures (Stripe Connect, décision du 19 nov.) :
// aucun appel à Stripe ici, seulement les règles.
describe("Paiement en ligne des factures (Stripe Connect)", () => {
  const confirme = { _stripeConnectAccountId: "acct_1", _stripeConnectCharges: true, _stripeConnectPayouts: true, _stripeConnectDetails: true };
  const facture = (plus = {}) => ({ id: "f1", userId: "e1", quoteId: "q1", invoiceNumber: "KJ-2026-125", client: "Mme Lefèvre", status: "Emise", amountTtc: 2515, dueDate: "2026-12-20", ...plus });
  const evenement = (plus = {}, session = {}) => ({
    id: "evt_1",
    type: "checkout.session.completed",
    account: "acct_1",
    created: 1763634000, // 20 nov. 2025 10:20 UTC
    data: { object: { id: "cs_1", mode: "payment", payment_status: "paid", payment_intent: "pi_1", amount_total: 251500, metadata: { kojiFactureId: "f1", kojiEntrepriseId: "e1", kojiClientId: "cli-1" }, ...session } },
    ...plus
  });

  describe("interrupteur général et commission", () => {
    it("rien n'est ouvert sans PAIEMENT_EN_LIGNE_ACTIF", () => {
      assert.equal(interrupteurActif({}), false);
      assert.equal(interrupteurActif({ PAIEMENT_EN_LIGNE_ACTIF: "0" }), false);
      assert.equal(interrupteurActif({ PAIEMENT_EN_LIGNE_ACTIF: "1" }), true);
      assert.equal(peutEncaisser(confirme, { actif: false }), false);
    });

    it("commission de Koji : 0 par défaut, réglable, jamais plus que le montant", () => {
      assert.equal(commissionCentimes(251500, {}), 0);
      assert.equal(commissionCentimes(251500, { PAIEMENT_EN_LIGNE_COMMISSION_POURCENT: "1,5" }), 3773);
      assert.equal(commissionCentimes(10000, { PAIEMENT_EN_LIGNE_COMMISSION_POURCENT: "1.4", PAIEMENT_EN_LIGNE_COMMISSION_FIXE_CENTIMES: "25" }), 165);
      assert.equal(commissionCentimes(100, { PAIEMENT_EN_LIGNE_COMMISSION_FIXE_CENTIMES: "500" }), 100);
      assert.equal(commissionCentimes(10000, { PAIEMENT_EN_LIGNE_COMMISSION_POURCENT: "-3" }), 0);
    });
  });

  describe("compte de l'entreprise", () => {
    it("le bouton n'existe que si Stripe a confirmé encaissements et virements", () => {
      assert.equal(peutEncaisser(confirme, { actif: true }), true);
      assert.equal(peutEncaisser({}, { actif: true }), false);
      assert.equal(peutEncaisser({ ...confirme, _stripeConnectCharges: false }, { actif: true }), false);
      assert.equal(peutEncaisser({ ...confirme, _stripeConnectPayouts: false }, { actif: true }), false);
      assert.equal(peutEncaisser({ ...confirme, _paiementEnLigneSuspendu: true }, { actif: true }), false);
      // Une valeur « vraie » qui n'est pas true (champ trafiqué) ne suffit pas.
      assert.equal(peutEncaisser({ ...confirme, _stripeConnectCharges: "true" }, { actif: true }), false);
    });

    it("lit l'état réel d'un compte Stripe", () => {
      const p = etatDepuisStripe({ id: "acct_9", charges_enabled: true, payouts_enabled: false, details_submitted: true, requirements: { currently_due: ["external_account"], disabled_reason: "requirements.past_due" } }, "2026-11-19T10:00:00.000Z");
      assert.deepEqual(p, { _stripeConnectAccountId: "acct_9", _stripeConnectCharges: true, _stripeConnectPayouts: false, _stripeConnectDetails: true, _stripeConnectOnboarded: false, _stripeConnectExigences: 1, _stripeConnectBloque: "requirements.past_due", _stripeConnectMajLe: "2026-11-19T10:00:00.000Z" });
    });

    it("ce que voit l'entreprise : actif seulement après confirmation de Stripe", () => {
      assert.equal(vueComptePro(confirme, { actif: false }).etat, "indisponible");
      const a = vueComptePro({}, { actif: true });
      assert.equal(a.etat, "a_activer");
      assert.equal(a.actif, false);
      assert.equal(a.action.id, "inscription");
      assert.equal(vueComptePro({ _stripeConnectAccountId: "acct_1" }, { actif: true }).etat, "a_finaliser");
      const v = vueComptePro({ ...confirme, _stripeConnectPayouts: false, _stripeConnectExigences: 2 }, { actif: true });
      assert.equal(v.etat, "verification");
      assert.equal(v.actif, false);
      assert.match(v.detail, /2 informations de plus · les virements vers votre banque/);
      assert.equal(vueComptePro({ ...confirme, _stripeConnectCharges: false }, { actif: true }).action, null);
      const ok = vueComptePro(confirme, { actif: true });
      assert.equal(ok.etat, "actif");
      assert.equal(ok.actif, true);
      assert.equal(ok.action.id, "pause");
      assert.equal(ok.tableau, true);
      const pause = vueComptePro({ ...confirme, _paiementEnLigneSuspendu: true }, { actif: true });
      assert.equal(pause.etat, "suspendu");
      assert.equal(pause.actif, false);
    });

    it("retours de l'inscription chez le prestataire", () => {
      assert.deepEqual(urlsInscription("https://app.getkoji.io/", "profil"), { return_url: "https://app.getkoji.io/profil?tab=devis&paiement=retour", refresh_url: "https://app.getkoji.io/profil?tab=devis&paiement=relancer" });
      assert.equal(urlsInscription("https://x.io", "encaissements").return_url, "https://x.io/facturation?onglet=encaissements&paiement=retour");
      assert.equal(urlsInscription("https://x.io", "app").refresh_url, "https://x.io/paiement-retour?app=pro&etat=relancer");
    });
  });

  describe("montant à payer (serveur)", () => {
    it("reste dû : montant − avoirs − paiements, en centimes", () => {
      const f = facture({ payments: [{ amount: 515, date: "2026-11-15" }] });
      const avoir = { id: "a1", kind: "avoir", refInvoiceId: "f1", amountTtc: -100, status: "Emise" };
      assert.deepEqual(montantAPayer(f, [f, avoir]), { ok: true, du: 1900, centimes: 190000 });
      assert.deepEqual(montantAPayer(facture({ amountTtc: 1739.56 }), []), { ok: true, du: 1739.56, centimes: 173956 });
    });

    it("refuse un brouillon, une facture payée, un avoir, un reste trop faible", () => {
      assert.equal(montantAPayer(facture({ status: "Brouillon" })).ok, false);
      assert.equal(montantAPayer(facture({ status: "Payee" })).ok, false);
      assert.equal(montantAPayer(facture({ kind: "avoir", amountTtc: -10 })).ok, false);
      assert.equal(montantAPayer(facture({ archived: true })).ok, false);
      assert.equal(montantAPayer(facture({ payments: [{ amount: 2515 }] })).erreur, "Cette facture est déjà réglée.");
      assert.match(montantAPayer(facture({ amountTtc: 0.3 })).erreur, /trop faible/);
      assert.equal(montantAPayer(null).code, 409);
    });

    it("réutilise une session ouverte pour le même montant", () => {
      const maintenant = Date.parse("2026-11-19T10:00:00.000Z");
      const f = facture({ paiementEnLigne: { sessionId: "cs_1", url: "https://checkout.stripe.com/c/cs_1", centimes: 251500, expireLe: "2026-11-19T10:30:00.000Z" } });
      assert.equal(sessionReutilisable(f, 251500, maintenant).sessionId, "cs_1");
      assert.equal(sessionReutilisable(f, 190000, maintenant), null);
      assert.equal(sessionReutilisable(f, 251500, Date.parse("2026-11-19T10:29:30.000Z")), null);
      assert.equal(sessionReutilisable(facture(), 251500, maintenant), null);
    });

    it("session Checkout : montant du serveur, commission seulement si fixée, retour selon l'écran", () => {
      const urls = urlsRetour("https://app.getkoji.io", { retour: "chantier", quoteId: "q 1" });
      assert.deepEqual(urls, { success_url: "https://app.getkoji.io/client/chantier/q%201?onglet=paiements&paiement=ok", cancel_url: "https://app.getkoji.io/client/chantier/q%201?onglet=paiements&paiement=annule" });
      assert.equal(urlsRetour("https://x.io", { retour: "paiements", quoteId: "q1" }).success_url, "https://x.io/client/paiements?paiement=ok");
      assert.equal(urlsRetour("https://x.io", { retour: "app" }).cancel_url, "https://x.io/paiement-retour?app=client&etat=annule");
      const p = parametresCheckout({ invoice: facture({ projectTitle: "Salle de bain" }), entrepriseNom: "ABL Expert Renov", montantCentimes: 251500, commission: 0, urls, email: "lefevre@example.fr", clientId: "cli-1", expireLe: "2026-11-19T10:40:00.000Z" });
      assert.equal(p.mode, "payment");
      assert.equal(p.line_items[0].price_data.unit_amount, 251500);
      assert.equal(p.line_items[0].price_data.currency, "eur");
      assert.equal(p.line_items[0].price_data.product_data.name, "Facture KJ-2026-125");
      assert.equal(p.payment_intent_data.application_fee_amount, undefined);
      assert.deepEqual(p.metadata, { kojiFactureId: "f1", kojiFactureNumero: "KJ-2026-125", kojiEntrepriseId: "e1", kojiClientId: "cli-1" });
      assert.deepEqual(p.payment_intent_data.metadata, p.metadata);
      assert.equal(p.customer_email, "lefevre@example.fr");
      assert.equal(p.expires_at, Date.parse("2026-11-19T10:40:00.000Z") / 1000);
      assert.equal(parametresCheckout({ invoice: facture(), montantCentimes: 1000, commission: 39, urls, expireLe: "2026-11-19T10:40:00.000Z" }).payment_intent_data.application_fee_amount, 39);
      assert.equal(parametresCheckout({ invoice: facture(), montantCentimes: 1000, urls, email: "pas-une-adresse", expireLe: "2026-11-19T10:40:00.000Z" }).customer_email, undefined);
    });
  });

  describe("webhook Connect : paiement confirmé", () => {
    const db = (plus = {}) => ({ invoices: [facture(plus)], avenants: [], users: [] });

    it("ajoute le paiement en ligne et solde la facture", () => {
      const base = db({ paiementEnLigne: { sessionId: "cs_1" } });
      const r = appliquerPaiementEnLigne(base, { evenement: evenement(), compteEntreprise: "acct_1", moyen: "carte", maintenant: "2026-11-20T10:21:00.000Z" });
      assert.equal(r.statut, "enregistre");
      assert.equal(r.solde, true);
      const f = base.invoices[0];
      assert.equal(f.status, "Payee");
      assert.equal(f.paidAt, "2025-11-20T12:00:00.000Z");
      assert.equal(f.paiementEnLigne, undefined);
      assert.equal(f.payments.length, 1);
      const p = f.payments[0];
      assert.deepEqual({ amount: p.amount, moyen: p.moyen, source: p.source, enLigne: p.enLigne, reference: p.reference, stripePaymentIntent: p.stripePaymentIntent, stripeSession: p.stripeSession, stripeEvenement: p.stripeEvenement, resteFacture: p.resteFacture, clientId: p.clientId }, { amount: 2515, moyen: "carte", source: "en ligne", enLigne: true, reference: "pi_1", stripePaymentIntent: "pi_1", stripeSession: "cs_1", stripeEvenement: "evt_1", resteFacture: 0, clientId: "cli-1" });
    });

    it("sans doublon : même événement, même PaymentIntent ou même session", () => {
      const base = db();
      assert.equal(appliquerPaiementEnLigne(base, { evenement: evenement(), compteEntreprise: "acct_1" }).statut, "enregistre");
      assert.equal(appliquerPaiementEnLigne(base, { evenement: evenement(), compteEntreprise: "acct_1" }).statut, "doublon");
      // Stripe envoie completed puis async_payment_succeeded, ou rejoue avec un autre identifiant.
      assert.equal(appliquerPaiementEnLigne(base, { evenement: evenement({ id: "evt_2", type: "checkout.session.async_payment_succeeded" }), compteEntreprise: "acct_1" }).statut, "doublon");
      assert.equal(appliquerPaiementEnLigne(base, { evenement: evenement({ id: "evt_3" }, { id: "cs_2" }), compteEntreprise: "acct_1" }).statut, "doublon");
      assert.equal(base.invoices[0].payments.length, 1);
    });

    it("paiement partiel : la facture reste due", () => {
      const base = db({ payments: [{ id: "p0", amount: 515, date: "2026-11-15", moyen: "virement" }] });
      const r = appliquerPaiementEnLigne(base, { evenement: evenement({}, { amount_total: 100000 }), compteEntreprise: "acct_1", moyen: "virement" });
      assert.equal(r.solde, false);
      assert.equal(base.invoices[0].status, "Emise");
      assert.equal(r.paiement.moyen, "virement");
      assert.equal(r.paiement.resteFacture, 1000);
      assert.equal(r.excedent, 0);
    });

    it("argent reçu au-delà du reste dû : enregistré et signalé", () => {
      const base = db({ payments: [{ id: "p0", amount: 2000, date: "2026-11-15" }] });
      const r = appliquerPaiementEnLigne(base, { evenement: evenement(), compteEntreprise: "acct_1" });
      assert.equal(r.statut, "enregistre");
      assert.equal(r.excedent, 2000);
      assert.equal(base.invoices[0].status, "Payee");
      const [pro] = notificationsPaiement({ invoice: base.invoices[0], paiement: r.paiement, solde: r.solde });
      assert.match(sp(pro.message), /2 000,00 € de plus que le reste dû, à rembourser au client/);
    });

    it("ignore ce qui n'est pas un paiement confirmé de cette entreprise", () => {
      const non = (ev, compte = "acct_1") => appliquerPaiementEnLigne(db(), { evenement: ev, compteEntreprise: compte }).statut;
      assert.equal(non(evenement({}, { payment_status: "unpaid" })), "ignore"); // virement en attente
      assert.equal(non(evenement({ type: "checkout.session.async_payment_failed" })), "ignore");
      assert.equal(non(evenement({ account: "acct_autre" })), "ignore");
      assert.equal(non(evenement(), ""), "ignore");
      assert.equal(non(evenement({}, { metadata: { kojiFactureId: "f1", kojiEntrepriseId: "e2" } })), "ignore");
      assert.equal(non(evenement({}, { metadata: { kojiFactureId: "inconnue", kojiEntrepriseId: "e1" } })), "ignore");
      assert.equal(non(evenement({}, { mode: "subscription" })), "ignore");
      assert.equal(non(evenement({}, { amount_total: 0 })), "ignore");
      assert.equal(evenementPaye(evenement({ type: "checkout.session.async_payment_succeeded" }, { payment_status: "unpaid" })), true);
    });

    it("moyen de paiement d'après Stripe", () => {
      assert.equal(moyenDepuisStripe("card"), "carte");
      assert.equal(moyenDepuisStripe("apple_pay"), "carte");
      assert.equal(moyenDepuisStripe(""), "carte");
      assert.equal(moyenDepuisStripe("customer_balance"), "virement");
      assert.equal(moyenDepuisStripe("sepa_debit"), "virement");
    });

    it("notifie l'entreprise et le particulier", () => {
      const base = db();
      const r = appliquerPaiementEnLigne(base, { evenement: evenement(), compteEntreprise: "acct_1" });
      const [pro, client] = sp(notificationsPaiement({ invoice: base.invoices[0], paiement: r.paiement, solde: r.solde, entrepriseNom: "ABL Expert Renov", maintenant: "2026-11-20T10:21:00.000Z" }));
      assert.equal(pro.userId, "e1");
      assert.equal(pro.type, "paiement.recu");
      assert.equal(pro.title, "Paiement reçu en ligne : 2 515,00 € · KJ-2026-125");
      assert.match(pro.message, /^Mme Lefèvre a payé 2 515,00 € par carte en ligne\. La facture est réglée\./);
      assert.equal(pro.actionUrl, "/facturation?onglet=encaissements");
      assert.equal(client.userId, "cli-1");
      assert.equal(client.accountType, "particulier");
      assert.equal(client.actionUrl, "/client/chantier/q1?onglet=documents");
      assert.match(client.message, /^ABL Expert Renov a bien reçu votre paiement pour la facture KJ-2026-125\. La facture est réglée\. Le reçu est dans Documents\.$/);
      assert.equal(notificationsPaiement({ invoice: base.invoices[0], paiement: { ...r.paiement, clientId: "" }, solde: true }).length, 1);
    });

    it("reste sur le chantier : devis + avenants signés − encaissé", () => {
      const base = { invoices: [facture({ payments: [{ amount: 2515 }] }), facture({ id: "f0", amountTtc: 1739.56, status: "Payee", paidAt: "2026-11-09" })], avenants: [{ quoteId: "q1", status: "Signe", totalTtcDelta: 200 }, { quoteId: "q1", status: "Brouillon", totalTtcDelta: 999 }] };
      assert.equal(resteSurChantier(base, base.invoices[0], { id: "q1", totalTtc: 5798.54 }), 1743.98);
      assert.equal(resteSurChantier(base, base.invoices[0], null), null);
    });
  });

  describe("Koji Client : bouton « Payer » et reçu dans Documents", () => {
    const maintenant = "2026-11-18T10:00:00.000Z";
    const devis = { id: "q1", userId: "e1", projectId: "p1", status: "Signe", signatureStatus: "Signe", signedAt: "2026-11-03T08:12:00.000Z", totalTtc: 5798.54, project: { title: "Salle de bain" }, company: { name: "ABL Expert Renov" } };

    it("« Payer » sur la facture à payer seulement si l'entreprise encaisse en ligne", () => {
      const factures = [facture({ amountTtc: 2515 })];
      const sans = vuePaiements(devis, { factures, maintenant });
      assert.equal(sans.aPayer.payer, null);
      assert.equal(sans.note, NOTE_PAIEMENT);
      const avec = sp(vuePaiements(devis, { factures, maintenant, paiementEnLigne: true }));
      assert.deepEqual(avec.aPayer.payer, { libelle: "Payer 2 515,00 €", mention: "Paiement par carte ou virement, sécurisé par notre prestataire." });
      assert.equal(avec.aPayer.factureId, "f1");
      assert.equal(avec.note, NOTE_PAIEMENT_EN_LIGNE);
      // Rien à payer : pas de bouton.
      assert.equal(vuePaiements(devis, { factures: [facture({ status: "Payee", paidAt: "2026-11-10" })], maintenant, paiementEnLigne: true }).aPayer, null);
    });

    it("plusieurs entreprises : le bouton suit chaque entreprise", () => {
      const autre = { ...devis, id: "q2", userId: "e2", projectId: "p2" };
      const factures = [facture(), facture({ id: "f2", userId: "e2", quoteId: "q2", invoiceNumber: "X-1", amountTtc: 800 })];
      const v = paiementsDuClient([devis, autre], { factures, maintenant, enLigne: (q) => q.userId === "e1" });
      assert.ok(v.groupes.find((g) => g.id === "q1").paiements.aPayer.payer);
      assert.equal(v.groupes.find((g) => g.id === "q2").paiements.aPayer.payer, null);
      assert.equal(v.note, NOTE_PAIEMENT_MIXTE);
      assert.equal(paiementsDuClient([devis], { factures, maintenant, enLigne: () => true }).note, NOTE_PAIEMENT_EN_LIGNE);
      assert.equal(paiementsDuClient([devis], { factures, maintenant }).note, NOTE_PAIEMENT);
    });

    it("le reçu d'un paiement en ligne arrive dans Documents", () => {
      const f = facture({ status: "Payee", payments: [{ id: "pay-en-ligne-pi_1", amount: 2515, date: "2026-11-20", moyen: "carte", enLigne: true }, { id: "p-man", amount: 0.01, date: "2026-11-01", moyen: "virement" }] });
      const docs = sp(vueDocuments(devis, { factures: [f], maintenant }));
      const recus = docs.filter((d) => d.titre === "Reçu de paiement");
      assert.equal(recus.length, 1);
      assert.deepEqual(recus[0], { id: "recu-pay-en-ligne-pi_1", titre: "Reçu de paiement", detail: "20 nov. · 2 515,00 € · facture KJ-2026-125 · carte en ligne", lien: "/api/client/factures/f1/recu?paiement=pay-en-ligne-pi_1" });
    });
  });
});
