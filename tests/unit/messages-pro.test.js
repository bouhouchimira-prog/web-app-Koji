import assert from "node:assert/strict";
import { etiquettes, filtrerFils, heure, nomCourt, parJour, quandCourt, resumeFil } from "../../lib/messages-pro.js";

// Maquette PRO-12 : fil de Mme Lefèvre, jeudi 12 novembre 2026.
const auj = "2026-11-12";
const fil = { cle: "devis:q1", type: "client", titre: "Mme Lefèvre", sousTitre: "Salle de bain, Paris 10e", messages: [
  { id: "1", texte: "Pour la livraison du receveur vendredi, je ne serai pas là le matin.", le: "2026-11-11T17:20:00Z", entreprise: false },
  { id: "2", texte: "Le gardien peut-il réceptionner ?", le: "2026-11-11T17:41:00Z", entreprise: true },
  { id: "3", texte: "Le gardien peut réceptionner avant 12 h.", le: "2026-11-12T08:42:00Z", entreprise: false }
] };

describe("Messages (PRO-12)", () => {
  it("heures à Paris et dates courtes", () => {
    assert.equal(heure("2026-11-12T08:42:00Z"), "9 h 42");
    assert.equal(heure("2026-11-12T09:00:00Z"), "10 h");
    assert.equal(quandCourt("2026-11-12T08:42:00Z", auj), "9 h 42");
    assert.equal(quandCourt("2026-11-11T17:20:00Z", auj), "hier");
    assert.equal(quandCourt("2026-11-10T09:00:00Z", auj), "mar.");
    assert.equal(quandCourt("2026-10-30T09:00:00Z", auj), "30 oct.");
    assert.equal(nomCourt("Laura Martin"), "Laura M.");
  });
  it("non lus : messages du client après la dernière lecture", () => {
    assert.equal(resumeFil(fil, { aujourdhui: auj }).nonLus, 2);
    const r = resumeFil(fil, { luLe: "2026-11-11T18:00:00Z", aujourdhui: auj });
    assert.equal(r.nonLus, 1);
    assert.deepEqual(r.dernier, { texte: "Le gardien peut réceptionner avant 12 h.", le: "2026-11-12T08:42:00Z", quand: "9 h 42", entreprise: false });
    assert.equal(r.initiales, "LE");
  });
  it("filtres et recherche, plus récent d'abord", () => {
    const a = resumeFil(fil, { aujourdhui: auj });
    const b = { ...resumeFil({ cle: "radar:o", type: "radar", titre: "Laura M.", sousTitre: "Salle d'eau à refaire", messages: [{ texte: "Disponible mardi", le: "2026-11-11T10:00:00Z" }] }, { luLe: "2026-11-12T00:00:00Z", aujourdhui: auj }) };
    const c = { ...b, cle: "pro", pro: true, titre: "Rénov Horizon", sousTitre: "Bureaux Auteuil", nonLus: 0, dernier: { le: "2026-11-12T07:15:00Z" } };
    assert.deepEqual(filtrerFils([b, a, c]).map((f) => f.titre), ["Mme Lefèvre", "Rénov Horizon", "Laura M."]);
    assert.deepEqual(filtrerFils([b, a, c], { filtre: "nonlus" }).map((f) => f.titre), ["Mme Lefèvre"]);
    assert.deepEqual(filtrerFils([b, a, c], { filtre: "pros" }).map((f) => f.titre), ["Rénov Horizon"]);
    assert.deepEqual(filtrerFils([b, a, c], { q: "salle d'eau" }).map((f) => f.titre), ["Laura M."]);
  });
  it("messages par jour et étiquettes, l'alerte d'abord", () => {
    assert.deepEqual(parJour(fil.messages, auj).map((g) => [g.titre, g.messages.length]), [["Hier", 2], ["Aujourd'hui", 1]]);
    assert.deepEqual(etiquettes({ etape: "Lot 01 · démarre le 12 nov.", livraison: { fournisseur: "Cedeo", quand: "ven. 13", raison: "lieu à confirmer", bloquant: true }, devisSigne: true, acompteEchu: true }).map((e) => e.texte),
      ["Livraison Cedeo ven. 13 · lieu à confirmer", "Acompte à relancer", "Lot 01 · démarre le 12 nov.", "Devis signé"]);
  });
});
