const assert = require("assert");
const {
  libelleValidite, libelleAcompte, libelleReglement, soldeDe, libelleTva, nomFichierDevis,
  messageEnvoi, resumePdf, erreurEnvoi, texteSms
} = require("../../lib/devis-envoi");

// Envoyer le devis (maquette PRO-03.2) : mêmes exemples que l'app
// (mobile/test/devis_envoi_test.dart).
describe("envoyer le devis (PRO-03.2)", () => {
  it("écrit les réglages comme la maquette", () => {
    assert.strictEqual(libelleValidite(30, "2026-10-28"), "30 jours · jusqu'au 27 nov.");
    assert.strictEqual(libelleAcompte(30, 5798.54), "30 % · 1 739,56 € TTC");
    assert.strictEqual(libelleAcompte(0, 5798.54), "Sans acompte");
    assert.strictEqual(libelleReglement("Solde — par situations mensuelles, à 30 jours"), "Situation mensuelle, 30 jours");
    assert.strictEqual(libelleReglement("Solde — à la réception des travaux"), "Solde à la réception");
    assert.strictEqual(libelleReglement("Solde — à la livraison du mobilier"), "Solde à la livraison du mobilier");
    assert.strictEqual(soldeDe(""), "à la réception des travaux");
    assert.strictEqual(libelleTva(10), "10 % · mention certifiée par le client");
    assert.strictEqual(libelleTva(5.5), "5,5 % · mention certifiée par le client");
    assert.strictEqual(libelleTva(20), "20 % · taux normal");
  });

  it("nomme le PDF, propose le message et résume le devis", () => {
    assert.strictEqual(nomFichierDevis("2026-041", "Mme Lefèvre"), "Devis_2026-041_Lefèvre.pdf");
    assert.strictEqual(nomFichierDevis("2026-042", ""), "Devis_2026-042.pdf");
    assert.strictEqual(
      messageEnvoi({ client: "Mme Lefèvre", projet: "Salle de bain, Paris 10e", debut: "2026-11-12" }),
      "Bonjour Mme Lefèvre, voici le devis pour « Salle de bain, Paris 10e ». Je reste disponible pour en parler, et je peux démarrer le 12 novembre."
    );
    assert.strictEqual(messageEnvoi({}), "Bonjour, voici le devis. Je reste disponible pour en parler.");
    assert.strictEqual(resumePdf(9, 4), "9 lignes · 4 lots · mentions légales et conditions de paiement");
    assert.strictEqual(resumePdf(1, 1), "1 ligne · 1 lot · mentions légales et conditions de paiement");
  });

  it("vérifie les canaux et prépare le SMS", () => {
    assert.strictEqual(erreurEnvoi({ kojiClient: true, email: true, sms: false, adresse: "s.lefevre@exemple.fr" }), "");
    assert.strictEqual(erreurEnvoi({ kojiClient: false, email: false, sms: false }), "Choisis au moins une façon d'envoyer le devis.");
    assert.strictEqual(erreurEnvoi({ kojiClient: true, email: true, adresse: " " }), "Ajoute l'e-mail du client pour l'envoi par e-mail.");
    assert.strictEqual(erreurEnvoi({ kojiClient: true, email: false, sms: true, telephone: "" }), "Ajoute le téléphone du client pour le SMS.");
    assert.strictEqual(erreurEnvoi({ kojiClient: true, email: false, sms: false }), "Le lien de signature part par e-mail ou par SMS : coche l'un des deux.");
    assert.strictEqual(
      texteSms({ message: "Bonjour, voici le devis.", lien: "https://getkoji.io/s/abc", identifiant: "KJ-4821", motDePasse: "x7Q2", kojiClient: true }),
      "Bonjour, voici le devis.\nLien : https://getkoji.io/s/abc\nIdentifiant : KJ-4821 · Mot de passe : x7Q2"
    );
    assert.strictEqual(texteSms({ message: "Bonjour.", lien: "https://getkoji.io/s/abc", kojiClient: false }), "Bonjour.");
  });
});
