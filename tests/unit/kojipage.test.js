import assert from "node:assert/strict";
import {
  COULEURS, contrasteBlanc, offreKojiPage, statutRealisation, photosRealisation, realisationPubliable, compteRealisations,
  lieuArrondi, normaliserPrestation, libellePrix, motsCles, ventesPrestation, controlePrix, fourchetteVentes, completude,
  modificationsNonPubliees, contenuPublie, statsVisites, etatDemande, delaiReponseMoyen, delaiTexte, clientAffiche,
  budgetCompatibilite, budgetDepuisChoix, texteProjet, verifications, vcard, slugModifiable, sectionsDe, compteDemandes
} from "../../lib/kojipage.js";

// Maquettes PRO-13 à 13.5 : ABL Expert Renov, 15 novembre 2026.
const auj = "2026-11-15T10:00:00Z";
const signe = (titre, ttc, signeLe = "2026-09-01", lignes = []) => ({ titre, ttc, signeLe, lignes });

describe("KojiPage (PRO-13)", () => {
  it("palette du bandeau lisible en texte blanc", () => {
    assert.equal(COULEURS.length, 8);
    for (const c of COULEURS) assert.ok(contrasteBlanc(c.hex) >= 7, `${c.nom} ${contrasteBlanc(c.hex)}`);
  });

  it("offre : Start essentielle, Pro complète, Business couleur", () => {
    assert.deepEqual([offreKojiPage({ plan: "start" }).niveau, offreKojiPage({ plan: "start" }).maxPhotos, offreKojiPage({ plan: "start" }).demandes], ["essentielle", 5, false]);
    assert.equal(offreKojiPage({ plan: "trial", addonWebsite: true }).niveau, "complete");
    const pro = offreKojiPage({ plan: "pro" });
    assert.deepEqual([pro.niveau, pro.carte, pro.couleur], ["complete", true, false]);
    assert.equal(offreKojiPage({ plan: "business" }).couleur, true);
    assert.equal(offreKojiPage({ isAdmin: true }).niveau, "business");
  });

  it("réalisations : statuts, ancienne galerie, publiable", () => {
    assert.equal(statutRealisation({}), "publiee");
    assert.equal(statutRealisation({ statut: "brouillon" }), "brouillon");
    assert.deepEqual(photosRealisation({ photos: ["a", "b", "c"] }), { avant: ["a"], apres: ["b", "c"], toutes: ["a", "b", "c"] });
    assert.equal(realisationPubliable({ name: "Salle d'eau", avant: ["a"], apres: [] }), "Ajoutez au moins une photo après.");
    assert.equal(realisationPubliable({ name: "Salle d'eau", avant: ["a"], apres: ["b"] }), "");
    assert.deepEqual(compteRealisations([{}, { statut: "accord_demande" }, { statut: "brouillon" }, {}]), { toutes: 4, publiee: 2, accord_demande: 1, brouillon: 1 });
  });

  it("lieu arrondi à la ville ou à l'arrondissement", () => {
    assert.equal(lieuArrondi({ ville: "Paris", codePostal: "75018" }), "Paris 18e");
    assert.equal(lieuArrondi({ ville: "Paris", codePostal: "75001" }), "Paris 1er");
    assert.equal(lieuArrondi({ ville: "Colombes", codePostal: "92700" }), "Colombes");
    assert.equal(lieuArrondi({ ville: "Lyon", codePostal: "69003" }), "Lyon 3e");
  });

  it("prestations et libellés de prix", () => {
    const p = normaliserPrestation({ nom: " Pose de carrelage ", prixType: "m2", prix: "65" });
    assert.deepEqual([p.nom, p.prix, libellePrix(p)], ["Pose de carrelage", 65, "à partir de 65 € TTC / m²"]);
    assert.equal(libellePrix(normaliserPrestation({ nom: "Cloisons", prixType: "devis", prix: 50 })), "sur devis");
    assert.equal(libellePrix({ prixType: "a_partir", prix: 7800 }), "à partir de 7 800 € TTC");
    assert.deepEqual(motsCles("Rénovation de salle de bain"), ["salle", "bain"]);
  });

  it("contrôle des prix contre les devis signés (maquette onglet Prestations)", () => {
    const devis = [
      signe("Salle de bain Lefèvre", 7950), signe("Salle de bain Caulaincourt", 12400), signe("Peinture séjour", 1650),
      signe("Peinture chambre", 2300), signe("Ancienne salle de bain", 5000, "2025-08-01"),
      signe("Rénovation appartement", 9000, "2026-10-01", [{ texte: "Pose de carrelage sol", unite: "m²", puTtc: 68 }, { texte: "Pose de carrelage mural", unite: "m2", puTtc: 92 }])
    ];
    const sdb = { nom: "Rénovation de salle de bain", prixType: "a_partir", prix: 7800 };
    const vSdb = ventesPrestation(sdb, devis, auj);
    assert.deepEqual(vSdb, [7950, 12400]);
    assert.equal(controlePrix(sdb, vSdb).etat, "coherent");
    assert.equal(fourchetteVentes(controlePrix(sdb, vSdb)), "7 950 à 12 400 €");
    const peinture = { nom: "Peinture d'une pièce", prixType: "a_partir", prix: 1200 };
    const c = controlePrix(peinture, ventesPrestation(peinture, devis, auj));
    assert.equal(c.etat, "a_revoir");
    assert.match(c.message, /1 200 € affiché, vos 2 devis signés commencent à 1 650 €/);
    const carrelage = { nom: "Pose de carrelage", prixType: "m2", prix: 65 };
    const vc = ventesPrestation(carrelage, devis, auj);
    assert.deepEqual(vc, [68, 92]);
    assert.equal(controlePrix(carrelage, vc).etat, "coherent");
    assert.equal(controlePrix({ nom: "Cloisons", prixType: "devis" }, []).etat, "prix_a_ajouter");
    assert.equal(controlePrix({ nom: "Toiture", prixType: "a_partir", prix: 3000 }, []).etat, "sans_vente");
  });

  it("jauge page complète et prochaine action", () => {
    const site = {
      contactPhotoDataUrl: "data:x", presentationText: "Salles de bain", zoneIntervention: "Paris 10e", horaires: "",
      realisations: [{ name: "Salle d'eau", avant: ["a"], apres: ["b"] }],
      prestations: [{ nom: "Salle de bain", prixType: "a_partir", prix: 7800 }, { nom: "Cloisons et faux plafonds", prixType: "devis", prix: 0 }]
    };
    const c = completude(site);
    assert.equal(c.pct, 67);
    assert.equal(c.items.find((i) => i.id === "prix").label, "Prix indicatifs : 1 prestation sur 2");
    assert.equal(c.prochaine, "ajouter le prix de « Cloisons et faux plafonds »");
  });

  it("modifications non publiées", () => {
    const site = { title: "ABL", presentationText: "A", sections: {} };
    assert.equal(modificationsNonPubliees({ ...site, published: true }), 0);
    const publie = contenuPublie(site);
    assert.equal(modificationsNonPubliees({ ...site, publie }), 0);
    assert.equal(modificationsNonPubliees({ ...site, presentationText: "B", horaires: "8 h - 18 h", publie }), 2);
    assert.deepEqual(sectionsDe({ sections: { avis: false } }), { realisations: true, prestations: true, avis: false, formulaire: true, horaires: true });
  });

  it("visites sur 30 jours et évolution", () => {
    const v = { "2026-11-15": 12, "2026-10-20": 400, "2026-10-10": 300, "2026-09-20": 50, "2026-09-01": 80 };
    assert.deepEqual(statsVisites(v, auj), { total: 412, precedent: 350, evolution: 18 });
  });

  it("demandes : état, délai de réponse, coordonnées masquées", () => {
    assert.equal(etatDemande({}), "a_repondre");
    assert.equal(etatDemande({ reponduLe: "x", devisEnvoye: true }), "devis_envoye");
    assert.equal(etatDemande({ declineeLe: "x" }), "declinee");
    const d = [
      { createdAt: "2026-11-14T08:00:00Z", reponduLe: "2026-11-14T10:00:00Z" },
      { createdAt: "2026-11-13T08:00:00Z", reponduLe: "2026-11-13T12:00:00Z" },
      { createdAt: "2026-11-15T08:00:00Z" }
    ];
    assert.equal(delaiReponseMoyen(d, auj), 3);
    assert.equal(delaiTexte(3), "3 h");
    assert.equal(delaiTexte(0.4), "moins d'1 h");
    assert.equal(delaiTexte(60), "3 j");
    assert.deepEqual(compteDemandes(d, auj), { mois: 3, nouvelles: 1 });
    assert.deepEqual(clientAffiche({ name: "Laura Martin", phone: "0600", email: "l@exemple.invalid" }), { nom: "Laura M.", telephone: "", email: "", masque: true });
    assert.equal(clientAffiche({ name: "Laura Martin", phone: "0600", reponduLe: "x" }).telephone, "0600");
  });

  it("budget côté entreprise", () => {
    assert.deepEqual(budgetCompatibilite(9000, 8300), { compatible: true, texte: "budget compatible" });
    assert.deepEqual(budgetCompatibilite(3500, 4200), { compatible: false, budget: 3500, ecart: 700, texte: "budget 3 500 €, 700 € sous votre prix" });
    assert.equal(budgetCompatibilite(0, 4200), null);
    assert.equal(budgetDepuisChoix("8 000 à 12 000 €"), 12000);
    assert.equal(budgetDepuisChoix("Autour de 9 000 €"), 9000);
    assert.equal(budgetDepuisChoix("Je ne sais pas"), 0);
  });

  it("projet de l'assistant en texte", () => {
    assert.equal(texteProjet({ piece: "Salle de bain", surface: 5, travaux: ["Tout refaire", "Douche à la place de la baignoire"], acces: "Étage avec ascenseur", quand: "Dans 1 à 3 mois" }),
      "Pièce : Salle de bain · 5 m²\nTravaux : Tout refaire, Douche à la place de la baignoire\nAccès : Étage avec ascenseur\nQuand : Dans 1 à 3 mois");
  });

  it("vérifications et sceau", () => {
    const b = { siret: "123 456 789 00012", formeJuridique: "SAS", city: "Paris", documents: { decennale: { fileDataUrl: "data:x", expiryDate: "2026-12-31" } } };
    const v = verifications(b, auj);
    assert.equal(v.sceau, true);
    assert.equal(v.items[1].label, "Assurance décennale valable jusqu'au 31/12/2026");
    assert.equal(v.items[3].ok, false);
    assert.equal(verifications({ ...b, documents: { decennale: { fileDataUrl: "x", expiryDate: "2026-01-01" } } }, auj).sceau, false);
  });

  it("fiche contact et adresse modifiable une fois par an", () => {
    const v = vcard({ nom: "ABL Expert Renov", personne: "Bilal A.", fonction: "Dirigeant", telephone: "06 00 00 00 00", url: "https://getkoji.io/site/abl" });
    assert.match(v, /^BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Bilal A\.\r\nORG:ABL Expert Renov\r\nTITLE:Dirigeant/);
    assert.deepEqual(slugModifiable({}, auj), { ok: true, apres: "" });
    assert.deepEqual(slugModifiable({ slugModifieLe: "2026-03-01" }, auj), { ok: false, apres: "2027-03-01" });
  });
});
