import assert from "node:assert/strict";
import { arriveeVers, etapeDe, euros, euros2, lienItineraire, mentionDevis, messagePrix, nettoyerLignes, nomContact, prixValides, suiviClient, totalLignes } from "../../lib/intervention-rapide.js";

// Maquette PRO-17.1 : Mme Lefèvre, fuite sous l'évier, 30 octobre 2026.
describe("Intervention rapide (PRO-17.1)", () => {
  it("prix envoyés par écrit, jamais sans prix", () => {
    const prix = { deplacement: 89, demiHeure: 35 };
    assert.equal(prixValides({}), false);
    assert.equal(messagePrix({ entreprise: "Karim B. Plomberie", prix: {} }), "");
    assert.equal(messagePrix({ entreprise: "Karim B. Plomberie", prix }), "Karim B. Plomberie : déplacement et 1re demi-heure 89 € TTC, puis 35 € la demi-heure. Devis gratuit, signé avant tout travail.");
    assert.match(messagePrix({ entreprise: "K", prix, lien: "https://getkoji.io/intervention/abc" }), /Confirmez ces prix ici : https:\/\/getkoji\.io\/intervention\/abc$/);
    assert.equal(euros(89.5), "89,50 €");
    assert.equal(euros2(101), "101,00 €");
  });

  it("étapes et suivi du client", () => {
    assert.equal(etapeDe({}), "creee");
    assert.equal(etapeDe({ accepteLe: "x" }), "acceptee");
    assert.equal(etapeDe({ accepteLe: "x", enRouteLe: "y" }), "en_route");
    assert.equal(etapeDe({ arriveLe: "z", devis: { signeLe: "s" } }), "devis_signe");
    assert.equal(etapeDe({ termineeLe: "t" }), "terminee");
    assert.equal(suiviClient({ enRouteLe: "y", arriveeVers: "10:42" }), "L'artisan est en route, arrivée vers 10 h 42.");
    assert.equal(arriveeVers(24, "2026-10-30T09:18:00Z"), "10:42");
  });

  it("devis avant travaux en deux blocs", () => {
    const lignes = nettoyerLignes([{ label: "Déplacement et 1re demi-heure", ttc: 89 }, { label: "Joint de raccord et collier", ttc: "12" }, { label: "", ttc: 5 }, { label: "Rien", ttc: 0 }]);
    assert.equal(lignes.length, 2);
    assert.equal(totalLignes(lignes), 101);
    assert.match(mentionDevis("maintenant"), /pas de délai de rétractation/);
    assert.match(mentionDevis("planifier"), /14 jours.*7 jours/);
  });

  it("fiche contact et itinéraire", () => {
    assert.deepEqual(nomContact("Mme Lefèvre"), { firstName: "", lastName: "Mme Lefèvre" });
    assert.deepEqual(nomContact("Claire  Lefèvre"), { firstName: "Claire", lastName: "Lefèvre" });
    assert.equal(lienItineraire("12 rue Exemple, Paris 10e"), "https://www.google.com/maps/dir/?api=1&destination=12%20rue%20Exemple%2C%20Paris%2010e");
  });
});
