const assert = require("assert");
const pro = require("../../lib/fournitures-pro");
const chantier = require("../../lib/fournitures-chantier");
const bons = require("../../lib/fournitures-bons");

// Chiffres de la maquette PRO-07 à 07.6.
const colle = { id: "a-colle", name: "Colle C2S1, sac 25 kg", unit: "sac", achat: 18, prixPublic: 26.9, modePrix: "manuel", prixManuel: 24, fournisseurs: [{ supplierId: "pdb", supplierName: "Plateforme du Bâtiment", achat: 18, prefere: true }] };
const gres = { id: "a-gres", name: "Grès cérame 60 × 60 rectifié", unit: "m²", famille: "Carrelage · grès cérame", perte: 5, contenance: 1.44, uniteCond: "boîte", prixPublic: 64.9, modePrix: "public", fournisseurs: [{ supplierId: "pdb", supplierName: "Plateforme du Bâtiment", ref: "GC6060-R", achat: 48, prefere: true }], ouvrages: [{ code: "CAR-010", conso: 1 }] };
const colonne = { id: "a-col", name: "Colonne de douche thermostatique", unit: "u", prixPublic: 399, modePrix: "coefficient", coef: 1.3, fournisseurs: [{ supplierId: "cedeo", supplierName: "Cedeo", achat: 289, prefere: true }] };
const sacs = { id: "a-sacs", name: "Sacs à gravats renforcés", unit: "u", achat: 1.2, modePrix: "public" };

describe("fournitures : prix et marge (PRO-07)", () => {
  it("prix public, manuel, coefficient", () => {
    assert.deepStrictEqual(pro.marge(gres), { vente: 64.9, achat: 48, euros: 16.9, pct: 26, ecartPublic: 0 });
    const m = pro.marge(colle);
    assert.strictEqual(m.vente, 24);
    assert.strictEqual(m.euros, 6);
    assert.strictEqual(m.pct, 25);
    assert.strictEqual(m.ecartPublic, -2.9);
    assert.strictEqual(pro.prixVente(colonne), 375.7);
    assert.strictEqual(pro.marge(colonne).pct, 23);
    assert.strictEqual(pro.libelleMode(colonne), "× 1,30");
    assert.strictEqual(pro.libelleMode(colle), "Manuel");
  });
  it("sans prix public, bascule sur le coefficient du compte", () => {
    assert.strictEqual(pro.modeEffectif(sacs), "coefficient");
    assert.strictEqual(pro.prixVente(sacs), 1.56);
    assert.deepStrictEqual(pro.manquesArticle(sacs), ["fournisseur"]);
  });
  it("conditionnement, perte et rendement", () => {
    assert.strictEqual(pro.achatParUnite(69.12, 1.44), 48);
    assert.strictEqual(pro.avecPerte(5.8, 5), 6.1);
    assert.deepStrictEqual(pro.arrondiConditionnement(6.1, 1.44), { paquets: 5, quantite: 7.2, ecart: 1.1 });
    assert.strictEqual(pro.rendement(25, 5), 5);
    assert.deepStrictEqual(pro.paquetsPourSurface(14.2, 4), { exact: 3.55, paquets: 4 });
    assert.strictEqual(pro.perteFamille("Carrelage · grès cérame"), 5);
  });
  it("tarif CSV appliqué par référence", () => {
    const { lignes } = pro.lireTarifCsv("Référence;Désignation;Prix achat;Prix public\nGC6060-R;Grès;47,50;65,90\nZZZ;Autre;1;2\n");
    assert.strictEqual(lignes.length, 2);
    assert.deepStrictEqual(pro.appliquerTarif([gres, colle], lignes), [{ id: "a-gres", ref: "GC6060-R", achat: 47.5, public: 65.9 }]);
  });
  it("code interne et articles proches", () => {
    assert.strictEqual(pro.codeInterne("Grès cérame 60 × 60 rectifié"), "GC6060");
    assert.strictEqual(pro.codeInterne("Grès cérame 60 × 60 rectifié", ["GC6060"]), "GC6060-2");
    assert.deepStrictEqual(pro.articlesProches("Grès cérame 60 × 60 rectifié anthracite", [gres, colle]).map((a) => a.id), ["a-gres"]);
  });
});

describe("fournitures du chantier (PRO-07.1)", () => {
  const quote = {
    items: [
      { room: "Lot 03", code: "CAR-010", label: "Poser le carrelage au sol", quantity: 5.8, unit: "m²" },
      { room: "Lot 02", code: "PLB-001", label: "Douche", quantity: 1, materialLines: [{ productId: "a-col", productName: "Colonne de douche thermostatique", unitsToBuy: 1 }] },
      { room: "Lot 01", code: "DEP", label: "Dépose", quantity: 1, materialLines: [{ productId: "a-sacs", productName: "Sacs à gravats renforcés", unitsToBuy: 20 }] }
    ]
  };
  it("quantités du devis, perte, rangement par fournisseur", () => {
    const besoins = chantier.besoinsChantier({ quote, articles: [gres, colonne, sacs, colle] });
    const g = besoins.find((b) => b.articleId === "a-gres");
    assert.strictEqual(g.quantite, 6.1);
    assert.strictEqual(g.totalHt, 292.8);
    assert.strictEqual(g.detail, "5,8 m² + 5 % de perte");
    const r = chantier.rangerParFournisseur(besoins);
    assert.deepStrictEqual(r.aCompleter.map((b) => b.name), ["Sacs à gravats renforcés"]);
    assert.deepStrictEqual(r.fournisseurs.map((f) => [f.supplierName, f.totalHt]), [["Cedeo", 289], ["Plateforme du Bâtiment", 292.8]]);
    assert.strictEqual(r.totalHt, 581.8);
  });
  it("un avenant signé change la quantité", () => {
    const avenants = [{ status: "Signe", numero: 1, lignes: [{ type: "modification", ligneDevisRef: "Lot 03-CAR-010", quantiteAvant: 5.8, quantiteApres: 7 }] }];
    const g = chantier.besoinsChantier({ quote, avenants, articles: [gres] }).find((b) => b.articleId === "a-gres");
    assert.strictEqual(g.quantite, 7.4);
    assert.strictEqual(g.avenant, true);
  });
});

describe("stock léger (PRO-07.4)", () => {
  const stock = [
    { articleId: "a-gres", name: "Grès", quantite: 1.1, prixHt: 48, lieu: "Dépôt", entreeLe: "2026-11-28" },
    { articleId: "a-colle", name: "Colle", quantite: 3, prixHt: 18, lieu: "Dépôt", entreeLe: "2026-10-09" },
    { name: "Câble", quantite: 38, prixHt: 1.1, lieu: "Camionnette", entreeLe: "2026-09-02" },
    { name: "Faïence 20 × 20 verte", quantite: 2.3, prixHt: 21, lieu: "Dépôt", entreeLe: "2026-03-14" },
    { name: "Joint", quantite: 0.5, prixHt: 42, lieu: "Camionnette", entreeLe: "2026-11-28" }
  ];
  it("valeur indicative et non utilisés", () => {
    assert.strictEqual(chantier.valeurStock(stock), 217.9);
    assert.strictEqual(chantier.moisSansUsage(stock[3], "2026-11-20"), 8);
    assert.strictEqual(chantier.nonUtilise(stock[3], "2026-10-15"), true);
    assert.strictEqual(chantier.nonUtilise(stock[1], "2026-11-20"), false);
  });
  it("utiliser le stock avant de commander", () => {
    const besoins = [
      { articleId: "a-colle", name: "Colle C2S1, sac 25 kg", quantite: 4, prixHt: 18, contenance: 1 },
      { articleId: "a-gres", name: "Grès cérame 60 × 60 rectifié", quantite: 14.2, prixHt: 48, contenance: 1.44 }
    ];
    const [c, g] = chantier.proposerStock(besoins, stock);
    assert.strictEqual(c.coche, true);
    assert.strictEqual(g.coche, false);
    assert.strictEqual(g.teinte, true);
    assert.deepStrictEqual(chantier.resteACommander(c), { besoin: 1, paquets: 1, quantite: 1, ecart: 0, prisHt: 54 });
    assert.strictEqual(chantier.resteACommander({ ...g, coche: true }).paquets, 10);
  });
  it("restes probables en fin de chantier", () => {
    const r = chantier.restesProbables({ commandes: [{ cle: "g", commande: 7.2, posee: 6.1 }, { cle: "c", commande: 5, posee: 5 }, { cle: "f", commande: 21.6, posee: 21.2, casse: true }] });
    assert.deepStrictEqual(r.map((x) => [x.cle, x.reste, x.coche]), [["g", 1.1, true], ["f", 0.4, false]]);
  });
});

describe("bons de commande (PRO-07.6)", () => {
  const bon = {
    numero: "BC-2026-031",
    envoyeLe: "2026-10-28T09:14:00Z",
    lignes: [
      { name: "Faïence 30 × 60 blanc mat", quantite: 16, prixHt: 25.75, livre: 16 },
      { name: "Colle C2 gris", quantite: 4, prixHt: 17.1, livre: 4 },
      { name: "Joint 2 mm gris clair", quantite: 3, prixHt: 9.6, livre: 0 },
      { name: "Silicone sanitaire gris", quantite: 2, prixHt: 7.2, livre: 0 },
      { name: "Receveur extra-plat 90 × 120", quantite: 1, prixHt: 369, livre: 0 }
    ]
  };
  it("numéros, totaux, état et reste à livrer", () => {
    assert.strictEqual(bons.numeroBon([{ numero: "BC-2026-030" }, { numero: "BC-2025-090" }], 2026), "BC-2026-031");
    assert.strictEqual(bons.numeroBonPartenaire([{ numeroKoji: "BC-KJ-2026-0041" }], 2026), "BC-KJ-2026-0042");
    assert.deepStrictEqual(bons.totauxBon(bon.lignes), { ht: 892.6, tva: 178.52, ttc: 1071.12 });
    assert.strictEqual(bons.etatBon(bon), "partiel");
    assert.strictEqual(bons.resteALivrer(bon).length, 3);
    assert.strictEqual(bons.etatBon({ ...bon, lignes: bon.lignes.map((l) => ({ ...l, livre: l.quantite })) }), "livre");
    assert.strictEqual(bons.etatBon({ ...bon, lignes: bon.lignes.map((l) => ({ ...l, livre: 0 })) }), "envoye");
  });
});

describe("réception d'une livraison (PRO-07.5)", () => {
  it("compare le bon lu et prépare la réclamation", () => {
    const commande = [
      { name: "Grès cérame 60 × 60, gris", quantite: 42 },
      { name: "Colle C2S1, sac 25 kg", quantite: 10 },
      { name: "Receveur extra-plat 90 × 120", quantite: 1 },
      { name: "Siphon de douche", quantite: 1 },
      { name: "Croisillons 2 mm", quantite: 4 }
    ];
    const lues = [
      { name: "GRES CERAME 60X60 GRIS", quantite: 42 },
      { name: "COLLE C2S1 25KG", quantite: 10 },
      { name: "RECEVEUR EXTRA-PLAT 90X120", quantite: 1, casse: true, defaut: "un coin cassé" },
      { name: "CROISILLONS 2MM", quantite: 4 }
    ];
    const ecarts = bons.comparerLivraison(commande, lues);
    assert.deepStrictEqual(ecarts.map((e) => e.etat), ["conforme", "conforme", "casse", "manquant", "conforme"]);
    assert.strictEqual(bons.plusJoursOuvres("2026-11-20", 2), "2026-11-24");
    assert.strictEqual(
      bons.texteReclamation({ numeroBl: "BL-55102", date: "2026-11-20", ecarts, dateLimite: "2026-11-24" }),
      "Bonjour, livraison BL-55102 du 20 nov. : receveur 90 × 120 livré avec un coin cassé (photo jointe) et siphon de douche manquant. Merci de remplacer le receveur et de livrer le siphon avant le 24 nov."
    );
  });
});

describe("partenaires Koji (PRO-07.3)", () => {
  it("contrôles de la mercuriale et écart moyen", () => {
    const rows = bons.lireMercurialeCsv([
      "Référence;Désignation;Conditionnement;Unité;Prix Koji HT;Prix public HT;Validité",
      "MD-GC6060A;Grès cérame 60 × 60 rectifié, anthracite;boîte 1,44 m²;m²;46,50;64,90;2026-12-31",
      "MD-X;Grès 60×60 gris;;m²;40;60;2026-12-31",
      "MD-P;Plinthe assortie anthracite;boîte 10;ml;12;10;2026-12-31",
      "MD-C;Croisillons 2 mm;SAC10;SAC10;3;5;2026-12-31",
      "MD-D;Grès cérame 60 × 60 rectifié, anthracite;boîte 1,44 m²;m²;46,50;64,90;2026-12-31",
      "MD-V;Faïence 30 × 60 blanc mat;boîte 1,08 m²;m²;30,50;44,50;"
    ].join("\n"));
    const c = bons.controlerMercuriale(rows);
    assert.strictEqual(c.lues, 6);
    assert.strictEqual(c.valides.length, 1);
    assert.deepStrictEqual(c.erreurs.map((e) => e.probleme), [
      "Conditionnement manquant",
      "Prix Koji supérieur au prix public",
      "Unité inconnue « SAC10 »",
      "Doublon de la ligne 2",
      "Date de validité absente"
    ]);
    assert.strictEqual(bons.ecartMoyen([{ prixKoji: 46.5, prixPublic: 64.9 }, { prixKoji: 30.5, prixPublic: 44.5 }, { prixKoji: 17.2, prixPublic: 26.9 }]), -32);
    assert.strictEqual(bons.contenanceDe("boîte 1,44 m²"), 1.44);
    assert.strictEqual(bons.initiales("Carrelages Mendy"), "CM");
  });
});
