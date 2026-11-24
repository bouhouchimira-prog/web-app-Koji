import assert from "node:assert/strict";
import { ETAPES, LANCEMENT, TOTAL_JETONS, etapesFaites, fenetre, parcours } from "../../lib/premier-mois.js";

describe("premier mois (PRO-26, version 1)", () => {
  it("huit étapes, seize jetons comme la maquette", () => {
    assert.equal(ETAPES.length, 8);
    assert.equal(TOTAL_JETONS, 16);
  });

  it("fenêtre de 30 jours, à partir de la mise en ligne pour un ancien compte", () => {
    const ancien = fenetre("2026-09-01", "2026-11-20T10:00:00Z");
    assert.equal(ancien.debut, LANCEMENT);
    assert.equal(ancien.ouverte, true);
    const recent = fenetre("2026-12-01T09:00:00Z", "2026-12-12T10:00:00Z");
    assert.equal(recent.debut, "2026-12-01");
    assert.equal(recent.joursRestants, 19);
    assert.equal(fenetre("2026-12-01", "2026-12-31T10:00:00Z").ouverte, false);
  });

  it("constate les étapes sur les données du compte", () => {
    const f = etapesFaites({
      business: { siren: "812345678", documents: { decennale: { fileDataUrl: "data:x" } } },
      ouvrages: 12,
      quotes: [{ status: "Envoye", sentAt: "2026-11-02" }],
      invoices: [{ kind: "avoir", status: "Payee" }],
      clotures: [{ projectId: "c1", pv: { signeLe: "2026-11-10" } }]
    });
    // Procès-verbal sur un chantier sans devis signé : pas de jetons.
    assert.equal(f.pv.faite, false);
    const signe = etapesFaites({
      quotes: [{ projectId: "c1", status: "Signe" }, { projectId: "c2", status: "Envoye" }],
      clotures: [{ projectId: "c1", pv: { signeLe: "2026-11-10" } }]
    });
    assert.equal(signe.pv.faite, true);
    const autreChantier = etapesFaites({
      quotes: [{ projectId: "c1", status: "Signe" }],
      clotures: [{ projectId: "c2", pv: { signeLe: "2026-11-10" } }, { projectId: "c1", pv: null }]
    });
    assert.equal(autreChantier.pv.faite, false);
    assert.equal(f.entreprise.faite, false);
    assert.match(f.entreprise.reste, /logo/);
    assert.equal(f.bibliotheque.reste, "12 sur 40");
    assert.equal(f["devis-envoye"].faite, true);
    assert.equal(f["devis-signe"].faite, false);
    assert.equal(f["facture-payee"].faite, false);
  });

  it("ne pointe l'app que vers des routes qui existent (pas « /quote »)", () => {
    assert.deepEqual(ETAPES.filter((e) => e.app === "/quote").map((e) => e.id), []);
    assert.equal(ETAPES.find((e) => e.id === "devis-envoye").app, "/quote/detail");
  });

  it("crédite une étape faite une seule fois, et seulement pendant le mois", () => {
    const faits = { "devis-envoye": { faite: true }, pv: { faite: true } };
    const p = parcours({ faits, credits: [{ etape: "devis-envoye", quantite: 1 }], inscritLe: "2026-12-01", maintenant: "2026-12-05T10:00:00Z" });
    assert.deepEqual(p.aCrediter.map((e) => e.id), ["pv"]);
    assert.equal(p.jetonsOfferts, 6);
    assert.equal(p.prochaine.id, "entreprise");
    const tard = parcours({ faits, credits: [], inscritLe: "2026-12-01", maintenant: "2027-01-05T10:00:00Z" });
    assert.equal(tard.aCrediter.length, 0);
  });
});
