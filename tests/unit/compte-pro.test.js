import assert from "node:assert/strict";
import {
  masquerSiren, sirenDe, regimeTva, mentionRegime, conditionsDefaut, mentionMediateur, mentionsObligatoires, etapesProfil,
  disponibilitesDe, libelleJours, libelleDisponibilite, jourDeVisite, documentsExpirant, prefsDefaut, normaliserPrefs, evenementDe,
  enSilence, decisionEmail, reglagesLangue, traductionActive, chiffresConserves, joursRestants, prochainNumero, langueDe
} from "../../lib/compte-pro.js";

// Maquettes PRO-15 à 15.6 : ABL Expert Renov.
const business = {
  raisonSociale: "ABL Expert Renov", siren: "992123651", addressLine1: "12 rue des Vinaigriers", zoneAddress: "Paris 10e", dailyRate: 400,
  documents: { decennale: { fileDataUrl: "data:x", insurer: "MIC Insurance", expiryDate: "2026-12-31" } }
};

describe("Profil et compte (PRO-15)", () => {
  it("SIREN masqué", () => {
    assert.equal(masquerSiren("992 123 651"), "992 ••• 651");
    assert.equal(sirenDe({ siret: "99212365100012" }), "992123651");
  });

  it("six étapes : il reste l'IBAN et le médiateur", () => {
    const e = etapesProfil(business, { professions: ["Peinture"] });
    assert.deepEqual([e.faites, e.total, e.pct], [4, 6, 67]);
    assert.equal(e.reste, "Il reste l'IBAN et le médiateur.");
    assert.equal(e.suivante.id, "iban");
    assert.equal(etapesProfil({ ...business, iban: "FR76 1", mediateur: { nom: "CM2C" } }, { professions: ["Peinture"] }).reste, "Profil complet.");
  });

  it("régime de TVA et conditions par défaut", () => {
    assert.equal(regimeTva({}), "encaissements");
    assert.equal(mentionRegime("franchise"), "TVA non applicable, art. 293 B du CGI.");
    assert.equal(mentionRegime("encaissements"), "");
    assert.deepEqual(conditionsDefaut({}), { validiteJours: 30, acomptePct: 30, paiementJours: 30 });
    assert.deepEqual(conditionsDefaut({ devisDefauts: { validiteJours: 60, acomptePct: 40, paiementJours: 999 } }), { validiteJours: 60, acomptePct: 40, paiementJours: 30 });
  });

  it("mentions obligatoires : médiateur à désigner", () => {
    const m = Object.fromEntries(mentionsObligatoires(business).map((x) => [x.id, x]));
    assert.equal(m.decennale.ok, true);
    assert.equal(m.mediateur.ok, false);
    assert.equal(m.identite.manque, "numéro de TVA intracommunautaire à renseigner");
    assert.equal(mentionsObligatoires({ ...business, regimeTva: "franchise" })[0].ok, true);
    assert.equal(mentionMediateur({ mediateur: { nom: "CM2C", site: "cm2c.net" } }), "Médiateur de la consommation : CM2C, cm2c.net.");
  });

  it("disponibilités comme la maquette", () => {
    const d = disponibilitesDe({});
    assert.equal(libelleDisponibilite(d.chantiers), "lun. – ven. · 8 h – 17 h");
    assert.equal(libelleDisponibilite(d.visites), "mar., jeu. · 14 h – 18 h");
    assert.equal(libelleJours(["sam", "lun"]), "lun., sam.");
    assert.equal(jourDeVisite({}, "2026-11-17"), true); // mardi
    assert.equal(jourDeVisite({}, "2026-11-18"), false);
    assert.equal(jourDeVisite({ disponibilites: { fermeture: { du: "2026-12-21", au: "2027-01-03" } } }, "2026-12-22"), false);
  });

  it("documents qui expirent dans les 30 jours", () => {
    assert.deepEqual(documentsExpirant(business, "2026-11-16"), []);
    assert.deepEqual(documentsExpirant(business, "2026-12-10").map((x) => [x.id, x.jours]), [["decennale", 21]]);
    assert.equal(documentsExpirant({ qualifications: [{ nom: "RGE Qualibat", type: "rge", jusqua: "2026-11-20" }] }, "2026-11-16")[0].jours, 4);
  });

  it("notifications : réglages, silence, e-mail", () => {
    const p = prefsDefaut();
    assert.equal(p.evenements.devis_signe.email, true);
    assert.equal(normaliserPrefs({ evenements: { devis_signe: { email: false, sms: true } } }).evenements.devis_signe.sms, false);
    assert.equal(evenementDe("quote.signed"), "devis_signe");
    assert.equal(evenementDe("site.lead"), "message_client");
    assert.equal(evenementDe("livraison"), "");
    assert.equal(enSilence("2026-11-16T10:00:00Z"), false); // lundi 11 h à Paris
    assert.equal(enSilence("2026-11-16T19:30:00Z"), true); // 20 h 30 à Paris
    assert.equal(enSilence("2026-11-15T10:00:00Z"), true); // dimanche
    assert.equal(decisionEmail(p, "quote.signed", "2026-11-16T10:00:00Z"), "envoyer");
    assert.equal(decisionEmail(p, "quote.signed", "2026-11-15T10:00:00Z"), "differer");
    assert.equal(decisionEmail({ ...p, silence: false }, "quote.signed", "2026-11-15T10:00:00Z"), "envoyer");
    assert.equal(decisionEmail({ evenements: { devis_signe: { email: false } } }, "quote.signed"), "");
    assert.equal(decisionEmail(p, "livraison"), "");
  });

  it("langues et traduction", () => {
    assert.equal(traductionActive({}), false);
    assert.deepEqual(reglagesLangue({ langue: "pt", original: true }), { langue: "pt", entrant: true, sortant: true, apercu: true, original: true, chiffres: "latins" });
    assert.equal(reglagesLangue({ langue: "xx" }).langue, "fr");
    assert.equal(langueDe("ar").rtl, true);
    assert.equal(chiffresConserves("Je commence lundi 16 à 8 h, 3 192,75 €", "Começo segunda 16 às 8 h, 3 192,75 €"), true);
    assert.equal(chiffresConserves("lundi 16", "segunda 17"), false);
  });

  it("éléments supprimés et prochaine facture", () => {
    assert.equal(joursRestants("2026-10-28T10:00:00Z", "2026-10-31T10:00:00Z"), 27);
    assert.equal(joursRestants("2026-09-01T10:00:00Z", "2026-10-31T10:00:00Z"), 0);
    assert.equal(prochainNumero("FAC-2026-0121", 2026), "FAC-2026-0122");
    assert.equal(prochainNumero("FAC-2025-0300", 2026), "FAC-2026-0001");
  });
});
