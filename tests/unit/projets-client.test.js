import assert from "node:assert/strict";
import {
  avancementChantier, brouillonUtile, ceQuiVousAttend, comparaison, de, listeProjets, montant,
  projetOffre, proposition, titreBrouillon, titreOffre, villeCourte, NOTE_COMPARAISON, SANS_PROPOSITION
} from "../../lib/projets-client.js";

// Koji Client, projets et propositions (maquette CLI-01).
describe("Koji Client : projets et propositions (CLI-01)", () => {
  const maintenant = "2026-11-18T10:00:00.000Z"; // mercredi
  const offre = {
    id: "radar-1", userId: "cli-1", description: "Refaire la salle de bain", metier: "plombier",
    city: "Paris", postalCode: "75010", ouvrages: [{ room: "Salle de bain", postes: [] }],
    status: "Publiee", createdAt: "2026-11-10T09:00:00.000Z", publishedAt: "2026-11-10T09:00:00.000Z"
  };
  const position = (id, le, plus = {}) => ({
    id: `pos-${id}`, offerId: "radar-1", entrepriseUserId: id, status: "Active", jetons: 3, createdAt: le,
    entrepriseSnapshot: { raisonSociale: id === "e1" ? "ABL Expert Renov" : "Rénov Est" }, ...plus
  });
  const rdv = (id, date, { accepte = true } = {}) => [
    { id: `m-${id}-p`, offerId: "radar-1", entrepriseUserId: id, senderType: "entreprise", kind: "rdv_proposal", rdvDate: date, createdAt: "2026-11-11T08:00:00.000Z" },
    ...(accepte ? [{ id: `m-${id}-r`, offerId: "radar-1", entrepriseUserId: id, senderType: "particulier", kind: "rdv_response", rdvStatus: "accepted", respondsToId: `m-${id}-p`, createdAt: "2026-11-11T09:00:00.000Z" }] : [])
  ];

  it("écrit un montant avec ses centimes, sans espace fine", () => {
    assert.equal(montant(6034.82), "6 034,82 €");
    assert.equal(montant(5650), "5 650,00 €");
    assert.ok(!montant(1234567.8).includes(" "));
  });

  it("fait l'élision devant une voyelle", () => {
    assert.equal(de("ABL Expert Renov"), "d'ABL Expert Renov");
    assert.equal(de("Rénov Est"), "de Rénov Est");
    assert.equal(de("Élec Service"), "d'Élec Service");
  });

  it("lit l'arrondissement dans le code postal", () => {
    assert.equal(villeCourte("Paris", "75010"), "Paris 10e");
    assert.equal(villeCourte("Paris", "75001"), "Paris 1er");
    assert.equal(villeCourte("Lyon", "69003"), "Lyon 3e");
    assert.equal(villeCourte("Marseille", "13008"), "Marseille 8e");
    assert.equal(villeCourte("Montreuil", "93100"), "Montreuil");
  });

  it("titre une demande par ses pièces et sa ville", () => {
    assert.equal(titreOffre(offre), "Salle de bain, Paris 10e");
    assert.equal(titreOffre({ ...offre, ouvrages: [{ room: "Séjour" }, { room: "Couloir" }], city: "Montreuil", postalCode: "93100" }), "Séjour et couloir, Montreuil");
    assert.equal(titreOffre({ ouvrages: [{ room: "Séjour" }, { room: "Couloir" }, { room: "Cuisine" }, { room: "Entrée" }] }), "Séjour, couloir et 2 autres pièces");
    assert.equal(titreOffre({ description: "remplacement du tableau électrique", city: "Lille" }), "Remplacement du tableau électrique, Lille");
    assert.equal(titreOffre({}), "Projet de travaux");
  });

  it("n'affiche un brouillon que s'il contient quelque chose", () => {
    assert.equal(brouillonUtile({ status: "en_cours", data: {} }), false);
    assert.equal(brouillonUtile({ status: "en_cours", data: { photos: ["x"] } }), false);
    assert.equal(brouillonUtile({ status: "en_cours", data: { metier: "électricien" } }), true);
    assert.equal(brouillonUtile({ status: "termine", data: { metier: "électricien" } }), false);
    assert.equal(titreBrouillon({ rooms: ["Séjour", "Couloir"] }), "Séjour et couloir");
    assert.equal(titreBrouillon({ intro: "remplacement tableau électrique" }), "Remplacement tableau électrique");
    assert.equal(titreBrouillon({}), "Nouveau projet");
  });

  it("compte les jours ouvrés d'un chantier en cours", () => {
    // Du mercredi 11 nov. (férié) au vendredi 4 déc. : 17 jours ouvrés ; le 18 nov. est le 5e.
    const devis = { id: "q1", status: "Signe", tasks: [{ startDate: "2026-11-11", endDate: "2026-11-20" }, { startDate: "2026-11-23", endDate: "2026-12-04", done: false }] };
    assert.deepEqual(avancementChantier(devis, maintenant), { etat: "en_cours", texte: "chantier en cours · jour 5 sur 17" });
    assert.equal(avancementChantier({ tasks: [{ startDate: "2026-12-01", endDate: "2026-12-05" }] }, maintenant).texte, "début le 1 déc.");
    assert.equal(avancementChantier({ tasks: [{ startDate: "2026-11-02", endDate: "2026-11-06", done: true }] }, maintenant).etat, "termine");
    assert.equal(avancementChantier({ tasks: [{ startDate: "2026-11-02", endDate: "2026-11-06" }] }, maintenant).texte, "chantier en cours");
    assert.equal(avancementChantier({ finChantier: { receptionLe: "2026-11-14T10:00:00.000Z" }, tasks: [] }, maintenant).texte, "chantier terminé · réceptionné le 14 nov.");
    assert.equal(avancementChantier({ startDate: "2026-12-02", tasks: [] }, maintenant).texte, "début prévu le 2 déc.");
    assert.equal(avancementChantier({ signedAt: "2026-11-03T10:00:00.000Z", tasks: [] }, maintenant).texte, "devis signé le 3 nov.");
  });

  it("décrit une demande selon ses propositions", () => {
    const sans = projetOffre(offre, { maintenant });
    assert.equal(sans.etat, "en_attente");
    assert.equal(sans.detail, "publiée le 10 nov. · en attente de propositions");
    assert.equal(sans.action, "Voir ma demande");
    assert.equal(sans.etiquettePleine, false);

    const positions = [position("e1", "2026-11-11T07:00:00.000Z"), position("e2", "2026-11-12T07:00:00.000Z"), position("e3", "2026-11-12T08:00:00.000Z", { status: "Retiree" })];
    const avec = projetOffre(offre, { positions, messages: rdv("e1", "2026-10-24T08:00:00.000Z"), maintenant });
    assert.equal(avec.etat, "a_choisir");
    assert.equal(avec.etiquette, "À choisir");
    assert.equal(avec.etiquettePleine, true);
    assert.equal(avec.propositions, 2);
    assert.equal(avec.detail, "2 propositions reçues · 1 visite le 24 oct.");
    assert.equal(avec.action, "Comparer");
    assert.equal(avec.lien, "/client/projet/radar-1");

    const expiree = projetOffre(offre, { maintenant: "2026-11-26T10:00:00.000Z" });
    assert.equal(expiree.etat, "expiree");
    assert.equal(expiree.detail, "demande expirée le 25 nov. · aucune proposition");
    assert.equal(expiree.attenue, true);
  });

  it("range les projets : chantiers, demandes, brouillons, puis terminés", () => {
    const devis = [
      { id: "q-fini", status: "Signe", company: { name: "ABL" }, tasks: [{ startDate: "2026-10-01", endDate: "2026-10-05", done: true }] },
      { id: "q-cours", status: "Signe", company: { name: "ABL Expert Renov" }, project: { title: "Salle de bain" }, tasks: [{ startDate: "2026-11-11", endDate: "2026-12-04" }] },
      { id: "q-brouillon", status: "Brouillon" },
      { id: "q-signer", status: "Envoye", totalTtc: 1200, company: { name: "Élec Service" }, signatureUrl: "https://getkoji.io/signature/abc" },
      { id: "q-lie", status: "Envoye", chantierOffreId: "radar-1", totalTtc: 6034.82 },
      { id: "q-annule", status: "Annule", signedAt: "2026-11-01T00:00:00.000Z" }
    ];
    const brouillons = [
      { id: "radar-draft-1", status: "en_cours", data: { intro: "tableau électrique" }, created_at: "2026-11-14T10:00:00.000Z", updated_at: "2026-11-14T10:00:00.000Z" },
      { id: "radar-draft-2", status: "en_cours", data: {}, created_at: "2026-11-15T10:00:00.000Z", updated_at: "2026-11-15T10:00:00.000Z" }
    ];
    const liste = listeProjets({ devis, offres: [offre], brouillons, maintenant });
    assert.deepEqual(liste.map((p) => p.cle), ["chantier:q-cours", "chantier:q-signer", "offre:radar-1", "brouillon:radar-draft-1", "chantier:q-fini"]);
    assert.equal(liste[0].detail, "ABL Expert Renov · chantier en cours · jour 5 sur 17");
    assert.equal(liste[0].principale, true);
    assert.equal(liste[0].lien, "/client/chantier/q-cours");
    assert.equal(liste[1].detail, "Élec Service · devis à signer · 1 200,00 €");
    assert.equal(liste[1].lien, "/client/chantier/q-signer", "signé dans l'espace, pas par le lien");
    assert.equal(liste[3].detail, "brouillon · commencé le 14 nov.");
    assert.equal(liste[3].lien, "/client/radar/new?draftId=radar-draft-1&reprendre=1");
    assert.equal(liste[3].etiquettePleine, false);
    assert.equal(liste[4].attenue, true);
  });

  it("retire la demande quand son devis est signé : c'est le chantier", () => {
    const devis = [{ id: "q1", status: "Signe", chantierOffreId: "radar-1", tasks: [] }];
    assert.deepEqual(listeProjets({ devis, offres: [offre], maintenant }).map((p) => p.cle), ["chantier:q1"]);
  });

  it("liste ce qui attend le client, sans rien inventer", () => {
    const devis = [{ id: "q1", status: "Signe" }, { id: "q2", status: "Envoye", totalTtc: 980, company: { name: "ABL Expert Renov" }, sentAt: "2026-11-16T10:00:00.000Z" }];
    const factures = [
      { id: "f1", quoteId: "q1", type: "Situation 1", status: "Emise", amountTtc: 2515, dueDate: "2026-12-20" },
      { id: "f2", quoteId: "q1", type: "Facture d'acompte", status: "Payee", amountTtc: 1800 },
      { id: "f3", quoteId: "autre", type: "Situation 1", status: "Emise", amountTtc: 999 },
      { id: "f4", quoteId: "q1", type: "Avoir", kind: "avoir", status: "Emise", amountTtc: 100 },
      { id: "f5", quoteId: "q1", type: "Situation 2", status: "Emise", amountTtc: 1000, payments: [{ amount: 400, date: "2026-11-15" }] }
    ];
    const positions = [position("e1", "2026-11-11T07:00:00.000Z"), position("e2", "2026-11-12T07:00:00.000Z")];
    const messages = [...rdv("e1", "2026-11-20T08:00:00.000Z"), ...rdv("e2", "2026-11-12T08:00:00.000Z")];
    assert.deepEqual(ceQuiVousAttend({ devis, offres: [offre], positions, messages, factures, maintenant }), [
      "Situation 1 à payer avant le 20 décembre · 2 515,00 €.",
      "Situation 2 à payer · 600,00 €.",
      "Devis d'ABL Expert Renov à signer · 980,00 €.",
      "Visite confirmée vendredi 20 novembre, 9 h · Salle de bain, Paris 10e."
    ]);
    assert.deepEqual(ceQuiVousAttend({ maintenant }), []);
  });

  it("montre le prix du devis envoyé, sinon l'estimation de l'entreprise, sinon rien", () => {
    const avis = [{ userId: "e1", verifie: true, note: 5 }, { userId: "e1", verifie: true, note: 4 }, { userId: "e1", verifie: false, note: 1 }, { userId: "e2", verifie: true, note: 3 }];
    const business = { siret: "123 456 789 00012", decennaleInsurer: "AXA", decennaleUntil: "2027-06-30" };
    const devis = [
      { id: "q1", userId: "e1", chantierOffreId: "radar-1", status: "Envoye", totalTtc: 6034.82, startDate: "2026-11-12", expectedDuration: "18", signatureUrl: "https://getkoji.io/signature/abc", sentAt: "2026-11-13T10:00:00.000Z" },
      { id: "q0", userId: "e1", chantierOffreId: "radar-1", status: "Brouillon", totalTtc: 1 },
      { id: "qx", userId: "e2", chantierOffreId: "autre", status: "Envoye", totalTtc: 3 }
    ];
    const a = proposition(offre, position("e1", "2026-11-11T07:00:00.000Z", { devisEstimatifTtc: 5900 }), { messages: rdv("e1", "2026-10-24T08:00:00.000Z"), devis, avis, business, maintenant });
    assert.equal(a.nom, "ABL Expert Renov");
    assert.equal(a.prix, "6 034,82 €");
    assert.equal(a.prixNote, "");
    assert.equal(a.avis, "4,5 · 2 avis");
    assert.equal(a.debut, "début possible le 12 nov. · 18 jours");
    assert.equal(a.visite, "visite faite le 24 oct.");
    assert.equal(a.decennale, "vérifiée par Koji");
    assert.equal(a.garanties, "1, 2 et 10 ans");
    assert.deepEqual(a.resume, ["4,5 · 2 avis · début possible le 12 nov. · 18 jours", "visite faite le 24 oct."]);
    assert.deepEqual(a.action, { type: "signer", libelle: "Voir et signer", principale: true, lien: "/client/chantier/q1" });
    assert.equal(a.voir, "Voir la proposition d'ABL Expert Renov");

    const b = proposition(offre, position("e2", "2026-11-12T07:00:00.000Z", { devisEstimatifTtc: 5650 }), { messages: rdv("e2", "2026-11-25T13:30:00.000Z", { accepte: false }), devis, avis: [], business: {}, maintenant });
    assert.equal(b.prix, "5 650,00 €");
    assert.equal(b.prixNote, "estimation avant visite");
    assert.equal(b.avis, "pas encore d'avis");
    assert.equal(b.debut, "à préciser avec l'entreprise");
    assert.equal(b.visite, "1 créneau proposé pour la visite");
    assert.equal(b.decennale, "non renseignée");
    assert.deepEqual(b.resume, ["pas encore d'avis · début à préciser", "1 créneau proposé pour la visite"]);
    assert.deepEqual(b.action, { type: "rdv", libelle: "Prendre rendez-vous", principale: false, lien: "/client/radar/radar-1?entreprise=e2" });
    assert.equal(b.voir, "Voir la proposition de Rénov Est");

    const c = proposition(offre, position("e2", "2026-11-12T07:00:00.000Z"), { messages: rdv("e2", "2026-11-25T13:30:00.000Z"), maintenant });
    assert.equal(c.prix, "à venir");
    assert.equal(c.prixNote, "");
    assert.equal(c.visite, "visite prévue mercredi 25 novembre, 14 h 30");
    assert.equal(c.action.libelle, "Voir la proposition");
  });

  it("classe les propositions par date de réponse", () => {
    const positions = [position("e2", "2026-11-12T07:00:00.000Z"), position("e1", "2026-11-11T07:00:00.000Z")];
    const vue = comparaison(offre, { positions, maintenant });
    assert.deepEqual(vue.propositions.map((p) => p.entrepriseId), ["e1", "e2"]);
    assert.equal(vue.titre, "2 propositions");
    assert.equal(vue.vide, "");
    assert.equal(vue.note, NOTE_COMPARAISON);
    assert.deepEqual(vue.projet, { id: "radar-1", titre: "Salle de bain, Paris 10e", etat: "a_choisir", publieLe: "2026-11-10T09:00:00.000Z" });

    const vide = comparaison(offre, { maintenant });
    assert.equal(vide.titre, "Aucune proposition");
    assert.equal(vide.vide, SANS_PROPOSITION);
    assert.deepEqual(vide.propositions, []);
    assert.equal(comparaison(offre, { positions: [position("e1", "2026-11-11T07:00:00.000Z")], maintenant }).titre, "1 proposition");
  });
});
