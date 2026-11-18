import assert from "node:assert/strict";
import {
  actionsNotification, cleFil, estPourClient, heureBulle, heureFil, heureNotification, libelleJour, parJour, quandDetail
} from "../../lib/notifications-client.js";

// Koji Client · notifications et messages (maquettes CLI-03, CLI-04).
describe("Koji Client : notifications et heures des messages (CLI-03, CLI-04)", () => {
  const maintenant = "2026-11-18T10:00:00.000Z"; // mercredi, 11 h à Paris

  it("ne garde que les notifications du particulier, hors archives", () => {
    assert.equal(estPourClient({ type: "radar.message" }), true);
    assert.equal(estPourClient({ type: "client.devis_pret", accountType: "particulier" }), true);
    assert.equal(estPourClient({ type: "task.completed" }), false);
    assert.equal(estPourClient({ type: "radar.message", archived: true }), false);
  });

  it("range par jour, à l'heure de Paris", () => {
    assert.equal(libelleJour("2026-11-18T06:52:00.000Z", maintenant), "Aujourd'hui");
    assert.equal(libelleJour("2026-11-17T23:30:00.000Z", maintenant), "Aujourd'hui", "00 h 30 à Paris");
    assert.equal(libelleJour("2026-11-17T17:30:00.000Z", maintenant), "Hier");
    assert.equal(libelleJour("2026-11-16T08:00:00.000Z", maintenant), "Cette semaine");
    assert.equal(libelleJour("2026-11-10T08:00:00.000Z", maintenant), "Plus ancien");
    const groupes = parJour([
      { id: "a", createdAt: "2026-11-16T08:00:00.000Z" },
      { id: "b", createdAt: "2026-11-18T08:12:00.000Z" },
      { id: "c", createdAt: "2026-11-17T17:30:00.000Z" },
      { id: "d", createdAt: "2026-11-18T06:52:00.000Z" }
    ], maintenant);
    assert.deepEqual(groupes.map((g) => [g.jour, g.notifications.map((n) => n.id).join("")]), [["Aujourd'hui", "bd"], ["Hier", "c"], ["Cette semaine", "a"]]);
  });

  it("écrit les heures comme la maquette", () => {
    assert.equal(heureNotification("2026-11-18T08:12:00.000Z", maintenant), "09:12");
    assert.equal(heureNotification("2026-11-17T17:30:00.000Z", maintenant), "18:30");
    assert.equal(heureNotification("2026-11-16T08:00:00.000Z", maintenant), "lun.");
    assert.equal(heureNotification("2026-10-28T08:00:00.000Z", maintenant), "28 oct.");
    assert.equal(heureFil("2026-11-18T06:52:00.000Z", maintenant), "07:52");
    assert.equal(heureFil("2026-11-17T17:42:00.000Z", maintenant), "hier");
    assert.equal(heureBulle("2026-11-17T17:42:00.000Z", maintenant), "hier 18:42");
    assert.equal(quandDetail("2026-11-18T08:12:00.000Z", maintenant), "aujourd'hui 09:12");
    assert.equal(heureFil("", maintenant), "");
    assert.equal(heureFil("2025-10-28T08:00:00.000Z", maintenant), "28 oct. 2025");
  });

  it("mène chaque notification vers son action réelle", () => {
    const fils = new Set([cleFil("radar-1", "e1")]);
    const msg = actionsNotification({ type: "radar.message", offerId: "radar-1", entrepriseUserId: "e1" }, fils);
    assert.deepEqual(msg.principale, { libelle: "Lire le message", lien: "/client/messages?fil=radar-1%3Ae1" });
    assert.equal(msg.question, null);
    const pos = actionsNotification({ type: "radar.positionnement", offerId: "radar-1", entrepriseUserId: "e1" }, fils);
    assert.equal(pos.principale.lien, "/client/projet/radar-1");
    assert.equal(pos.question.libelle, "Poser une question à l'entreprise");
    const sansFil = actionsNotification({ type: "radar.positionnement", offerId: "radar-1", entrepriseUserId: "e2" }, fils);
    assert.equal(sansFil.question, null, "pas de fil, pas de bouton « Poser une question »");
    const chantier = actionsNotification({ type: "task.pending_validation", quoteId: "q1" });
    assert.deepEqual(chantier.principale, { libelle: "Voir l'ouvrage à valider", lien: "/client/chantier/q1" });
  });

  it("n'utilise un actionUrl que s'il mène dans l'espace client", () => {
    assert.equal(actionsNotification({ actionUrl: "/client/chantier/q1", actionLabel: "Payer" }).principale.lien, "/client/chantier/q1");
    assert.equal(actionsNotification({ actionUrl: "https://ailleurs.example/x" }).principale.lien, "/client");
    assert.equal(actionsNotification({ actionUrl: "/marketplace/radar-1", offerId: "radar-1" }).principale.lien, "/client/projet/radar-1");
  });
});

describe("Koji Client : profil (CLI-03)", () => {
  it("masque les coordonnées dans la liste", async () => {
    const { ligneCoordonnees, telephoneMasque } = await import("../../lib/profil-client.js");
    assert.equal(telephoneMasque("06 12 34 41 18"), "06 •• •• 41 18");
    assert.equal(telephoneMasque("+33 6 12 34 41 18"), "06 •• •• 41 18");
    assert.equal(telephoneMasque("12"), "");
    assert.equal(ligneCoordonnees({ email: "s.lefevre@exemple.fr", personal: { phone: "0612344118" } }), "06 •• •• 41 18 · s••••@••••.fr");
    assert.equal(ligneCoordonnees({}), "à compléter");
  });

  it("écrit la ligne « Mon logement » avec l'ancienneté déclarée", async () => {
    const { ligneLogement } = await import("../../lib/profil-client.js");
    const personal = { address: "12 rue des Vinaigriers", city: "Paris", postalCode: "75010" };
    assert.equal(ligneLogement({ personal, logement: { plusDeDeuxAns: true } }), "12 rue des Vinaigriers, Paris 10e · plus de 2 ans");
    assert.equal(ligneLogement({ personal, logement: { plusDeDeuxAns: false } }), "12 rue des Vinaigriers, Paris 10e · moins de 2 ans");
    assert.equal(ligneLogement({ personal }), "12 rue des Vinaigriers, Paris 10e");
    assert.equal(ligneLogement({}), "adresse et ancienneté à préciser");
  });
});

describe("Koji Client : aide (CLI-06)", () => {
  it("quatre thèmes, aucune mention d'un prix recommandé", async () => {
    const { THEMES_AIDE } = await import("../../lib/aide-client.js");
    assert.deepEqual(THEMES_AIDE.map((t) => t.titre), ["Mon devis", "Le chantier", "Paiements", "Mon compte"]);
    assert.ok(!JSON.stringify(THEMES_AIDE).toLowerCase().includes("recommandé"));
    assert.ok(!JSON.stringify(THEMES_AIDE).includes("aide@"));
  });

  it("filtre la FAQ sur la question tapée, sans accents ni mots vides", async () => {
    const { chercherAide } = await import("../../lib/aide-client.js");
    assert.deepEqual(chercherAide("puis-je annuler après avoir signé ?").map((r) => r.question), ["Puis-je changer d'avis après avoir signé ?"]);
    assert.ok(chercherAide("retenue").some((r) => r.question === "Qu'est-ce que la retenue de garantie ?"));
    assert.ok(chercherAide("PHOTOS").some((r) => r.question === "Qui voit mes photos ?"));
    assert.deepEqual(chercherAide("  "), []);
    assert.deepEqual(chercherAide("zzzz"), []);
  });
});
