import assert from "node:assert/strict";
import {
  actesExperience, cumulNiveau, devisSigneConstate, distinctionsValides, etatParcours, experience, GRADES, hautsFaits,
  niveauDe, plaqueParticulier, preuves, serieTresorerie
} from "../../lib/parcours-grade.js";

// Maquette PRO-26 : Compagnon, niveau 14 · 1 120 / 1 400, Chef d'équipe au niveau 21.
describe("Mon parcours v2 : grade et niveaux (PRO-26)", () => {
  it("niveau n → n+1 = 100 × n points ; grades de la maquette", () => {
    assert.equal(cumulNiveau(1), 0);
    assert.equal(cumulNiveau(2), 100);
    assert.equal(cumulNiveau(14), 9100);
    const n = niveauDe(9100 + 1120);
    assert.equal(n.niveau, 14);
    assert.equal(n.dansNiveau, 1120);
    assert.equal(n.requis, 1400);
    assert.equal(n.pourcent, 80);
    assert.equal(n.grade.label, "Compagnon");
    assert.deepEqual(n.prochainGrade, { id: "chef-equipe", label: "Chef d'équipe", niveau: 21 });
    assert.equal(niveauDe(0).niveau, 1);
    assert.equal(niveauDe(0).grade.label, "Apprenti");
    assert.equal(niveauDe(99).niveau, 1);
    assert.equal(niveauDe(100).niveau, 2);
    assert.equal(niveauDe(-500).xp, 0);
    const max = niveauDe(10_000_000);
    assert.equal(max.niveau, 50);
    assert.equal(max.grade.label, "Bâtisseur");
    assert.equal(max.prochainGrade, null);
    assert.deepEqual(GRADES.map((g) => [g.de, g.a]), [[1, 5], [6, 12], [13, 20], [21, 30], [31, 40], [41, 49], [50, 50]]);
  });

  it("devis signé constaté : signature du client, pas un accord noté à la main ni un devis rétracté", () => {
    assert.equal(devisSigneConstate({ status: "Signe", signatureProvider: "sur-place" }), true);
    assert.equal(devisSigneConstate({ signatureStatus: "Signe", status: "accepte" }), true);
    assert.equal(devisSigneConstate({ status: "Signe", signatureProvider: "manuel" }), false);
    assert.equal(devisSigneConstate({ status: "Signe", retracteLe: "2026-11-10" }), false);
    assert.equal(devisSigneConstate({ status: "Envoye" }), false);
  });
});

describe("Mon parcours v2 : expérience constatée", () => {
  const offres = [
    { id: "o1", publishedAt: "2026-11-03T08:00:00Z", lat: 48.85, lon: 2.35 },
    { id: "o2", publishedAt: "2026-11-04T08:00:00Z", lat: 48.86, lon: 2.36 },
    { id: "o3", publishedAt: "2026-11-05T08:00:00Z", lat: 45.76, lon: 4.83 }
  ];
  const donnees = {
    quotes: [
      { id: "q1", status: "Signe", signedAt: "2026-11-02T10:00:00Z", projectId: "c1", chantierOffreId: "o1", items: [{ room: "Salle de bain" }] },
      { id: "q2", status: "Signe", signedAt: "2026-11-06T10:00:00Z", projectId: "c2", chantierOffreId: "o2" },
      { id: "q3", status: "Signe", signedAt: "2026-10-06T10:00:00Z", signatureProvider: "manuel", projectId: "c3" },
      { id: "q4", status: "Annule", signedAt: "2026-11-07T10:00:00Z", retracteLe: "2026-11-08", projectId: "c4" }
    ],
    clotures: [{ projectId: "c1", pv: { signeLe: "2026-11-10T15:00:00Z", reserves: [] } }],
    avis: [
      { id: "a1", verifie: true, note: 5, creeLe: "2026-11-12T10:00:00Z" },
      { id: "a2", verifie: true, note: 2, creeLe: "2026-11-13T10:00:00Z" },
      { id: "a3", verifie: false, note: 5, creeLe: "2026-11-14T10:00:00Z" }
    ],
    positions: [
      { offerId: "o1", createdAt: "2026-11-03T08:40:00Z" },
      { offerId: "o2", createdAt: "2026-11-04T09:30:00Z" },
      { offerId: "o3", createdAt: "2026-11-05T11:00:00Z" }
    ],
    offres,
    photos: [
      ...Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, projectId: "c1", takenAt: `2026-11-0${(i % 9) + 1}T12:00:00Z` })),
      { id: "px", projectId: "c3", takenAt: "2026-11-05T12:00:00Z" }
    ]
  };

  it("actes comptés, photos plafonnées à 10 par chantier signé", () => {
    const actes = actesExperience(donnees);
    const n = (type) => actes.filter((a) => a.type === type).length;
    assert.equal(n("devisSigne"), 2);
    assert.equal(n("pv"), 1);
    assert.equal(n("avis"), 1);
    assert.equal(n("avisBas"), 1);
    assert.equal(n("radar"), 2);
    assert.equal(n("photo"), 10);
    const xp = experience(actes, "2026-11-19T10:00:00Z");
    assert.equal(xp.total, 2 * 50 + 150 + 40 - 40 + 2 * 10 + 10 * 5);
    assert.deepEqual(xp.ceMois.find((l) => l.type === "devisSigne"), { type: "devisSigne", label: "Devis signés", nombre: 2, xp: 100 });
    assert.equal(xp.ceMois.find((l) => l.type === "pv").label, "Chantier livré avec PV");
    assert.equal(xp.totalMois, xp.total);
    assert.equal(experience(actes, "2026-12-02T10:00:00Z").ceMois.length, 0);
  });

  it("l'expérience ne descend jamais sous zéro", () => {
    assert.equal(experience([{ type: "avisBas", xp: -40, le: "2026-11-01" }]).total, 0);
  });

  it("hauts faits : progression, dates, mesurables ou non", () => {
    const h = Object.fromEntries(hautsFaits({ ...donnees, inscritLe: "2025-11-02T09:00:00Z", ouvrages: 50 }, "2026-11-19T10:00:00Z").map((x) => [x.id, x]));
    assert.equal(h["premier-coup-de-pelle"].obtenu, true);
    assert.equal(h["premier-coup-de-pelle"].obtenuLe, "2026-11-02");
    assert.equal(h["cle-en-main"].obtenuLe, "2026-11-10");
    assert.equal(h["chantier-propre"].pourcent, 10);
    assert.equal(h["fil-a-plomb"].pourcent, 2);
    assert.equal(h["dix-sur-dix"].pourcent, 10);
    assert.equal(h["pas-une-minute"].valeur, 1);
    assert.equal(h["bon-voisinage"].valeur, 1);
    assert.equal(h["specialiste-salle-de-bain"].valeur, 1);
    assert.equal(h["bibliotheque-complete"].pourcent, 25);
    assert.equal(h["bibliotheque-complete"].public, false);
    assert.equal(h["parole-tenue"].mesurable, false);
    assert.equal(h["parole-tenue"].atteignable, false);
    assert.equal(h.pionnier.obtenu, true);
    assert.equal(h.fidele.obtenu, true);
    assert.equal(h.fidele.obtenuLe, "2026-11-02");
    const tard = Object.fromEntries(hautsFaits({ inscritLe: "2027-03-01" }, "2027-09-01T10:00:00Z").map((x) => [x.id, x]));
    assert.equal(tard.pionnier.atteignable, false);
    assert.equal(tard.fidele.pourcent, 50);
  });

  it("compagnons actifs sur un mois, sans les sous-traitants", () => {
    const workers = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `w${i}`, type: i === 6 ? "Sous-traitant" : "Salarié" }));
    const attendance = [
      ...[1, 2, 3, 4].map((i) => ({ workerId: `w${i}`, date: "2026-10-0" + i })),
      { workerId: "w6", date: "2026-10-09" },
      ...[1, 2, 3, 4, 5].map((i) => ({ workerId: `w${i}`, date: `2026-11-1${i}` }))
    ];
    const h = hautsFaits({ workers, attendance }, "2026-11-19T10:00:00Z").find((x) => x.id === "compagnons-d-abord");
    assert.equal(h.obtenu, true);
    assert.equal(h.obtenuLe, "2026-11-15");
  });

  it("trésorerie : mois consécutifs payés à l'échéance", () => {
    const f = (mois, payeLe) => ({ amountTtc: 100, status: "Payee", dueDate: `2026-${mois}-15`, payments: [{ amount: 100, date: payeLe }] });
    const s = serieTresorerie([f("01", "2026-01-10"), f("02", "2026-02-20"), f("03", "2026-03-15"), f("05", "2026-05-01")], "2026-11-19");
    assert.equal(s.valeur, 2);
    assert.equal(serieTresorerie([{ amountTtc: 100, status: "Emise", dueDate: "2026-12-01" }], "2026-11-19").valeur, 0);
  });
});

describe("Mon parcours v2 : côté particulier", () => {
  const faits = [
    { id: "dix-sur-dix", titre: "Dix sur dix", public: true, obtenu: true },
    { id: "pas-une-minute", titre: "Pas une minute", public: true, obtenu: true },
    { id: "specialiste-salle-de-bain", titre: "Spécialiste salle de bain", public: true, obtenu: true },
    { id: "bibliotheque-complete", titre: "Bibliothèque complète", public: false, obtenu: true },
    { id: "fil-a-plomb", titre: "Fil à plomb", public: true, obtenu: false }
  ];

  it("trois distinctions au plus, publiques et obtenues", () => {
    assert.deepEqual(distinctionsValides(["bibliotheque-complete", "fil-a-plomb", "dix-sur-dix", "dix-sur-dix", "pas-une-minute", "specialiste-salle-de-bain"], faits), ["dix-sur-dix", "pas-une-minute", "specialiste-salle-de-bain"]);
    assert.deepEqual(distinctionsValides("x", faits), []);
  });

  it("plaque : grade à partir de Compagnon, preuves, distinctions ; jamais de niveau ni de points", () => {
    const p = { chantiersLivres: 14, avisVerifies: 11, noteMoyenne: 4.8 };
    const plaque = plaqueParticulier({ niveau: niveauDe(10220), preuves: p, faits, distinctions: ["dix-sur-dix", "specialiste-salle-de-bain", "pas-une-minute"] });
    assert.deepEqual(plaque, { grade: "Compagnon", preuves: ["14 chantiers livrés avec PV", "11 avis vérifiés · 4,8 / 5"], distinctions: ["Dix sur dix", "Spécialiste salle de bain", "Pas une minute"] });
    assert.equal(plaqueParticulier({ niveau: niveauDe(500), preuves: p, faits }).grade, "");
    assert.deepEqual(plaqueParticulier({ niveau: niveauDe(500), preuves: { chantiersLivres: 1, avisVerifies: 2, noteMoyenne: 5 }, faits, avecAvis: false }).preuves, ["1 chantier livré avec PV"]);
    assert.equal(JSON.stringify(plaque).includes("niveau"), false);
  });

  it("état complet : compteurs, preuves, talents et plaque", () => {
    const e = etatParcours({ quotes: [{ id: "q", status: "Signe", signedAt: "2026-11-02T10:00:00Z" }], inscritLe: "2026-11-01" }, { distinctions: ["premier-coup-de-pelle", "bibliotheque-complete"], talents: { vitrine: 1 } }, "2026-11-19T10:00:00Z");
    assert.equal(e.niveau.niveau, 1);
    assert.equal(e.preuves.devisSignes, 1);
    assert.deepEqual(e.distinctions, ["premier-coup-de-pelle"]);
    assert.equal(e.talents.points, 1);
    assert.equal(e.plaqueActive, true);
    assert.equal(e.compteurs.tous, 14);
    assert.ok(e.compteurs.obtenus >= 2);
    assert.equal(preuves({}, []).chantiersLivres, 0);
  });
});
