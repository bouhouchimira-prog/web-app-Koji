import assert from "node:assert/strict";
import {
  roleDe, paris, lundiDe, numeroSemaine, jourCourt, heuresDecimales, heuresMinutes, dureePointage, etatDuJour, grilleSemaine,
  remarquesSemaine, heures4Semaines, documentsAExpirer, apprentissages, csvHeures, invitationValide, messageInvitation
} from "../../lib/equipe-pro.js";

// Maquettes PRO-16 à 16.5 : semaine du 26 au 30 octobre 2026, vendredi 30 à 13 h 10 (Paris).
const maintenant = "2026-10-30T12:10:00Z";
const W = [{ id: "s", name: "Samir T." }, { id: "r", name: "Rui C." }, { id: "m", name: "Mehdi B." }, { id: "i", name: "Ionut P.", conges: [{ du: "2026-10-29", au: "2026-10-30" }] }];
const E = (workerId, date, startTime, endTime) => ({ id: `${workerId}-${date}`, workerId, date, startTime, endTime, durationMinutes: 0 });

describe("Équipe (PRO-16)", () => {
  it("heures, dates et rôles", () => {
    assert.equal(roleDe({}), "compagnon");
    assert.equal(roleDe({ roleEquipe: "chef" }), "chef");
    assert.deepEqual(paris("2026-10-30T06:58:00Z"), { jour: "2026-10-30", heure: "07:58" });
    assert.equal(lundiDe("2026-10-30"), "2026-10-26");
    assert.equal(numeroSemaine("2026-10-26"), 44);
    assert.equal(jourCourt("2026-10-29"), "jeu. 29");
    assert.equal(heuresDecimales(510), "8,5 h");
    assert.equal(heuresDecimales(2310), "38,5 h");
    assert.equal(heuresMinutes(372), "6 h 12");
    assert.equal(dureePointage(E("r", "2026-10-30", "07:58", ""), maintenant), 312);
    assert.equal(dureePointage(E("r", "2026-10-28", "08:00", ""), maintenant), 0);
  });

  it("qui est où aujourd'hui", () => {
    const entries = [E("s", "2026-10-30", "07:32", ""), E("r", "2026-10-30", "07:58", "")];
    const taches = [{ projectId: "c", workerIds: ["s", "r"], startDate: "2026-10-26", endDate: "2026-11-06" }, { projectId: "b", workerIds: ["m"], startDate: "2026-10-30", endDate: "2026-10-30" }];
    const titres = new Map([["c", "Caulaincourt"], ["b", "Salle de bain, Paris 10e"]]);
    const o = { entries, taches, maintenant, titres };
    assert.deepEqual([etatDuJour(W[0], o).statut, etatDuJour(W[0], o).texte, etatDuJour(W[0], o).chantier], ["arrive", "arrivé 7 h 32", "Caulaincourt"]);
    assert.deepEqual([etatDuJour(W[2], o).statut, etatDuJour(W[2], o).chantier], ["pas_arrive", "Salle de bain, Paris 10e"]);
    assert.equal(etatDuJour(W[3], o).statut, "conge");
  });

  it("feuille de la semaine : départ non pointé, journée manquante, congé", () => {
    const entries = [];
    for (const d of ["2026-10-26", "2026-10-27", "2026-10-29"]) entries.push(E("m", d, "08:00", "15:00"));
    entries.push(E("m", "2026-10-28", "08:00", ""));
    entries.push(E("r", "2026-10-26", "08:00", "16:00"));
    const g = grilleSemaine([W[1], W[2], W[3]], entries, "2026-10-26", { maintenant });
    const mehdi = g.lignes.find((l) => l.workerId === "m");
    assert.equal(mehdi.cases[2].statut, "douteux");
    assert.equal(mehdi.cases[2].proposition, 420);
    assert.equal(mehdi.total, 4 * 420);
    assert.equal(g.lignes.find((l) => l.workerId === "i").cases[3].statut, "conge");
    const r = remarquesSemaine(g);
    assert.equal(r[0].texte, "Mehdi B. n'a pas pointé son départ mercredi");
    assert.match(r[0].detail, /Koji a mis 7 h, comme les autres jours/);
    const mardi = r.find((x) => x.type === "manquant" && x.date === "2026-10-27");
    assert.equal(mardi.texte, "2 compagnons n'ont pas pointé mardi");
    assert.deepEqual(mardi.workerIds, ["r", "i"]);
  });

  it("4 semaines, documents, invitation", () => {
    const entries = [E("r", "2026-10-27", "08:00", "16:00"), E("r", "2026-10-20", "08:00", "15:00")];
    const s = heures4Semaines(entries, "r", maintenant);
    assert.deepEqual(s.map((x) => [x.semaine, x.minutes]), [["S41", 0], ["S42", 0], ["S43", 420], ["S44", 480]]);
    const docs = documentsAExpirer([{ id: "r", name: "Rui C.", documents: [{ nom: "Carte BTP", jusqua: "2026-11-28" }, { nom: "Formation amiante", jusqua: "2027-05-01" }] }], maintenant);
    assert.deepEqual(docs.map((d) => d.document), ["Carte BTP"]);
    // Même forme que celle écrite par creerInvitation : { code, creeLe }.
    assert.equal(invitationValide({ code: "K7P2QMXA", creeLe: "2026-10-25T00:00:00Z" }, maintenant), true);
    assert.equal(invitationValide({ code: "K7P2QMXA", creeLe: "2026-10-20T00:00:00Z" }, maintenant), false);
    assert.equal(invitationValide({ creeLe: "2026-10-25T00:00:00Z" }, maintenant), false);
    assert.match(messageInvitation({ prenom: "Ionut", entreprise: "ABL Expert Renov", lien: "https://getkoji.io/compagnon/abc" }), /^Bonjour Ionut, ABL Expert Renov vous invite.*getkoji\.io\/compagnon\/abc$/);
  });

  it("ce que Koji a appris : faïence 51 h pour 42 h", () => {
    const a = apprentissages([
      { lot: "Faïence murale", chantier: "Caulaincourt", faitesMin: 51 * 60, prevuesMin: 42 * 60, quantite: 50, unite: "m²", hParUniteBib: 0.85 },
      { lot: "Peinture", chantier: "Montreuil", faitesMin: 21 * 60, prevuesMin: 20 * 60, quantite: 40, unite: "m²", hParUniteBib: 0.4 }
    ]);
    assert.equal(a.length, 1);
    assert.equal(a[0].resume, "51 h faites pour 42 h prévues");
    assert.equal(a[0].texte, "Sur ce lot, la pose vous prend 1,02 h/m². Votre bibliothèque compte 0,85 h/m² : vos devis sont trop bas sur ce poste.");
  });

  it("export comptable", () => {
    const g = grilleSemaine([W[1]], [E("r", "2026-10-26", "08:00", "16:30")], "2026-10-26", { maintenant });
    const csv = csvHeures(g);
    assert.match(csv, /^﻿Compagnon;Date;Heures;Statut\r\nRui C\.;26\/10\/2026;8,5;pointé/);
  });
});
