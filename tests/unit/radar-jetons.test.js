const assert = require("assert");
const {
  palierJetons, jetonsPourMontant, etatPosition, soldeJetons, creneauxProposes, creneauCourt, creneauLong, messagePositionnement, offreExpiree, placesPrises
} = require("../../lib/radar-jetons");

// Jetons et positions du Radar (maquette PRO-04, barème de la page Tarifs).
const OFFRE = { id: "radar-1", status: "Publiee", publishedAt: "2026-11-10T09:00:00Z" };
const pos = (extra = {}) => ({ id: "p1", offerId: "radar-1", entrepriseUserId: "e1", status: "Active", jetons: 3, createdAt: "2026-11-12T10:42:00Z", ...extra });
const proposition = { id: "m1", offerId: "radar-1", entrepriseUserId: "e1", senderType: "entreprise", kind: "rdv_proposal", rdvDate: "2026-11-17T13:00:00Z", createdAt: "2026-11-12T10:42:00Z" };
const accepte = { id: "m2", offerId: "radar-1", entrepriseUserId: "e1", senderType: "particulier", kind: "rdv_response", respondsToId: "m1", rdvStatus: "accepted", createdAt: "2026-11-13T08:00:00Z" };

describe("jetons du Radar (PRO-04)", () => {
  it("applique le barème de la page Tarifs", () => {
    assert.strictEqual(jetonsPourMontant(1200), 1);
    assert.strictEqual(jetonsPourMontant(6000), 3);
    assert.strictEqual(jetonsPourMontant(8000), 3);
    assert.strictEqual(jetonsPourMontant(13500), 6);
    assert.strictEqual(jetonsPourMontant(0), 3);
    assert.strictEqual(palierJetons("trial"), "start");
    assert.strictEqual(palierJetons("active"), "pro");
    assert.strictEqual(palierJetons("business"), "business");
    assert.strictEqual(palierJetons("trial", true), "business");
  });

  it("réserve, débite au rendez-vous confirmé, rend sinon", () => {
    const attente = etatPosition(pos(), { offre: OFFRE, messages: [proposition], maintenant: "2026-11-14T10:00:00Z" });
    assert.strictEqual(attente.etat, "attente");
    assert.strictEqual(attente.jetons.texte, "3 jetons réservés · rendus le 19 nov. sans réponse");
    const rdv = etatPosition(pos(), { offre: OFFRE, messages: [proposition, accepte], maintenant: "2026-11-14T10:00:00Z" });
    assert.strictEqual(rdv.etat, "rdv");
    assert.strictEqual(rdv.etape, "Visite confirmée mar. 17 nov. 14 h");
    assert.strictEqual(rdv.jetons.texte, "3 jetons débités");
    const sansReponse = etatPosition(pos(), { offre: OFFRE, messages: [proposition], maintenant: "2026-11-19T11:00:00Z" });
    assert.strictEqual(sansReponse.etat, "expiree");
    assert.strictEqual(sansReponse.etape, "Expirée · aucune réponse du client");
    assert.strictEqual(sansReponse.jetons.etat, "rendus");
    const retiree = etatPosition(pos(), { offre: { ...OFFRE, status: "Retiree" }, messages: [proposition] });
    assert.strictEqual(retiree.etape, "Le client a retiré sa demande");
    const autre = etatPosition(pos(), { offre: { ...OFFRE, attribueeA: "e2" }, messages: [proposition] });
    assert.strictEqual(autre.libelle, "Non retenu");
    assert.strictEqual(etatPosition(pos({ status: "Retiree" }), { offre: OFFRE }).jetons.etat, "rendus");
  });

  it("calcule le solde : inclus du mois, achats, réservés", () => {
    const positions = [
      { jetons: { n: 3, etat: "reserves" } },
      { jetons: { n: 6, etat: "debites", le: "2026-11-13T08:00:00Z" } },
      { jetons: { n: 1, etat: "rendus" } }
    ];
    const s = soldeJetons({ palier: "business", positions, achats: [{ quantite: 20 }], maintenant: "2026-11-14T10:00:00Z" });
    assert.deepStrictEqual([s.inclus, s.achetes, s.reserves, s.debitesMois, s.solde], [10, 20, 3, 6, 21]);
    assert.strictEqual(soldeJetons({ palier: "start", positions: [] }).solde, 0);
    // Débit d'un mois passé au-delà des inclus : pris sur les achats.
    const avant = soldeJetons({ palier: "pro", positions: [{ jetons: { n: 6, etat: "debites", le: "2026-10-20T08:00:00Z" } }], achats: [{ quantite: 10 }], maintenant: "2026-11-14T10:00:00Z" });
    assert.strictEqual(avant.solde, 3 + 7);
  });

  it("propose des créneaux libres et un message, compte les places", () => {
    const creneaux = creneauxProposes([{ startAt: "2026-11-17T13:00:00Z", endAt: "2026-11-17T14:00:00Z" }], "2026-11-16T09:00:00Z");
    assert.deepStrictEqual(creneaux.map(creneauCourt), ["mer. 18 nov. 14 h", "jeu. 19 nov. 8 h 30", "ven. 20 nov. 17 h", "sam. 21 nov. 10 h"]);
    assert.strictEqual(creneauLong("2026-11-17T13:00:00Z"), "mardi 17 novembre, 14 h");
    assert.strictEqual(messagePositionnement({ prenom: "Bilal", entreprise: "ABL Expert Renov", metier: "Salle de bain", ville: "Paris 10e" }),
      "Bonjour, je suis Bilal, d'ABL Expert Renov. Nous réalisons régulièrement des travaux de salle de bain à Paris 10e. Je vous propose une visite pour valider l'accès et l'état de l'existant, puis un devis détaillé sous 48 h.");
    assert.strictEqual(offreExpiree(OFFRE, "2026-11-25T09:00:00Z"), true);
    const db = { chantierPositionnements: [pos(), pos({ id: "p2", entrepriseUserId: "e2" }), pos({ id: "p3", entrepriseUserId: "e3", status: "Retiree" })], chantierOffreMessages: [proposition] };
    assert.strictEqual(placesPrises(db, OFFRE, "2026-11-14T10:00:00Z"), 2);
  });
});
