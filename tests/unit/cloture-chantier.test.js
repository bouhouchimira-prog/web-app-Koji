const assert = require("assert");
const { montantsSolde, detailSolde, noteSolde, garanties, etapesCloture, bilanChantier, factureDeSolde, factureDeRetenue, facturesDuChantier, plusAns, travauxReceptionnes, NOTE_LIBERATION_RETENUE } = require("../../lib/cloture-chantier");

// Chiffres de la maquette PRO-02.4 (TVA 10 %).
const DEVIS = { id: "q1", quoteNumber: "2026-041", totalHt: 5271.4, totalTtc: 5798.54, items: [{ room: "Dépose", code: "D1", label: "Dépose de baignoire", correctedTimeHours: 4 }] };
const AVENANTS = [{ numero: "AV-1", status: "Signe", totalHtDelta: 312, totalTtcDelta: 343.2 }, { numero: "AV-2", status: "Brouillon", totalHtDelta: 900, totalTtcDelta: 990 }];
const FACTURES = [
  { id: "f1", projectId: "c1", quoteId: "q1", type: "Acompte initial", status: "Payee", amountTtc: 1739.56 },
  { id: "f2", projectId: "c1", quoteId: "q1", type: "Facture intermédiaire", status: "Emise", amountTtc: 2515 },
  { id: "f3", projectId: "c1", quoteId: "q1", type: "Facture intermédiaire", status: "Annulee", amountTtc: 800 }
];
const PV = { signeLe: "2026-12-04T16:20:00Z", signataire: "Mme Lefèvre", reserves: [{ numero: "R3", titre: "Spot de douche" }] };

describe("lib/cloture-chantier (PRO-02.4)", () => {
  const actives = facturesDuChantier(FACTURES, { projectId: "c1", quoteId: "q1" });

  it("calcule la facture de solde de la maquette", () => {
    const s = montantsSolde({ devis: DEVIS, avenants: AVENANTS, factures: actives, tauxRetenue: 5 });
    assert.deepStrictEqual([s.travauxHt, s.travauxTtc, s.dejaHt, s.retenueHt, s.retenueTtc, s.soldeHt], [5583.4, 6141.74, 3867.78, 279.17, 307.09, 1436.45]);
    assert.strictEqual(s.soldeTtc, 1580.09);
    assert.deepStrictEqual(s.avenants, ["AV-1"]);
    assert.strictEqual(detailSolde(s), "travaux 5 583,40 € HT − déjà facturé 3 867,78 € − retenue 279,17 € = 1 436,45 € HT · 1 580,09 € TTC");
    assert.match(noteSolde(s, PV.signeLe), /Retenue de garantie 5 % : 307,09 € TTC, libérable le 4 déc\. 2027/);
    const sans = montantsSolde({ devis: DEVIS, avenants: AVENANTS, factures: actives });
    assert.strictEqual(sans.soldeTtc, 1887.18);
    assert.strictEqual(detailSolde(sans), "travaux 5 583,40 € HT − déjà facturé 3 867,78 € = 1 715,62 € HT · 1 887,18 € TTC");
  });

  it("date les garanties à partir de la réception", () => {
    assert.deepStrictEqual(garanties(PV.signeLe).map((g) => `${g.titre} ${g.duree} ${g.jusqua}`), [
      "Parfait achèvement 1 an jusqu'au 4 déc. 2027",
      "Bon fonctionnement 2 ans jusqu'au 4 déc. 2028",
      "Décennale 10 ans jusqu'au 4 déc. 2036"
    ]);
    assert.strictEqual(garanties("")[0].jusqua, "à partir de la réception");
    assert.strictEqual(plusAns("2028-02-29", 1), "2029-02-28");
  });

  it("donne les six étapes et l'étape en cours", () => {
    const reserves = [
      { numero: "R1", statut: "levee", leveeLe: "2026-12-02T14:10:00Z" },
      { numero: "R2", statut: "levee", leveeLe: "2026-12-03T10:00:00Z" },
      { numero: "R3", statut: "levee", leveeLe: "2026-12-07T09:00:00Z" }
    ];
    const solde = montantsSolde({ devis: DEVIS, avenants: AVENANTS, factures: actives, tauxRetenue: 5 });
    const e = etapesCloture({ cloture: { pv: PV, retenue: { taux: 5 } }, reserves, solde, aujourdhui: "2026-12-08" });
    assert.deepStrictEqual(e.map((x) => `${x.id}:${x.etat}`), ["reception:ok", "reserves:ok", "solde:cur", "dossier:todo", "avis:todo", "retenue:todo"]);
    assert.strictEqual(e[0].detail, "PV signé par Mme Lefèvre le 4 déc. à 17:20 · 1 réserve inscrite (R3)");
    assert.strictEqual(e[0].court, "PV signé le 4 déc. · 1 réserve (R3)");
    assert.strictEqual(e[1].detail, "R1, R2, R3 levées · R3 le 7 déc.");
    assert.strictEqual(e[2].action.id, "emettre_solde");
    assert.strictEqual(e[5].detail, "307,09 € TTC · libérable le 4 déc. 2027 si aucune réserve en cours · Koji vous le rappelle");
    assert.strictEqual(e[5].action.id, "rappel");

    // Avant la réception, avec une réserve ouverte.
    const soldeSans = montantsSolde({ devis: DEVIS, avenants: AVENANTS, factures: actives });
    const avant = etapesCloture({ reserves: [...reserves.slice(0, 2), { numero: "R3", statut: "a_faire", pourLe: "2026-12-05" }], solde: soldeSans, aujourdhui: "2026-12-01" });
    assert.deepStrictEqual(avant.map((x) => x.etat), ["cur", "todo", "todo", "todo", "todo", "ok"]);
    assert.strictEqual(avant[1].detail, "2 levées sur 3 · R3 avant le 5 déc.");
    assert.strictEqual(avant[5].action.id, "retenue_on");

    // Solde émis, retenue due un an après.
    const facture = factureDeSolde([...FACTURES, { projectId: "c1", type: "Facture finale", status: "Emise", amountTtc: 1580.09, invoiceNumber: "FAC-2026-0134" }], { projectId: "c1" });
    const apres = etapesCloture({ cloture: { pv: PV, retenue: { taux: 5, rappelId: "ev1" } }, reserves, solde, factureSolde: facture, aujourdhui: "2027-12-04" });
    assert.strictEqual(apres[2].detail, "FAC-2026-0134 · 1 580,09 € TTC");
    assert.strictEqual(apres[5].etat, "todo");
    assert.strictEqual(apres[3].etat, "cur");
    assert.strictEqual(apres[5].action.id, "facturer_retenue");

    // Retenue facturée un an après : la facture de solde reste la première.
    const toutes = [...FACTURES, { projectId: "c1", type: "Facture finale", status: "Payee", amountTtc: 1580.09, invoiceNumber: "FAC-2026-0134", createdAt: "2026-12-08" }, { projectId: "c1", type: "Facture finale", status: "Emise", amountTtc: 307.09, invoiceNumber: "FAC-2027-0410", createdAt: "2027-12-06", notes: NOTE_LIBERATION_RETENUE }];
    assert.strictEqual(factureDeSolde(toutes, { projectId: "c1" }).invoiceNumber, "FAC-2026-0134");
    const liberee = etapesCloture({ cloture: { pv: PV, retenue: { taux: 5, rappelId: "ev1" } }, reserves, solde, factureSolde: factureDeSolde(toutes, { projectId: "c1" }), factureRetenue: factureDeRetenue(toutes, { projectId: "c1" }), aujourdhui: "2027-12-06" });
    assert.strictEqual(liberee[5].etat, "ok");
    assert.strictEqual(liberee[5].detail, "307,09 € TTC · facturée (FAC-2027-0410)");
  });

  it("fait le bilan sans rien inventer", () => {
    const solde = montantsSolde({ devis: DEVIS, avenants: AVENANTS, factures: actives });
    const taches = [
      { startDate: "2026-11-17", endDate: "2026-12-09", quoteItemId: "Dépose-D1", label: "Dépose de baignoire", consumedMinutes: 330 },
      { startDate: "2026-11-19", endDate: "2026-12-02", label: "Poser le receveur" }
    ];
    const b = bilanChantier({ solde, depenses: [{ amount: 2000 }, { amount: 1870 }], budgetEstime: 3908.38, taches, devis: DEVIS, receptionLe: "2026-12-10T10:00:00Z" });
    assert.deepStrictEqual(b.lignes.map((l) => `${l.label} : ${l.valeur}`), [
      "Devis + avenant AV-1 : 5 583,40 € HT",
      "Dépensé : 3 870 € · 2 dépenses",
      "Marge : 30,7 % · prévue 30 %",
      "Durée : 18 jours ouvrés · prévu 17"
    ]);
    assert.strictEqual(b.appris, "Dépose de baignoire : 5,5 h pour 4 h prévues. Mettre à jour dans Mes prix ?");
    const avant = bilanChantier({ solde, taches, devis: DEVIS, aujourdhui: "2026-11-12" });
    assert.strictEqual(avant.lignes.at(-1).label + " : " + avant.lignes.at(-1).valeur, "Durée prévue : 17 jours ouvrés");
    const vide = bilanChantier({ solde, taches: [] });
    assert.deepStrictEqual(vide.lignes.map((l) => l.id), ["travaux", "depense"]);
    assert.strictEqual(vide.appris, null);
  });

  it("résume les travaux réceptionnés", () => {
    assert.strictEqual(travauxReceptionnes(DEVIS, 4, ["AV-1"]), "4 lots · devis 2026-041 et avenant AV-1");
  });
});
