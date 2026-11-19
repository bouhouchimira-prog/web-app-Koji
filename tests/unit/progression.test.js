import assert from "node:assert/strict";
import * as progression from "../../lib/progression.js";
import { defisSemaine, sceauVerifie } from "../../lib/progression.js";

// Maquette PRO-21 : défis de la semaine et sceau. Le niveau vient de
// « Mon parcours » (lib/parcours-grade.js, tests parcours-grade.test.js).
describe("Ma progression (PRO-21)", () => {
  const quotes = [
    ...Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, sentAt: "2026-09-01T10:00:00Z", status: "Envoye" })),
    { id: "s1", sentAt: "2026-11-16T09:00:00Z", status: "Signe" }
  ];
  const photos = [{ id: "p1", projectId: "c", lot: "Douche", phase: "apres", takenAt: "2026-11-16T10:00:00Z" }, { id: "p2", projectId: "c", lot: "WC", phase: "apres", takenAt: "2026-11-17T10:00:00Z" }, { id: "p3", projectId: "c", lot: "Cuisine", phase: "apres", takenAt: "2026-11-17T11:00:00Z" }, { id: "p4", projectId: "c", lot: "x", phase: "avant", takenAt: "2026-11-17T11:00:00Z" }];
  const demandes = [{ createdAt: "2026-11-16T08:00:00Z", reponduLe: "2026-11-16T12:20:00Z" }, { createdAt: "2026-10-01T08:00:00Z", reponduLe: "2026-10-01T09:00:00Z" }];
  const avis = [{ projectId: "c", verifie: true }];

  it("une seule source des niveaux : plus de barème ni de niveaux dans PRO-21", () => {
    assert.equal(progression.NIVEAUX, undefined);
    assert.equal(progression.POINTS, undefined);
    assert.equal(progression.niveauDe, undefined);
  });

  it("défis de la semaine, renouvelés le lundi", () => {
    const d = defisSemaine({ quotes, photos, demandes, aujourdhui: "2026-11-17T12:00:00Z" });
    assert.equal(d.lundi, "2026-11-16");
    assert.deepEqual(d.defis.map((x) => x.etat), ["1 sur 2", "3 sur 3", "4 h 20 en moyenne"]);
    assert.deepEqual(d.defis.map((x) => x.fait), [false, true, false]);
  });

  it("sceau : ce qui est vérifié, et ce qui ne l'est pas", () => {
    const s = sceauVerifie({ verifs: { sceau: true, items: [{ id: "siret", ok: true }, { id: "decennale", ok: true, label: "Assurance décennale valable jusqu'au 31/12/2026" }] }, avis });
    assert.equal(s.affiche, true);
    assert.deepEqual(s.criteres.map((c) => c.ok), [true, true, false, false]);
    assert.match(s.criteres[3].label, /1 aujourd'hui/);
  });
});
