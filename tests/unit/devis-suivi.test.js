const assert = require("assert");
const { quandParis, quandRelatif, prochaineRelance, retractationJusquau, etapesSuivi, noteSuivi, conditionsEnvoyees, versionDevis } = require("../../lib/devis-suivi");

// Après l'envoi (maquette PRO-03.3) : mêmes exemples que l'app
// (mobile/test/devis_suivi_test.dart). Heures de Paris (UTC+1 en hiver).
const envoye = {
  id: "q41", quoteNumber: "2026-041", status: "Envoye", signatureStatus: "En attente", clientType: "particulier",
  sentAt: "2026-10-28T18:50:00Z", viewedAt: "2026-10-28T20:12:00Z", validityDays: 30, vatRate: 10, totalTtc: 5798.54,
  paymentMilestones: [{ label: "Acompte à la signature", percent: 30 }, { label: "Solde — par situations mensuelles, à 30 jours", percent: 70 }],
  envoi: { kojiClient: true, email: true, sms: false },
  versions: [{ number: "001", sentAt: "2026-10-26T10:00:00Z" }, { number: "002", sentAt: "2026-10-28T18:50:00Z" }]
};
const signe = { ...envoye, status: "Signe", signatureStatus: "Signe", signatureProvider: "koji-signature", signedAt: "2026-10-30T08:04:00Z" };

describe("après l'envoi (PRO-03.3)", () => {
  it("écrit les dates et heures de Paris", () => {
    assert.strictEqual(quandParis("2026-10-28T18:50:00Z"), "28 oct., 19 h 50");
    assert.strictEqual(quandRelatif("2026-10-28T20:12:00Z", "2026-10-29"), "hier à 21 h 12");
    assert.strictEqual(quandRelatif("2026-10-28T20:12:00Z", "2026-10-28"), "aujourd'hui à 21 h 12");
    assert.strictEqual(quandRelatif("2026-10-28T20:12:00Z", "2026-11-02"), "le 28 oct. à 21 h 12");
  });

  it("suit l'envoi : vu, signature en attente, relance conseillée", () => {
    assert.strictEqual(prochaineRelance(envoye), "2026-11-04");
    assert.deepStrictEqual(etapesSuivi(envoye, { aujourdhui: "2026-10-29" }).map((e) => [e.label, e.etat, e.detail]), [
      ["Envoyé", "done", "28 oct., 19 h 50"],
      ["Vu par le client", "done", "28 oct., 21 h 12"],
      ["Signature en attente", "now", "valable jusqu'au 27 nov. · relance conseillée le 4 nov."],
      ["Chantier lancé", "todo", ""]
    ]);
    assert.strictEqual(etapesSuivi(envoye, { aujourdhui: "2026-11-05" })[2].detail, "valable jusqu'au 27 nov. · à relancer");
    assert.strictEqual(etapesSuivi(envoye, { aujourdhui: "2026-11-30" })[2].detail, "validité dépassée le 27 nov.");
    assert.strictEqual(noteSuivi(envoye, { aujourdhui: "2026-10-29" }), "Ouvert par le client hier à 21 h 12. Aucune question posée.");
    assert.strictEqual(noteSuivi({ ...envoye, viewedAt: "" }, { aujourdhui: "2026-10-29", messages: 2 }), "Pas encore ouvert par le client. 2 messages du client.");
  });

  it("suit la signature et le lancement du chantier", () => {
    assert.strictEqual(retractationJusquau(signe), "2026-11-13");
    assert.strictEqual(retractationJusquau({ ...signe, clientType: "societe" }), "");
    assert.strictEqual(retractationJusquau({ ...signe, signatureProvider: "manuel" }), "");
    const etapes = etapesSuivi(signe, { aujourdhui: "2026-10-31" });
    assert.deepStrictEqual(etapes.slice(2).map((e) => [e.label, e.etat, e.detail]), [["Signé", "done", "30 oct., 9 h 04 · en ligne"], ["Chantier lancé", "now", ""]]);
    assert.strictEqual(etapesSuivi(signe, { chantierLance: true })[3].etat, "done");
    assert.strictEqual(etapesSuivi({ ...signe, mentionTva: true })[2].detail, "30 oct., 9 h 04 · en ligne, mention TVA certifiée");
    assert.strictEqual(noteSuivi(signe), "Signé en ligne le 30 oct. Rétractation possible jusqu'au 13 nov.");
    assert.strictEqual(noteSuivi({ ...signe, mentionTva: true }), "Signé en ligne le 30 oct. Mention TVA 10 % certifiée. Rétractation possible jusqu'au 13 nov.");
    assert.strictEqual(noteSuivi({ ...signe, signatureProvider: "manuel", acceptanceReason: "acompte" }), "Accord noté le 30 oct.");
  });

  it("rappelle les conditions envoyées et la version", () => {
    assert.deepStrictEqual(conditionsEnvoyees(envoye), [
      ["Validité", "30 jours, jusqu'au 27 nov."],
      ["Acompte", "30 % à la signature · 1 739,56 € TTC"],
      ["Règlement", "Situation mensuelle, 30 jours"],
      ["TVA", "10 %, mention certifiée à la signature"],
      ["Canaux", "Koji Client, e-mail"]
    ]);
    assert.deepStrictEqual(conditionsEnvoyees({ ...envoye, vatRate: 20, paymentMilestones: [], envoi: null }).map((l) => l[1]).slice(1), ["Sans acompte", "Solde à la réception", "20 %"]);
    assert.deepStrictEqual(versionDevis(envoye), { titre: "2 · envoyée le 28 oct.", detail: "Lecture seule · v1 du 26 oct. remplacée" });
    assert.deepStrictEqual(versionDevis({ ...envoye, versions: [] }), { titre: "1 · envoyée le 28 oct.", detail: "Lecture seule" });
  });
});
