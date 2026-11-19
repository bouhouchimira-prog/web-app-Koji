import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  accepter, actionsClient, avancer, candidats, CATEGORIES, categorieAutorisee, chiffresDuJour, clientCourt, detailsUrgence, dispoActive,
  etapesSuivi, etatClient, finDispo, fourchette, heureParDefaut, initiales, minutesTrajet, nettoyerReglages, nettoyerReponses, nomCourt, NOTE_PRO, NUMERO_GAZ,
  propositionActive, quandListe, quartierDe, refuser, relancer, retirer, sansExif, statutListe, textePrix, titreUrgence
} from "../../lib/urgences.js";

// Maquette PRO-17 : Mme Lefèvre, fuite sous l'évier, Paris 10e, 30 octobre 2026.
const T0 = "2026-10-30T09:16:00.000Z"; // 10:16 à Paris
const plus = (s) => new Date(Date.parse(T0) + s * 1000).toISOString();
const ZONE = { lat: 48.872, lon: 2.36, rayonKm: 8 };
const pro = (lat, lon, prix = 89, extra = {}) => ({ actif: true, jusqua: "2026-10-30T19:00:00.000Z", zone: { ...ZONE, lat, lon }, prix: { fuite: prix }, demiHeure: 35, ...extra });
const urgence = (extra = {}) => ({ id: "u1", clientId: "c1", categorie: "fuite", reponses: { ou: "Sous l'évier", coupee: "Oui" }, lat: 48.8722, lon: 2.3601, quartier: "Paris 10e", statut: "recherche", propositions: [], createdAt: T0, rechercheDepuis: T0, ...extra });

describe("Urgences (PRO-17)", () => {
  it("catégories de la maquette, gaz exclu, 2 questions chacune", () => {
    assert.deepEqual(CATEGORIES.map((c) => c.label), ["Fuite d'eau", "WC ou évier bouché", "Panne d'électricité", "Porte claquée, serrure", "Plus d'eau chaude", "Vitre cassée"]);
    assert.ok(CATEGORIES.every((c) => c.questions.length === 2));
    assert.ok(!CATEGORIES.some((c) => /gaz/i.test(c.label)));
    assert.deepEqual(nettoyerReponses("fuite", { ou: "Sous l'évier", coupee: "Peut-être", autre: "x" }), { ou: "Sous l'évier" });
    assert.equal(titreUrgence(urgence()), "Fuite d'eau · sous l'évier");
    assert.deepEqual(detailsUrgence(urgence()), [{ libelle: "Où", valeur: "sous l'évier" }, { libelle: "Eau coupée", valeur: "oui" }]);
  });

  it("électricité et chauffage seulement pour les métiers déclarés", () => {
    assert.equal(categorieAutorisee("electricite", ["Plombier"]), false);
    assert.equal(categorieAutorisee("electricite", ["Electricien"]), true);
    assert.equal(categorieAutorisee("eau_chaude", ["Chauffagiste"]), true);
    assert.equal(categorieAutorisee("fuite", []), true);
    const r = nettoyerReglages({ prix: { fuite: "89", electricite: "120", bouche: "110,5", vitre: "0" }, demiHeure: "35", rayonKm: 8 }, ["Plombier"]);
    assert.deepEqual(r, { prix: { fuite: 89, bouche: 110.5 }, demiHeure: 35, rayonKm: 8 });
    assert.equal(nettoyerReglages({ rayonKm: 42 }).rayonKm, 8);
  });

  it("disponible jusqu'à une heure, à Paris", () => {
    assert.equal(finDispo("20:00", T0), "2026-10-30T19:00:00.000Z");
    assert.equal(finDispo("9:00", T0), null); // demain 9 h : plus de 14 heures
    assert.equal(finDispo("01:30", "2026-10-30T22:00:00.000Z"), "2026-10-31T00:30:00.000Z");
    assert.equal(finDispo("25:00", T0), null);
    assert.equal(heureParDefaut(T0), "20:00");
    assert.equal(heureParDefaut("2026-10-30T18:40:00.000Z"), "20:45");
    assert.equal(dispoActive(pro(48.87, 2.35), T0), true);
    assert.equal(dispoActive(pro(48.87, 2.35), "2026-10-30T19:00:01.000Z"), false);
    assert.equal(dispoActive({ ...pro(48.87, 2.35), demiHeure: 0 }, T0), false);
  });

  it("quartier sans la rue, temps de trajet estimé", () => {
    assert.equal(quartierDe({ city: "Paris", postcode: "75010" }), "Paris 10e");
    assert.equal(quartierDe({ city: "Paris", postcode: "75001" }), "Paris 1er");
    assert.equal(quartierDe({ city: "Paris", postcode: "75116" }), "Paris 16e");
    assert.equal(quartierDe({ city: "Lyon", postcode: "69003" }), "Lyon 3e");
    assert.equal(quartierDe({ city: "Saint-Ouen-sur-Seine", postcode: "93400" }), "Saint-Ouen-sur-Seine");
    assert.equal(minutesTrajet(2.1), 9);
    assert.equal(minutesTrajet(0.2), 5);
  });

  it("prix montré avant acceptation : fourchette des artisans disponibles, jamais un prix Koji", () => {
    assert.equal(fourchette([]), null);
    assert.equal(textePrix(null), null);
    const un = textePrix(fourchette([{ prix: { deplacement: 89, demiHeure: 35 } }]));
    assert.equal(un.montant, "89 € TTC");
    assert.equal(un.detail, "déplacement et première demi-heure, puis 35 € la demi-heure · les pièces sont sur devis, signé avant tout travail");
    assert.equal(un.note, "");
    const deux = textePrix(fourchette([{ prix: { deplacement: 89, demiHeure: 35 } }, { prix: { deplacement: 110, demiHeure: 40 } }]));
    assert.equal(deux.montant, "89 à 110 € TTC");
    assert.match(deux.detail, /selon l'artisan, puis 35 à 40 € la demi-heure/);
    assert.match(deux.note, /prix exact de l'artisan qui accepte avant de confirmer/);
  });

  it("candidats : disponibles, prix renseigné, dans leur rayon, du plus proche au plus loin", () => {
    const reglages = {
      loin: pro(48.84, 2.4),
      proche: pro(48.873, 2.361, 110),
      horsZone: pro(48.6, 2.1),
      sansPrix: { ...pro(48.872, 2.36), prix: { vitre: 90 } },
      absent: { ...pro(48.872, 2.36), actif: false }
    };
    const l = candidats(urgence(), reglages, T0);
    assert.deepEqual(l.map((c) => c.userId), ["proche", "loin"]);
    assert.deepEqual(l[0].prix, { deplacement: 110, demiHeure: 35 });
    assert.deepEqual(candidats(urgence({ propositions: [{ userId: "proche", refuseeLe: T0 }] }), reglages, T0).map((c) => c.userId), ["loin"]);
  });

  it("attribution : 3 plus proches, une vague par minute, toute la zone à 3 minutes, fin à 5 minutes", () => {
    const liste = ["a", "b", "c", "d", "e", "f", "g"].map((userId, k) => ({ userId, distanceKm: k + 1 }));
    const u = urgence();
    assert.deepEqual(avancer(u, liste, T0).map((p) => p.userId), ["a", "b", "c"]);
    assert.deepEqual(avancer(u, liste, plus(30)), []);
    assert.equal(propositionActive(u.propositions[0], plus(59)), true);
    assert.equal(propositionActive(u.propositions[0], plus(61)), false);
    assert.deepEqual(avancer(u, liste, plus(61)).map((p) => p.userId), ["d", "e", "f"]);
    refuser(u, "b", plus(70));
    assert.equal(propositionActive(u.propositions[1], plus(71)), false);
    assert.deepEqual(avancer(u, liste, plus(181)).map((p) => p.userId), ["a", "c", "d", "e", "f", "g"]); // relances + g, pas b qui a refusé
    assert.equal(u.statut, "recherche");
    avancer(u, liste, plus(301));
    assert.equal(u.statut, "sans_artisan");
  });

  it("le premier qui accepte l'obtient ; les autres voient qu'elle est prise", () => {
    const u = urgence();
    avancer(u, [{ userId: "a", distanceKm: 2.1 }, { userId: "b", distanceKm: 3 }], T0);
    assert.equal(accepter(u, { userId: "a", minutes: 24, prix: { deplacement: 89, demiHeure: 35 }, maintenant: plus(120) }), "Le délai pour accepter cette urgence est passé.");
    assert.equal(accepter(u, { userId: "a", minutes: 24, prix: { deplacement: 89, demiHeure: 35 }, maintenant: plus(120 - 60) }), "");
    assert.equal(u.statut, "acceptee");
    assert.equal(u.artisan.arriveeVers, "10:41");
    assert.equal(accepter(u, { userId: "b", minutes: 10, prix: {}, maintenant: plus(61) }), "Cette urgence a déjà été prise par un autre artisan.");
    // sans confirmation en 10 minutes : l'artisan est libéré
    avancer(u, [], plus(60 + 601));
    assert.equal(u.statut, "expiree");
    relancer(u, plus(700));
    assert.equal(u.statut, "recherche");
    assert.equal(u.artisan, null);
  });

  it("l'artisan se retire avant la confirmation : la recherche repart sans lui", () => {
    const u = urgence();
    avancer(u, [{ userId: "a", distanceKm: 1 }, { userId: "b", distanceKm: 2 }], T0);
    accepter(u, { userId: "a", minutes: 15, prix: { deplacement: 89, demiHeure: 35 }, maintenant: plus(10) });
    assert.equal(retirer(u, "b", plus(20)), "Rien à retirer.");
    assert.equal(retirer(u, "a", plus(20)), "");
    assert.equal(u.statut, "recherche");
    assert.deepEqual(u.propositions.map((p) => p.userId), ["a"]);
    assert.ok(u.propositions[0].refuseeLe);
  });

  it("suivi du particulier : Confirmée, En route, Sur place, Facture", () => {
    assert.equal(etatClient(urgence()), "recherche");
    const c = urgence({ statut: "confirmee" });
    assert.equal(etatClient(c, {}), "confirmee");
    assert.equal(etatClient(c, { enRouteLe: "x" }), "en_route");
    assert.equal(etatClient(c, { enRouteLe: "x", arriveLe: "y" }), "sur_place");
    assert.equal(etatClient(c, { termineeLe: "z" }), "terminee");
    assert.equal(etatClient(c, { annuleeLe: "z" }), "annulee");
    assert.deepEqual(etapesSuivi("en_route").map((e) => e.fait), [true, true, false, false]);
    assert.deepEqual(etapesSuivi("terminee").map((e) => e.fait), [true, true, true, true]);
    assert.deepEqual(actionsClient("acceptee"), { confirmer: true, annuler: true, relancer: false });
    assert.equal(actionsClient("en_route", { arriveLe: "" }).annuler, true);
    assert.equal(actionsClient("sur_place", { arriveLe: "x" }).annuler, false);
    assert.equal(actionsClient("sans_artisan").relancer, true);
  });

  it("noms courts et liste des interventions", () => {
    assert.equal(nomCourt({ prenom: "Karim", nom: "Benali", entreprise: "Karim B. Plomberie" }), "Karim B.");
    assert.equal(nomCourt({ entreprise: "Plomberie Dupont" }), "Plomberie Dupont");
    assert.equal(initiales("Karim Benali"), "KB");
    assert.equal(clientCourt("Claire Lefèvre", "Paris 10e"), "Claire L., Paris 10e");
    assert.equal(quandListe(T0, T0), "10:16");
    assert.equal(quandListe("2026-10-29T17:40:00.000Z", T0), "Hier 18:40");
    assert.equal(quandListe("2026-10-28T10:00:00.000Z", T0), "28 oct.");
    assert.deepEqual(statutListe({}, { termineeLe: "x" }, { status: "Payee" }), { texte: "Payé", genre: "valide" });
    assert.deepEqual(statutListe({}, { termineeLe: "x" }, { status: "Emise" }), { texte: "À encaisser", genre: "attente" });
    assert.deepEqual(statutListe({ statut: "annulee", annuleePar: "client" }, null, null), { texte: "Annulée par le client", genre: "muet" });
  });

  it("chiffres du jour de l'artisan", () => {
    const miennes = [
      { confirmeeLe: "2026-10-30T07:05:00.000Z", interventionId: "i1" },
      { confirmeeLe: "2026-10-30T09:19:00.000Z", interventionId: "i2" },
      { confirmeeLe: "2026-10-29T17:40:00.000Z", interventionId: "i3" }
    ];
    const interventions = [
      { id: "i1", arriveLe: "2026-10-30T07:25:00.000Z", invoiceId: "f1" },
      { id: "i2", arriveLe: "2026-10-30T09:43:00.000Z" },
      { id: "i3", arriveLe: "2026-10-29T18:00:00.000Z", invoiceId: "f3" }
    ];
    const factures = [{ id: "f1", amountTtc: 128 }, { id: "f3", amountTtc: 236 }];
    const c = chiffresDuJour(miennes, interventions, factures, "2026-10-30T10:00:00.000Z");
    assert.deepEqual(c, { urgences: 2, facture: 128, factureTexte: "128 €", arriveeMoyenne: 22, arriveeTexte: "22 min" });
    assert.equal(chiffresDuJour([], [], [], T0).arriveeTexte, "—");
  });

  it("la photo perd sa position GPS (EXIF) avant d'être montrée à l'artisan", () => {
    const app0 = [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46];
    const exif = [0xff, 0xe1, 0x00, 0x06, 0x45, 0x78, 0x69, 0x66];
    const dqt = [0xff, 0xdb, 0x00, 0x03, 0x01];
    const sos = [0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9];
    const jpeg = Uint8Array.from([0xff, 0xd8, ...app0, ...exif, ...dqt, ...sos]);
    assert.deepEqual([...sansExif(jpeg)], [0xff, 0xd8, ...app0, ...dqt, ...sos]);
    assert.equal(sansExif(Uint8Array.from([0x89, 0x50, 0x4e, 0x47])), null);
  });

  it("l'app Koji et l'app Koji Pro portent les mêmes textes", () => {
    const dart = readFileSync(new URL("../../mobile/lib/features/urgences/urgences_logic.dart", import.meta.url), "utf8");
    const present = (t) => dart.includes(`'${t.replace(/'/g, "\\'")}'`) || dart.includes(`"${t}"`);
    for (const c of CATEGORIES) {
      assert.ok(present(c.label) && present(c.pro) && present(c.icone), c.label);
      for (const q of c.questions) {
        assert.ok(present(q.label) && present(q.court), q.label);
        for (const o of q.options) assert.ok(present(o), o);
      }
    }
    assert.ok(present(NOTE_PRO) && present(NUMERO_GAZ));
  });
});
