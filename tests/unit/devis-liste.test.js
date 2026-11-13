const assert = require("assert");
const { statutDevis, derniereAction, actionDevis, compterDevis, resumeDevis, ongletDevis, finValidite, messageRelance } = require("../../lib/devis-liste");

// Liste des devis de la maquette PRO-03 (29 octobre 2026).
const AUJ = "2026-10-29";
const D = [
  { quoteNumber: "2026-041", client: "Mme Lefèvre", status: "Brouillon", updatedAt: "2026-10-29T18:42:00Z" },
  { quoteNumber: "2026-040", client: "Marc Lenoir", status: "Envoye", sentAt: "2026-10-27T09:00:00Z", viewedAt: "2026-10-27T20:00:00Z" },
  { quoteNumber: "2026-039", client: "Copropriété Exemple", project: "Reprise cage d'escalier", status: "Envoye", sentAt: "2026-10-14T09:00:00Z" },
  { quoteNumber: "2026-038", status: "Envoye", sentAt: "2026-10-25T09:00:00Z" },
  { quoteNumber: "2026-037", status: "Signe", signatureStatus: "Signe", signedAt: "2026-10-09T10:00:00Z", projectId: "p37" },
  { quoteNumber: "2026-036", status: "Signe", signedAt: "2026-09-02T10:00:00Z" },
  { quoteNumber: "2026-034", status: "Envoye", sentAt: "2026-09-20T09:00:00Z", validityDays: 30 }
];

describe("lib/devis-liste (PRO-03)", () => {
  it("donne le statut et la dernière action de la maquette", () => {
    assert.deepStrictEqual(D.map((q) => statutDevis(q, AUJ).label), ["Brouillon", "Envoyé", "À relancer", "Envoyé", "Signé", "Signé", "Expiré"]);
    assert.strictEqual(derniereAction(D[0], AUJ), "Modifié à 19 h 42");
    assert.strictEqual(derniereAction(D[1], AUJ), "Envoyé le 27 oct. · vu par le client");
    assert.strictEqual(derniereAction(D[2], AUJ), "Envoyé le 14 oct. · sans réponse");
    assert.strictEqual(derniereAction(D[3], AUJ), "Envoyé le 25 oct.");
    assert.strictEqual(derniereAction(D[4], AUJ, { chantierEnCours: true }), "Signé le 9 oct. · chantier en cours");
    assert.strictEqual(derniereAction(D[5], AUJ), "Signé le 2 sept.");
    assert.strictEqual(derniereAction(D[6], AUJ), "Validité dépassée le 20 oct.");
    assert.strictEqual(finValidite(D[6]), "2026-10-20");
  });

  it("propose l'action de la ligne", () => {
    assert.deepStrictEqual(D.map((q) => actionDevis(q, AUJ).label), ["Reprendre", "Voir", "Relancer", "Voir", "Voir", "Voir", "Dupliquer"]);
    assert.strictEqual(ongletDevis(D[6], AUJ), "termine");
  });

  it("compte les onglets et le badge", () => {
    const c = compterDevis(D, AUJ);
    assert.deepStrictEqual([c.tous, c.brouillon, c.envoye, c.signe, c.termine, c.relancer, c.badge], [7, 1, 3, 2, 1, 1, 1]);
    assert.strictEqual(resumeDevis(c), "7 devis · 3 envoyés en attente · 1 à relancer · 1 brouillon");
    assert.strictEqual(resumeDevis(c, { avecTotal: false }), "3 envoyés · 1 à relancer · 1 brouillon");
  });

  it("une relance repousse la suivante de 7 jours", () => {
    const q = { ...D[2], relances: [{ le: "2026-10-27T09:00:00Z" }] };
    assert.strictEqual(statutDevis(q, AUJ).label, "Envoyé");
    assert.strictEqual(derniereAction(q, AUJ), "Relancé le 27 oct.");
    assert.match(messageRelance(D[2], { entreprise: "ABL Expert Renov" }), /devis 2026-039 \(Reprise cage d'escalier\), envoyé le 14 oct\. Il reste valable jusqu'au 13 nov\./);
  });
});
