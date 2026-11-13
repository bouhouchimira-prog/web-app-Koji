const assert = require("assert");
const { lignesChantiers, compterOnglets, resumeChantiers, lotsDuDevis, villeDe } = require("../../lib/chantiers-liste");

const AUJ = "2026-11-12";
const MAINTENANT = new Date("2026-11-12T09:00:00").getTime();

const devisSigne = (projectId, extra = {}) => ({
  id: `q-${projectId}`, projectId, status: "Signe", client: "Mme Lefèvre", totalHt: 7800,
  items: [
    { room: "Lot 1 - Salon", code: "PEI-01", label: "Peinture murs" },
    { room: "Lot 1 - Salon", code: "SOL-02", label: "Parquet" },
    { room: "Lot 2 - SDB", code: "PLO-01", label: "Receveur" }
  ],
  ...extra
});

describe("lib/chantiers-liste (PRO-02)", () => {
  it("compte les lots faits : toutes les lignes du lot ont leur tâche terminée", () => {
    const devis = devisSigne("c1");
    const taches = [
      { projectId: "c1", quoteItemId: "Lot 1 - Salon-PEI-01", done: true },
      { projectId: "c1", label: "Parquet", room: "Lot 1 - Salon", done: true },
      { projectId: "c1", quoteItemId: "Lot 2 - SDB-PLO-01", done: false }
    ];
    assert.deepStrictEqual(lotsDuDevis(devis, taches), { total: 2, faits: 1, lignes: 3, lignesFaites: 2 });
    assert.deepStrictEqual(lotsDuDevis(null, taches), { total: 0, faits: 0, lignes: 0, lignesFaites: 0 });
  });

  it("met en avant ce qui demande une action", () => {
    const lignes = lignesChantiers({
      aujourdhui: AUJ,
      maintenant: MAINTENANT,
      projects: [
        { id: "c1", title: "Bureaux Auteuil", address: "4 rue X, 75016 Paris" },
        { id: "c2", title: "Rénovation, Caulaincourt", address: "Paris" },
        { id: "c3", title: "Salle de bain, Paris 10e", address: "75010 Paris" },
        { id: "c4", title: "Cuisine", address: "Lyon" },
        { id: "c5", title: "Ancien", status: "archive" }
      ],
      quotes: [
        devisSigne("c1", { totalHt: 48200 }),
        devisSigne("c2", { totalHt: 20000 }),
        { id: "q3", projectId: "c3", status: "Envoye", client: "Mme Lefèvre", totalHt: 7800, startDate: "2026-11-16", items: [] },
        devisSigne("c4", { totalHt: 12000 })
      ],
      tasks: [
        { projectId: "c1", label: "Livraison receveur", dueDate: "2026-11-13", done: false },
        { projectId: "c4", label: "Pose", endDate: "2026-11-01", done: false }
      ],
      calendarEvents: [{ projectId: "c1", title: "Visite", startAt: "2026-11-20T10:00:00" }],
      invoices: [{ projectId: "c2", status: "Emise", kind: "situation", dueDate: "2026-11-01", amountTtc: 13896, invoiceNumber: "2026-012" }],
      alerts: [{ projectId: "c1", type: "fuite", source: "client", status: "open" }]
    });
    assert.strictEqual(lignes.length, 4);
    const [c1, c2, c3, c4] = lignes;
    assert.deepStrictEqual(c1.etiquette, { label: "Bloquant", ton: "b" });
    assert.strictEqual(c1.detail, "Fuite signalée par le client");
    assert.strictEqual(c1.jalon, "Livraison receveur, demain");
    assert.strictEqual(c1.ville, "Paris");
    assert.deepStrictEqual(c1.avancement, { faits: 0, total: 2, unite: "lots", pourcent: 0 });
    assert.strictEqual(c1.montant.texte, "48 200 € HT");

    assert.deepStrictEqual(c2.etiquette, { label: "À relancer", ton: "o" });
    assert.strictEqual(c2.jalon, "Facture 2026-012 : 13 896 € à encaisser");
    assert.deepStrictEqual(c2.montant, { texte: "13 896 € en attente", attente: true });

    assert.strictEqual(c3.onglet, "a_planifier");
    assert.deepStrictEqual(c3.etiquette, { label: "Échéance", ton: "w" });
    assert.strictEqual(c3.jalon, "Démarrage à planifier, 16 nov.");

    assert.deepStrictEqual(c4.etiquette, { label: "En retard", ton: "b" });
    assert.strictEqual(c4.detail, "Fin prévue dépassée (1 nov.)");

    const comptes = compterOnglets(lignes);
    assert.deepStrictEqual(comptes, { en_cours: 3, a_planifier: 1, termine: 0, tous: 4 });
    assert.strictEqual(resumeChantiers(comptes), "3 en cours · 1 à planifier");
  });

  it("garde un chantier signé mais pas lancé dans « À planifier »", () => {
    const [l] = lignesChantiers({
      aujourdhui: AUJ,
      maintenant: MAINTENANT,
      projects: [{ id: "c9", title: "Salle de bain" }],
      quotes: [devisSigne("c9")],
      tasks: []
    });
    assert.strictEqual(l.onglet, "a_planifier");
    assert.strictEqual(l.aLancer, true);
    assert.strictEqual(l.jalon, "Chantier à lancer : planning à valider");
    assert.deepStrictEqual(l.etiquette, { label: "À planifier", ton: "o" });
  });

  it("garde la ville seule", () => {
    assert.strictEqual(villeDe("12 rue des Vinaigriers, 75010 Paris"), "Paris");
    assert.strictEqual(villeDe("Saint-Ouen"), "Saint-Ouen");
  });
});
