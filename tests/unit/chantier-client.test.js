import assert from "node:assert/strict";
import {
  acompteDevis, changementsVersion, contactEntreprise, identiteEntreprise, lignePaiement, paiementsDuClient,
  texteRetenue, totauxDevis, vueChantier, vueChantierClient, vueDevis, vueDocuments, vueLienSignature, vuePaiements,
  emailMasque, NOTE_PAIEMENT
} from "../../lib/chantier-client.js";

// Les montants utilisent une espace insécable : on la compare comme une espace.
const sp = (x) => JSON.parse(JSON.stringify(x).split(String.fromCharCode(160)).join(" "));
const eq = (a, b) => assert.deepEqual(sp(a), sp(b));

// Koji Client · signer, suivre, payer (maquette CLI-02) et signature par lien (CLI-07).
describe("Koji Client : chantier, paiements et documents (CLI-02)", () => {
  const maintenant = "2026-11-18T10:00:00.000Z"; // mercredi
  const devis = (plus = {}) => ({
    id: "q1", userId: "e1", projectId: "p1", quoteNumber: "2026-041", status: "Signe", signatureStatus: "Signe",
    signedAt: "2026-11-03T08:12:00.000Z", retractationJusquau: "2026-11-17", vatRate: 10, tva: { local: "logement-ancien" },
    totalHt: 5271.4, totalTtc: 5798.54, quoteDate: "2026-10-30", project: { title: "Salle de bain, Paris 10e" },
    company: { name: "ABL Expert Renov" },
    items: [
      { label: "Dépose de l'existant", room: "Dépose", quantity: 1, unit: "u", totalHt: 620 },
      { label: "Faïence murale", room: "Carrelage", quantity: 14, unit: "m²", totalHt: 1330 }
    ],
    paymentMilestones: [{ label: "Acompte", percent: 30 }, { label: "Situation", percent: 40 }, { label: "Solde", percent: 30 }],
    tasks: [
      { id: "t1", label: "Dépose", room: "Dépose", done: true, finishedAt: "2026-11-14T10:00:00.000Z", startDate: "2026-11-10", endDate: "2026-11-14" },
      { id: "t2", label: "Faïence", room: "Carrelage", startDate: "2026-11-17", endDate: "2026-11-25", assignedTo: "Rui C.", status: "En cours" },
      { id: "t3", label: "Joints", room: "Carrelage", startDate: "2026-11-26", endDate: "2026-12-04" }
    ],
    finChantier: { receptionLe: "" },
    ...plus
  });
  const entreprise = { nom: "ABL Expert Renov", forme: "SAS", siret: "81234567800012", decennale: { assureur: "Assureur X", jusqua: "2026-12-31" }, email: "contact@abl.fr" };
  const facture = (id, plus = {}) => ({ id, quoteId: "q1", userId: "e1", invoiceNumber: `KJ-${id}`, status: "Emise", amountTtc: 1000, issuedAt: "2026-11-05T09:00:00.000Z", ...plus });

  it("montre le devis : lignes, totaux avec le motif du taux, acompte", () => {
    const v = vueDevis(devis({ status: "Envoye", signatureStatus: "", signedAt: "", retractationJusquau: "", sentAt: "2026-10-30T09:00:00.000Z" }), { entreprise, maintenant });
    assert.equal(v.etat, "a_signer");
    assert.equal(v.titreEcran, "Devis à signer");
    assert.equal(v.titre, "Devis 2026-041");
    assert.equal(v.date, "30 oct. 2026");
    assert.equal(v.validite, "valable jusqu'au 29 nov.");
    eq(v.lignes.map((l) => [l.libelle, l.quantite, l.montantHt]), [["Dépose de l'existant", "1", "620,00 €"], ["Faïence murale", "14 m²", "1 330,00 €"]]);
    eq(totauxDevis(devis()).map((t) => `${t.libelle} ${t.montant}`), ["Total HT 5 271,40 €", "TVA 10 % · logement de plus de 2 ans 527,14 €", "Total TTC 5 798,54 €"]);
    eq(v.acompte.montant, "1 739,56 €");
    assert.equal(v.acompte.detail, "acompte 30 % · le reste en 2 fois (situation, solde)");
    assert.ok(v.signature, "un devis envoyé se signe");
    assert.equal(acompteDevis({ totalTtc: 100 }), null);
  });

  it("dit ce qui change depuis la version précédente", () => {
    const versions = [
      { number: "001", totalHt: 5486.2, totalTtc: 6034.82, lines: [{ id: "a", label: "Meuble vasque", totalHt: 1105 }, { id: "b", label: "Peinture", totalHt: 211.4 }] },
      { number: "002", totalHt: 5271.4, totalTtc: 5798.54, lines: [{ id: "a", label: "Meuble vasque", totalHt: 890 }, { id: "b", label: "Peinture", totalHt: 211.4 }] }
    ];
    const c = changementsVersion({ versions, vatRate: 10 });
    eq(c.texte, "Ce qui change depuis la version 1 : − 236,28 € TTC, Meuble vasque modifié");
    assert.equal(c.lignes.length, 1);
    assert.equal(c.lignes[0].type, "Modifié");
    assert.equal(changementsVersion({ versions: versions.slice(0, 1) }), null);
    assert.equal(vueDevis(devis({ versions }), { entreprise, maintenant }).titre, "Devis 2026-041 · version 2");
  });

  it("présente l'entreprise : forme, SIREN, décennale", () => {
    const id = identiteEntreprise(entreprise, maintenant);
    assert.equal(id.detail, "SAS · SIREN 812 345 678 · décennale Assureur X, valable jusqu'au 31 déc. 2026");
    assert.equal(identiteEntreprise({ nom: "X", decennale: { assureur: "Y", jusqua: "2026-01-01" } }, maintenant).decennale, "Y, expirée le 1 janv. 2026");
    assert.equal(identiteEntreprise({ nom: "X" }, maintenant).detail, "");
  });

  it("suit le chantier par étapes, avec le jour et la prochaine étape", () => {
    const c = vueChantier(devis(), { maintenant });
    assert.equal(c.titre, "Votre chantier · jour 6 sur 18");
    assert.deepEqual(c.etapes.map((e) => `${e.titre} : ${e.etat} · ${e.detail}`), [
      "Dépose : fait · terminé le 14 nov.",
      "Carrelage : en_cours · en cours · Rui C.",
      "Réception : a_venir · 4 décembre · vous signez le procès-verbal"
    ]);
    assert.equal(c.avancement.pourcent, 33);
    assert.equal(c.avancement.texte, "1 étape terminée sur 2 · Carrelage en cours · fin prévue le 4 décembre");
    assert.equal(c.prochaine.texte, "Joints · à partir du 26 novembre");
    assert.equal(c.photo, null);
    assert.equal(c.signaler.mode, "alerte");
    assert.equal(c.taches.find((t) => t.id === "t2").etiquette, "En cours");
    assert.equal(vueChantier(devis({ status: "Envoye", signatureStatus: "", signedAt: "" }), { maintenant }), null);
  });

  it("après la réception : réserve pendant un an, puis plus de signalement", () => {
    const recu = devis({ finChantier: { receptionLe: "2026-11-10T15:00:00.000Z" } });
    const c = vueChantier(recu, { maintenant });
    assert.equal(c.titre, "Votre chantier · terminé");
    assert.equal(c.signaler.mode, "reserve");
    assert.equal(c.etapes.at(-1).detail, "procès-verbal signé le 10 nov.");
    assert.equal(vueChantier(recu, { maintenant: "2027-11-11T10:00:00.000Z" }).signaler, null);
  });

  it("classe les factures : payée, à payer, avoirs déduits, brouillons absents", () => {
    const factures = [
      facture("a", { type: "Acompte", status: "Payee", amountTtc: 1739.56, paidAt: "2026-11-09" }),
      facture("b", { type: "Situation 1", amountTtc: 2515, dueDate: "2026-12-20", payments: [{ amount: 515, date: "2026-11-15" }] }),
      facture("c", { status: "Brouillon", amountTtc: 99 }),
      facture("d", { kind: "avoir", amountTtc: -100, refInvoiceId: "b", refInvoiceNumber: "KJ-b", invoiceNumber: "AV-1" })
    ];
    const p = vuePaiements(devis(), { factures, maintenant });
    eq(p.lignes.map((l) => `${l.titre} | ${l.etat} | ${l.detail} | ${l.montant}`), [
      "Facture d'acompte KJ-a | paye | payée le 9 nov. | 1 739,56 €",
      "Situation 1 KJ-b | a_payer | 515,00 € reçus · reste à payer avant le 20 déc. | 1 900,00 €",
      "Reste à facturer | a_venir | situations et solde, selon l'avancement | 1 643,98 €"
    ]);
    assert.equal(p.aPayer.titre, "À payer avant le 20 décembre");
    eq(p.aPayer.montant, "1 900,00 €");
    assert.equal(p.aPayer.pdf, "/api/client/factures/b/pdf");
    assert.equal(p.note, NOTE_PAIEMENT);
    assert.ok(!JSON.stringify(p).includes("Payer "), "aucun bouton de paiement en ligne");
    assert.equal(lignePaiement(facture("e", { dueDate: "2026-11-01" }), [], "2026-11-18").detail, "échue le 1 nov.");
    // Facture annulée entièrement par un avoir : plus à payer, « annulée par l'avoir » dans Documents.
    const annulee = [facture("g", { amountTtc: 300 }), facture("h", { kind: "avoir", amountTtc: -300, refInvoiceId: "g", invoiceNumber: "AV-2" })];
    assert.equal(lignePaiement(annulee[0], annulee, "2026-11-18"), null);
    assert.match(vueDocuments(devis(), { factures: annulee, entreprise, maintenant }).find((d) => d.id === "g").detail, /annulée par l'avoir AV-2$/);
  });

  it("explique la retenue de garantie, seulement si elle existe", () => {
    assert.equal(texteRetenue(null, ""), "");
    assert.match(texteRetenue({ retenue: { taux: 5 } }, ""), /^Une retenue de garantie de 5 % est prévue/);
    eq(
      texteRetenue({ pv: { signeLe: "2026-12-04T10:00:00.000Z", retenue: { taux: 5, montantTtc: 307.09 } }, retenue: { taux: 5 } }, "2026-12-04T10:00:00.000Z"),
      "Retenue de garantie : 307,09 € (5 %) que vous gardez jusqu'au 4 décembre 2027, au cas où une réserve ne serait pas levée. L'entreprise vous la facture ensuite."
    );
  });

  it("liste les documents réels, avec leur lien sécurisé", () => {
    const factures = [facture("a", { status: "Payee", amountTtc: 1739.56, paidAt: "2026-11-09" }), facture("d", { kind: "avoir", amountTtc: -50, refInvoiceNumber: "KJ-a", invoiceNumber: "AV-1" })];
    const cloture = { pv: { signeLe: "2026-12-04T10:00:00.000Z", numero: "PV-1" }, dossier: { remisLe: "2026-12-05T10:00:00.000Z" } };
    const docs = vueDocuments(devis({ retractationJusquau: "2026-11-20" }), { factures, cloture, entreprise, maintenant });
    assert.deepEqual(docs.map((d) => d.id), ["devis", "retractation", "decennale", "a", "d", "dossier", "pv"]);
    assert.equal(docs[0].titre, "Devis signé");
    assert.equal(docs[1].lien, "/api/client/quotes/q1/pdf");
    assert.equal(docs[2].lien, null, "sans fichier, la décennale est seulement déclarée");
    eq(docs[4].detail, "50,00 € · corrige la facture KJ-a");
    assert.equal(docs[6].lien, "/api/client/chantier/q1/pv");
    const avecFichier = vueDocuments(devis(), { entreprise, decennaleFichier: "/api/client/chantier/q1/decennale", maintenant });
    assert.equal(avecFichier.find((d) => d.id === "decennale").titre, "Attestation décennale");
    assert.ok(!avecFichier.some((d) => d.id === "retractation"), "délai terminé : plus de formulaire");
  });

  it("écrit à l'entreprise par la demande Radar, sinon par e-mail", () => {
    assert.equal(contactEntreprise(devis({ chantierOffreId: "radar-1" }), entreprise).lien, "/client/radar/radar-1?entreprise=e1");
    assert.equal(contactEntreprise(devis(), entreprise).lien, "mailto:contact@abl.fr?subject=Devis%202026-041");
    assert.equal(contactEntreprise(devis(), { nom: "X" }), null);
  });

  it("assemble la page : onglet par défaut, sans secret", () => {
    const signe = vueChantierClient(devis({ signatureAccessPasswordHash: "h", clientPortalAccess: { password: "p" } }), { entreprise: { ...entreprise, business: { iban: "FR76" } }, maintenant });
    assert.equal(signe.ongletParDefaut, "chantier");
    assert.equal(signe.surTitre, "Salle de bain, Paris 10e · ABL Expert Renov");
    const texte = JSON.stringify(signe);
    for (const secret of ["\"h\"", "FR76", "\"p\""]) assert.ok(!texte.includes(secret), `ne renvoie pas ${secret}`);
    const aSigner = vueChantierClient(devis({ status: "Envoye", signatureStatus: "", signedAt: "", retractationJusquau: "" }), { entreprise, maintenant });
    assert.equal(aSigner.ongletParDefaut, "devis");
    assert.equal(aSigner.chantier, null);
  });

  it("regroupe les paiements de tous les chantiers signés", () => {
    const autre = devis({ id: "q2", projectId: "p2", status: "Envoye", signatureStatus: "", signedAt: "" });
    const p = paiementsDuClient([devis(), autre], { factures: [facture("a", { dueDate: "2026-12-01" })], maintenant });
    assert.equal(p.groupes.length, 1);
    assert.equal(p.groupes[0].lien, "/client/chantier/q1?onglet=paiements");
    assert.equal(p.aPayer, 1);
    assert.equal(paiementsDuClient([], { maintenant }).groupes.length, 0);
  });

  it("page publique : « Et maintenant » en trois étapes une fois signé (CLI-07)", () => {
    const v = vueLienSignature(devis({ clientEmail: "sophie.l@exemple.fr", startDate: "2026-11-12", demarrageDemande: "" }), { entreprise, maintenant, pdf: "/api/signatures/tok/pdf" });
    assert.equal(v.emailMasque, "s••••@••••.fr");
    assert.equal(v.apres.texte, "Signé le 3 nov. 2026 à 09:12. Votre exemplaire et le formulaire de rétractation partent à s••••@••••.fr.");
    assert.deepEqual(v.apres.etapes.map((e) => e.titre), ["Acompte", "Date de début", "Suivre le chantier"]);
    eq(v.apres.etapes[0].texte, "ABL Expert Renov vous envoie la facture d'acompte (30 % · 1 739,56 €).");
    assert.equal(v.devis.pdf, "/api/signatures/tok/pdf");
    assert.equal(emailMasque("x"), "");
    const aSigner = vueLienSignature(devis({ status: "Envoye", signatureStatus: "", signedAt: "", retractationJusquau: "" }), { entreprise, maintenant });
    assert.equal(aSigner.apres, null);
    assert.ok(aSigner.devis.signature);
  });
});
