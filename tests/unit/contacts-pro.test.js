import assert from "node:assert/strict";
import { argentClient, correspondAuContact, doublon, etatDocument, DOCS_VIGILANCE, historiqueContact, initiales, lireCsvContacts, prixConstates, prochaineAction, typeContact, vigilance, chantiersDuPro } from "../../lib/contacts-pro.js";

// Maquettes PRO-10 à 10.3 (fiches de Mme Lefèvre et de Rénov Horizon).
const auj = "2026-10-30";
const urssaf = DOCS_VIGILANCE.find((d) => d.cle === "urssaf");
const rc = DOCS_VIGILANCE.find((d) => d.cle === "rcpro");

describe("Contacts : types et documents de vigilance (PRO-10, 10.1)", () => {
  it("type, genre de client, initiales", () => {
    assert.deepEqual(typeContact({ roles: ["client"], type: "particulier" }), { cle: "client", label: "Client", genre: "particulier", pro: false });
    assert.equal(typeContact({ roles: ["client"], genreClient: "syndic" }).genre, "syndic");
    assert.equal(typeContact({ roles: ["architecte"] }).label, "Prescripteur");
    assert.equal(initiales("Mme Lefèvre"), "LE");
    assert.equal(initiales("Rénov Horizon Carrelage"), "RH");
  });
  it("URSSAF : 6 mois, expirée, échéance à 30 jours, non concerné", () => {
    assert.deepEqual(etatDocument({ date: "2026-05-02" }, urssaf, "2026-11-05"), { etat: "expire", texte: "manquante · expirée le 2 nov." });
    assert.deepEqual(etatDocument({ date: "2026-05-02" }, urssaf, auj), { etat: "echeance", texte: "expire le 2 nov. · dans 3 jours" });
    assert.equal(etatDocument({ date: "2026-05-20" }, urssaf, auj).etat, "echeance");
    assert.deepEqual(etatDocument({ validJusqu: "2026-11-30" }, rc, auj), { etat: "echeance", texte: "expire le 30 nov. · dans 31 jours" });
    assert.equal(etatDocument(null, urssaf, auj).texte, "manquante");
    assert.equal(etatDocument({ demandeLe: "2026-11-02" }, urssaf, auj).texte, "manquante · demandée le 2 nov.");
    assert.equal(etatDocument({ nonConcerne: true, date: "2026-09-12" }, DOCS_VIGILANCE[4], auj).texte, "non concerné · déclaré le 12 sept.");
  });
  it("bloquant au-delà de 5 000 € HT confiés", () => {
    const c = { roles: ["sous_traitant"], vigilance: { kbis: { date: "2026-10-14" }, decennale: { validJusqu: "2026-12-31" }, rcpro: { validJusqu: "2026-11-30" } } };
    assert.equal(vigilance(c, { cumulHt: 14200, aujourdhui: auj }).bloquant.cle, "urssaf");
    assert.equal(vigilance(c, { cumulHt: 1200, aujourdhui: auj }).bloquant, null);
    const a = prochaineAction(c, { vig: vigilance(c, { cumulHt: 14200, aujourdhui: auj }), aujourdhui: auj });
    assert.deepEqual([a.label, a.flag, a.urgent], ["Demander l'attestation", "URSSAF manquante", true]);
  });
});

describe("Contacts : client, historique, ajout (PRO-10, 10.2)", () => {
  const lef = { id: "c1", roles: ["client"], email: "s.lefevre@exemple.invalid", phone: "06 00 00 41 18" };
  const quotes = [{ id: "q1", quoteNumber: "2026-041", status: "Signe", totalHt: 5271.4, clientEmail: "S.Lefevre@exemple.invalid", signedAt: "2026-10-21T10:00:00Z" }];
  const invoices = [{ id: "f1", invoiceNumber: "KJ-2026-118", type: "Facture d'acompte", status: "Emise", issuedAt: "2026-10-23", dueDate: "2026-11-06", amountTtc: 1739.56 }];

  it("devis et factures du contact, argent et acompte échu", () => {
    assert.equal(correspondAuContact(lef, quotes[0]), true);
    assert.equal(correspondAuContact(lef, { phone: "0600004118" }), true);
    const a = argentClient({ quotes, invoices, aujourdhui: "2026-11-15" });
    assert.deepEqual({ ...a, echue: a.echue?.id }, { signeHt: 5271.4, factureTtc: 1739.56, paye: 0, retard: 1739.56, echue: "f1" });
    const p = prochaineAction(lef, { argent: a, aujourdhui: "2026-11-15" });
    assert.equal(p.label, "Relancer l'acompte");
    assert.equal(p.texte.replace(/[  ]/g, " "), "Acompte de 1 739,56 € échu depuis le 6 nov.");
    assert.equal(p.flag, "acompte échu");
  });
  it("historique rempli seul, du plus récent au plus ancien", () => {
    const h = historiqueContact({ contact: { ...lef, journal: [{ id: "j", kind: "appel", text: "Le mari sera présent jeudi", at: "2026-11-04T09:00:00Z", dictee: true }] }, quotes, invoices: [{ ...invoices[0], status: "Emise" }] });
    assert.deepEqual(h.map((x) => x.titre), ["Appel", "Facture", "Devis"]);
    assert.equal(h[0].texte, "« Le mari sera présent jeudi » · noté par dictée");
  });
  it("doublon par SIREN, téléphone ou e-mail ; import CSV", () => {
    const existants = [{ id: "e", companyName: "Électricité Benarab", siret: "912345538 00012" }];
    assert.equal(doublon(existants, { siret: "912 345 538" }).par, "même SIREN");
    assert.equal(doublon(existants, { phone: "0612" }), null);
    const rows = lireCsvContacts("Nom;Prénom;Entreprise;Téléphone;E-mail;Type\nOrtega;Luis;Menuiserie Ortega;06 11;l@exemple.invalid;Sous-traitant\nDurand;Marie;;07 22;;client\n");
    assert.deepEqual(rows.map((r) => [r.companyName || r.lastName, r.type, r.roles[0]]), [["Menuiserie Ortega", "societe", "sous_traitant"], ["Durand", "particulier", "client"]]);
  });
  it("sous-traitant : prix constatés et chantiers depuis ses factures", () => {
    const pieces = [
      { statut: "rangee", fournisseur: "Rénov Horizon Carrelage", projectId: "cau", ht: 9800, autoliquidation: true, date: "2026-10-22", lignes: [{ designation: "Pose faïence murale", quantite: 20, montantHt: 640 }] },
      { statut: "rangee", fournisseur: "Rénov Horizon", projectId: "len", ht: 4400, date: "2026-06-02", lignes: [{ designation: "Pose faïence murale", quantite: 10, montantHt: 320 }] }
    ];
    assert.deepEqual(prixConstates(pieces), [{ designation: "Pose faïence murale", unite: "", prixHt: 32, fois: 2 }]);
    const c = chantiersDuPro(pieces, new Map([["cau", "Caulaincourt"]]), 2026);
    assert.equal(c.cumulAnnee, 14200);
    assert.equal(c.autoliquidation, true);
    assert.deepEqual(c.chantiers.map((x) => [x.title, x.ht]), [["Caulaincourt", 9800], ["Chantier", 4400]]);
  });
});
