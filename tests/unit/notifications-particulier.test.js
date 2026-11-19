import assert from "node:assert/strict";
import {
  notifDevisEnvoye, notifFactureEmise, notifPaiementRecu, notifReserveLevee, notifVisiteConfirmee,
  notifierParticuliers, particuliersDuDevis
} from "../../lib/notifications-particulier.js";
import { detailNotification, estPourClient, iconeNotification, titreCourt, actionsNotification } from "../../lib/notifications-client.js";
import { avecFormulaire, photosClient, vueChantier, vueDocuments, retractationDevis } from "../../lib/chantier-client.js";
import { originalDuMessage, traductionPublique } from "../../lib/traduction-messages.js";

// Les montants utilisent une espace insécable : on la compare comme une espace.
const sp = (x) => JSON.parse(JSON.stringify(x).split(String.fromCharCode(160)).join(" "));

const devis = (plus = {}) => ({
  id: "q1", userId: "e1", projectId: "p1", quoteNumber: "2026-041", status: "Envoye", signatureStatus: "En attente",
  vatRate: 10, tva: { local: "logement-ancien" }, totalHt: 5271.4, totalTtc: 5798.54, clientEmail: "s.lefevre@exemple.fr",
  project: { title: "Salle de bain, Paris 10e" }, company: { name: "ABL Expert Renov" }, clientType: "particulier",
  items: [{ label: "Meuble vasque", quantity: 1, totalHt: 890 }, { label: "Peinture", quantity: 1, totalHt: 211.4 }],
  paymentMilestones: [{ label: "Acompte", percent: 30 }, { label: "Solde", percent: 70 }],
  ...plus
});

// Koji Client · notifications du particulier (maquette CLI-04).
describe("Koji Client : notifications du particulier (CLI-04)", () => {
  it("devis prêt à signer : objet avec montant, TVA et acompte, rappel de la rétractation", () => {
    const n = sp(notifDevisEnvoye(devis()));
    assert.equal(n.type, "devis.a_signer");
    assert.equal(n.title, "Votre devis est prêt à signer");
    assert.equal(n.message, "ABL Expert Renov · salle de bain, Paris 10e · 5 798,54 € TTC");
    assert.deepEqual(n.objet, { titre: "Devis 2026-041", detail: "5 798,54 € TTC · TVA 10 % · acompte 30 % à la signature" });
    assert.equal(n.ecart, null);
    assert.match(n.rappel, /14 jours/);
    assert.equal(n.actionUrl, "/client/chantier/q1?onglet=devis");
    assert.equal(n.actionLabel, "Lire et signer");
    assert.ok(estPourClient({ ...n, accountType: "particulier" }));
    assert.equal(titreCourt(n), "Devis à signer");
    assert.equal(iconeNotification(n.type), "devis");
    // Le détail mène à l'action réelle.
    assert.equal(actionsNotification(n).principale.lien, "/client/chantier/q1?onglet=devis");
  });

  it("nouvelle version : version, écart avec la précédente et lien vers le devis", () => {
    const versions = [
      { number: "001", totalHt: 5486.2, totalTtc: 6034.82, lines: [{ id: "a", label: "Meuble vasque", totalHt: 1105 }, { id: "b", label: "Peinture", totalHt: 211.4 }] },
      { number: "002", totalHt: 5271.4, totalTtc: 5798.54, lines: [{ id: "a", label: "Meuble vasque", totalHt: 890 }, { id: "b", label: "Peinture", totalHt: 211.4 }] }
    ];
    const n = sp(notifDevisEnvoye(devis({ versions, versionNumber: "002" }), { nouvelleVersion: true }));
    assert.equal(n.type, "devis.nouvelle_version");
    assert.equal(n.title, "Nouvelle version du devis : version 2");
    assert.equal(n.message, "ABL Expert Renov · salle de bain, Paris 10e · 5 798,54 € TTC · version 2");
    assert.equal(n.texte, "ABL Expert Renov a mis à jour le devis : version 2, 5 798,54 € TTC. Vous pouvez comparer avec la version 1 avant de signer.");
    assert.equal(n.objet.titre, "Devis 2026-041 · version 2");
    assert.deepEqual(n.ecart, { titre: "Ce qui change depuis la version 1", detail: "− 236,28 € · Meuble vasque modifié", lien: "/client/chantier/q1?onglet=devis" });
    const d = sp(detailNotification(n));
    assert.equal(d.ecart.lien, "/client/chantier/q1?onglet=devis");
    assert.equal(d.texte, n.texte);
  });

  it("un devis d'une demande Radar propose « Poser une question » dans son fil", () => {
    const n = notifDevisEnvoye(devis({ chantierOffreId: "radar-1" }));
    assert.equal(n.offerId, "radar-1");
    assert.equal(n.entrepriseUserId, "e1");
    const a = actionsNotification(n, new Set(["radar-1:e1"]));
    assert.equal(a.question.lien, "/client/messages?fil=radar-1%3Ae1");
  });

  it("facture émise : paiement à faire, sans paiement en ligne", () => {
    const f = { id: "f1", quoteId: "q1", invoiceNumber: "KJ-2026-125", type: "Situation 1", status: "Emise", amountTtc: 2515, dueDate: "2026-12-20" };
    const n = sp(notifFactureEmise(f, devis({ status: "Signe", signatureStatus: "Signe" }), { factures: [f], aujourdhui: "2026-11-19" }));
    assert.equal(n.type, "facture.emise");
    assert.equal(n.title, "Facture à payer : 2 515,00 €");
    assert.deepEqual(n.objet, { titre: "Situation 1 KJ-2026-125", detail: "2 515,00 € · à payer avant le 20 déc." });
    assert.match(n.rappel, /virement/);
    assert.equal(n.actionUrl, "/client/chantier/q1?onglet=paiements");
    // Une facture déjà payée ne crée pas de « paiement à faire ».
    assert.equal(notifFactureEmise({ ...f, status: "Payee" }, devis(), { factures: [], aujourdhui: "2026-11-19" }), null);
  });

  it("paiement reçu, visite confirmée, réserve levée", () => {
    const p = sp(notifPaiementRecu({ id: "f0", invoiceNumber: "KJ-2026-118", type: "Facture d'acompte" }, devis(), { amount: 1739.56, recuEnvoye: true }));
    assert.equal(p.title, "Acompte reçu par l'entreprise");
    assert.equal(p.message, "1 739,56 € · facture KJ-2026-118 · reçu envoyé par e-mail");
    const v = notifVisiteConfirmee({ id: "radar-1", description: "Refaire la salle de bain", city: "Paris", postalCode: "75010" }, { entrepriseUserId: "e1", entrepriseName: "ABL Expert Renov", rdvDate: "2026-11-21T08:00:00.000Z" });
    assert.equal(v.title, "Visite confirmée samedi 21 novembre à 9 h");
    assert.equal(v.actionUrl, "/client/messages?fil=radar-1%3Ae1");
    assert.equal(iconeNotification(v.type), "agenda");
    const r = notifReserveLevee({ numero: "R2", titre: "Rayure sur la porte", projectId: "p1" }, devis());
    assert.equal(r.message, "R2 · Rayure sur la porte · ABL Expert Renov");
    assert.equal(r.actionUrl, "/client/chantier/q1?onglet=chantier");
    assert.equal(iconeNotification(r.type), "drapeau");
  });

  it("ne notifie que les comptes Koji Client du devis", () => {
    const users = [
      { id: "c1", accountType: "particulier", email: "S.Lefevre@exemple.fr" },
      { id: "c2", accountType: "particulier", email: "autre@exemple.fr" },
      { id: "c3", accountType: "particulier", email: "x@koji.local", clientAccess: { quoteIds: ["q1"] } },
      { id: "e1", accountType: "entreprise", email: "s.lefevre@exemple.fr" }
    ];
    assert.deepEqual(particuliersDuDevis(users, devis()), ["c1", "c3"]);
    assert.deepEqual(particuliersDuDevis(users, devis({ clientEmail: "" }), "autre@exemple.fr"), ["c2", "c3"]);
    const db = {};
    assert.equal(notifierParticuliers(db, ["c1"], notifDevisEnvoye(devis()), "2026-11-19T09:12:00.000Z"), 1);
    assert.equal(db.notifications[0].userId, "c1");
    assert.equal(db.notifications[0].accountType, "particulier");
    assert.equal(db.notifications[0].read, false);
    assert.equal(notifierParticuliers(db, [], notifDevisEnvoye(devis())), 0);
  });
});

describe("Koji Client : photos après, rétractation, traduction", () => {
  const signe = devis({ status: "Signe", signatureStatus: "Signe", signedAt: "2026-11-03T08:12:00.000Z", retractationJusquau: "2026-11-17" });

  it("ne garde que les photos « après » et montre la dernière", () => {
    const photos = [
      { id: "1", phase: "avant", lot: "Dépose", takenAt: "2026-11-14T07:02:00.000Z", author: "Mehdi B.", url: "https://s/1" },
      { id: "2", phase: "apres", lot: "Dépose", takenAt: "2026-11-14T15:41:00.000Z", author: "Mehdi B.", url: "https://s/2" },
      { id: "3", phase: "pendant", lot: "Plomberie", takenAt: "2026-11-18T09:00:00.000Z", author: "Rui C.", url: "https://s/3" },
      { id: "4", phase: "apres", lot: "Plomberie", takenAt: "2026-11-19T14:22:00.000Z", author: "Rui C.", url: "https://s/4" },
      { id: "5", phase: "apres", lot: "Plomberie", takenAt: "2026-11-19T15:00:00.000Z", author: "Rui C.", url: "" }
    ];
    assert.deepEqual(photosClient(photos).map((p) => p.id), ["2", "4"]);
    const c = vueChantier(signe, { photos, maintenant: "2026-11-19T16:00:00.000Z" });
    assert.deepEqual(c.photo, { url: "https://s/4", legende: "19/11 · Rui C.", etiquette: "Après", lot: "Plomberie" });
    assert.equal(c.photos.length, 2);
    assert.match(c.note, /photos « après »/);
    const docs = vueDocuments(signe, { photos: c.photos, maintenant: "2026-11-19T16:00:00.000Z" });
    const ligne = docs.find((d) => d.id === "photos");
    assert.equal(ligne.type, "photos");
    assert.equal(ligne.titre, "Photos du chantier");
    assert.equal(ligne.detail, "2 photos après, par étape (2)");
    assert.equal(ligne.lien, null);
    assert.equal(vueChantier(signe, { maintenant: "2026-11-19T16:00:00.000Z" }).photo, null);
    assert.ok(!vueDocuments(signe, { maintenant: "2026-11-19T16:00:00.000Z" }).some((d) => d.id === "photos"));
  });

  it("le délai ouvert porte le formulaire de rétractation", () => {
    const r = avecFormulaire(retractationDevis(signe, "2026-11-10T10:00:00.000Z"), { nom: "ABL Expert Renov", adresse: "3 rue X, Paris", email: "contact@abl.fr" });
    assert.equal(r.etat, "ouvert");
    assert.equal(r.jusquau, "Vous pouvez annuler sans motif jusqu'au 17 novembre inclus.");
    assert.equal(r.formulaire[0], "Formulaire de rétractation");
    assert.match(r.formulaire[2], /ABL Expert Renov, 3 rue X, Paris, contact@abl.fr/);
    const termine = avecFormulaire(retractationDevis(signe, "2026-11-19T10:00:00.000Z"), {});
    assert.equal(termine.etat, "termine");
    assert.equal(termine.formulaire, undefined);
  });

  it("garde l'original d'un message traduit, jamais pour le français", () => {
    assert.deepEqual(originalDuMessage({ original: "O receptor está colocado.", langueOriginale: "pt" }, "Le receveur est posé."), { texte: "O receptor está colocado.", langue: "pt" });
    assert.equal(originalDuMessage({ original: "Bonjour", langueOriginale: "fr" }, "Bonjour !"), null);
    assert.equal(originalDuMessage({ original: "x", langueOriginale: "klingon" }, "y"), null);
    assert.equal(originalDuMessage({ original: "Même", langueOriginale: "pt" }, "Même"), null);
    assert.deepEqual(traductionPublique({ original: { texte: "O receptor está colocado.", langue: "pt" } }), { langue: "portugais", original: "O receptor está colocado.", sens: "ltr" });
    assert.equal(traductionPublique({ original: { texte: "مرحبا", langue: "ar" } }).sens, "rtl");
    assert.equal(traductionPublique({}), null);
  });
});
