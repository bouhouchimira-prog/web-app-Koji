import assert from "node:assert/strict";
import { agendaDuJour, conflits, decaler, estFerie, jourLong, joursOccupes, livraisons, lotsAPlanifier, premierCreneau, resumeSemaine } from "../../lib/calendrier-pro.js";

// Maquettes PRO-11 à 11.4 : semaine 46 de 2026 (mercredi 11 novembre férié).
const workers = [{ id: "rh", name: "Rénov Horizon", type: "Sous-traitant" }, { id: "abl", name: "Équipe ABL", type: "Interne" }];
const titres = new Map([["cau", "Appartement Caulaincourt"], ["aut", "Bureaux Auteuil"], ["lef", "Salle de bain Lefèvre"]]);
const taches = [
  { id: "t1", projectId: "cau", room: "Lot 06", workerIds: ["rh"], startDate: "2026-11-09", endDate: "2026-11-12" },
  { id: "t2", projectId: "aut", room: "Lot 06", workerIds: ["rh"], startDate: "2026-11-12", endDate: "2026-11-12" },
  { id: "t3", projectId: "lef", room: "Lot 01", workerIds: ["abl"], startDate: "2026-11-12", endDate: "2026-11-13" }
];

describe("Calendrier : jours, créneaux, conflits (PRO-11, 11.2)", () => {
  it("11 novembre férié, libellés", () => {
    assert.equal(estFerie("2026-11-11"), true);
    assert.equal(estFerie("2026-11-12"), false);
    assert.equal(jourLong("2026-11-13"), "ven. 13 nov.");
  });
  it("jours occupés hors férié, premier créneau libre", () => {
    assert.deepEqual([...joursOccupes(taches, "rh")].sort(), ["2026-11-09", "2026-11-10", "2026-11-12"]);
    assert.deepEqual(premierCreneau(joursOccupes(taches, "rh"), "2026-11-10", 1), { debut: "2026-11-13", fin: "2026-11-13" });
    assert.deepEqual(premierCreneau(new Set(), "2026-11-26", 2), { debut: "2026-11-26", fin: "2026-11-27" });
  });
  it("Rénov Horizon sur deux chantiers jeu. 12 : décaler Auteuil au ven. 13", () => {
    const c = conflits(taches, workers, { debut: "2026-11-09", fin: "2026-11-15", titres });
    assert.equal(c.length, 1);
    assert.equal(c[0].jour, "2026-11-12");
    assert.deepEqual(c[0].taches.map((t) => t.chantier).sort(), ["Appartement Caulaincourt", "Bureaux Auteuil"]);
    assert.deepEqual(c[0].proposition, { taskId: "t2", chantier: "Bureaux Auteuil", debut: "2026-11-13", fin: "2026-11-13" });
    assert.deepEqual(decaler(taches[0], "2026-11-16"), { startDate: "2026-11-16", endDate: "2026-11-18", dueDate: "2026-11-18" });
  });
});

describe("Calendrier : livraisons, lots à planifier, agenda (PRO-11)", () => {
  const bons = [
    { id: "b1", numero: "BC-0042", supplierName: "Plateforme du Bâtiment", projectId: "lef", envoyeLe: "2026-11-05", livraisonLe: "2026-11-12", livraisonHeure: "10 h", livraisonAdresse: "12 rue Exemple", lignes: [{ quantite: 2, livre: 0 }] },
    { id: "b2", numero: "BC-0043", supplierName: "Cedeo", projectId: "lef", envoyeLe: "2026-11-06", livraisonLe: "2026-11-13", livraisonAdresse: "", lignes: [{ quantite: 1, livre: 0 }] },
    { id: "b3", numero: "BC-0040", supplierName: "Cedeo", projectId: "cau", envoyeLe: "2026-11-02", livraisonLe: "2026-11-09", livraisonAdresse: "x", lignes: [{ quantite: 1, livre: 1 }] }
  ];
  it("livraisons de la semaine, lieu à confirmer bloquant", () => {
    const l = livraisons(bons, { debut: "2026-11-09", fin: "2026-11-15", titres, aujourdhui: "2026-11-12" });
    assert.deepEqual(l.map((x) => [x.fournisseur, x.raison, x.bloquant]), [["Cedeo", "livré", false], ["Plateforme du Bâtiment", "", false], ["Cedeo", "lieu à confirmer", true]]);
    assert.deepEqual(resumeSemaine({ taches, workers, livraisons: l, debut: "2026-11-09", fin: "2026-11-15" }), { chantiers: 3, sousTraitants: 1, livraisons: 3 });
  });
  it("lot 04 électricité à placer après le lot 03", () => {
    const quote = { items: [{ room: "Lot 03 carrelage", label: "Faïence", correctedTimeHours: 21 }, { room: "Lot 04 électricité", label: "Appareillage", correctedTimeHours: 6, totalHt: 380 }] };
    const ts = [{ id: "x", projectId: "lef", room: "Lot 03 carrelage", startDate: "2026-11-24", endDate: "2026-11-26" }, { id: "y", projectId: "lef", room: "Lot 04 électricité", workerIds: ["rh"] }];
    const a = lotsAPlanifier([{ projectId: "lef", title: "Salle de bain Lefèvre", quote }], ts);
    assert.deepEqual(a.map((x) => [x.lot, x.jours, x.apres, x.lotPrecedent, x.workerIds, x.montantHt]), [["Lot 04 électricité", 1, "2026-11-27", "Lot 03 carrelage", ["rh"], 380]]);
    assert.deepEqual(premierCreneau(joursOccupes(taches, "rh"), a[0].apres, 1), { debut: "2026-11-27", fin: "2026-11-27" });
  });
  it("agenda du jour : démarrage, chantiers, livraison, relance", () => {
    const l = livraisons(bons, { debut: "2026-11-12", fin: "2026-11-12", titres });
    const a = agendaDuJour({ jour: "2026-11-12", taches, livraisons: l, relances: [{ id: "r", client: "Copropriété Exemple", numero: "2026-039", jours: 9 }], titres, noms: new Map(workers.map((w) => [w.id, w.name])) });
    assert.deepEqual(a.map((x) => x.titre), ["Appartement Caulaincourt", "Démarrage · Bureaux Auteuil", "Démarrage · Salle de bain Lefèvre", "Livraison Plateforme du Bâtiment → Salle de bain Lefèvre", "Relancer Copropriété Exemple"]);
    assert.equal(a[2].detail, "lot Lot 01 · Équipe ABL");
    assert.equal(a[4].detail, "Devis 2026-039 · sans réponse depuis 9 jours");
  });
  it("agenda du jour : le nom des tâches, sans le faux lot « Autres tâches »", () => {
    const t = (id, label, room = "Autres tâches") => ({ id, projectId: "lef", label, room, startDate: "2026-11-24", endDate: "2026-11-24" });
    const une = agendaDuJour({ jour: "2026-11-24", taches: [t("a", "Peindre les murs")], titres });
    assert.deepEqual(une.map((x) => [x.titre, x.detail]), [["Démarrage · Salle de bain Lefèvre", "Peindre les murs"]]);
    const cinq = agendaDuJour({ jour: "2026-11-24", taches: [t("a", "Peindre les murs"), t("b", "Poncer", "Lot 02"), t("c", "Enduire"), t("d", "Protéger les sols"), t("e", "Nettoyer")], titres });
    assert.equal(cinq[0].detail, "Peindre les murs, Poncer, Enduire + 2 · lot Lot 02");
  });
});
