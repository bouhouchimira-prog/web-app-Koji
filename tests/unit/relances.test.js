const assert = require("assert");
const { actionImpaye, estImpayee, etapeRelance, joursRetard, relanceDue, resumeImpayes, texteRelance } = require("../../lib/relances");

// Relances et mise en demeure (maquette PRO-06.2).
const LEFEVRE = { id: "f1", invoiceNumber: "KJ-2026-118", type: "Acompte initial", status: "Emise", client: "Mme Lefèvre", amountTtc: 1739.56, createdAt: "2026-10-30T09:00:00Z", issuedAt: "2026-10-30T09:00:00Z", dueDate: "2026-11-06",
  reminders: [{ level: "aimable", channel: "email", at: "2026-11-09T08:00:00Z" }, { level: "ferme", channel: "email", at: "2026-11-21T08:00:00Z" }] };
const CAULAINCOURT = { id: "f2", invoiceNumber: "KJ-2026-130", type: "Situation 2", status: "Emise", client: "Caulaincourt", amountTtc: 1712.9, dueDate: "2026-11-21", reminders: [{ level: "aimable", channel: "email", at: "2026-11-25T08:00:00Z" }] };
const AUTEUIL = { id: "f3", invoiceNumber: "KJ-2026-109", type: "Facture", status: "Emise", client: "SCI Bureaux Auteuil", amountTtc: 4920, dueDate: "2026-11-27", reminders: [] };
const JOUR = "2026-11-30";

describe("relances et mise en demeure (PRO-06.2)", () => {
  it("liste des impayés : retards, total et étapes de la maquette", () => {
    const { liste, total } = resumeImpayes([AUTEUIL, LEFEVRE, CAULAINCOURT, { ...AUTEUIL, id: "p", status: "Payee" }], JOUR);
    assert.deepStrictEqual(liste.map((f) => [f.invoiceNumber, joursRetard(f, JOUR)]), [["KJ-2026-118", 24], ["KJ-2026-130", 9], ["KJ-2026-109", 3]]);
    assert.strictEqual(total, 8372.46);
    assert.strictEqual(etapeRelance(LEFEVRE, JOUR), "2e relance envoyée le 21 nov.");
    assert.strictEqual(etapeRelance(CAULAINCOURT, JOUR), "1re relance envoyée le 25 nov.");
    assert.strictEqual(etapeRelance({ ...AUTEUIL, dueDate: "2026-11-28" }, JOUR), "rappel aimable prévu demain");
    assert.strictEqual(etapeRelance({ ...AUTEUIL, dueDate: "2026-11-27" }, JOUR), "relance ferme prévue dans 12 jours");
    assert.deepStrictEqual([LEFEVRE, CAULAINCOURT, { ...AUTEUIL, dueDate: "2026-11-28" }].map((f) => actionImpaye(f, JOUR)), ["demeure", "relancer", "voir"]);
  });

  it("relances automatiques J+3, J+15, J+30, jamais en double ni sur facture désactivée ou avec avoir", () => {
    assert.strictEqual(relanceDue(AUTEUIL, JOUR), "aimable");
    assert.strictEqual(relanceDue({ ...AUTEUIL, reminders: [{ level: "aimable", at: "2026-11-30T08:00:00Z" }] }, JOUR), null);
    assert.strictEqual(relanceDue(CAULAINCOURT, JOUR), null); // 9 jours : la relance ferme attend J+15
    assert.strictEqual(relanceDue(CAULAINCOURT, "2026-12-06"), "ferme");
    assert.strictEqual(relanceDue(LEFEVRE, "2026-12-06"), "demeure");
    assert.strictEqual(relanceDue({ ...LEFEVRE, demeurePrete: "2026-12-06T07:00:00Z" }, "2026-12-07"), null);
    assert.strictEqual(relanceDue({ ...AUTEUIL, remindersOff: true }, JOUR), null);
    assert.strictEqual(relanceDue(AUTEUIL, JOUR, 100), null);
    assert.strictEqual(estImpayee({ ...AUTEUIL, kind: "avoir" }, JOUR), false);
  });

  it("mise en demeure préremplie : particulier (taux légal) et société (40 €)", () => {
    assert.strictEqual(texteRelance("demeure", LEFEVRE, { aujourdhui: JOUR }),
      "Objet : mise en demeure de payer\n\nMadame, malgré nos relances des 9 et 21 novembre, la facture d'acompte KJ-2026-118 du 30 octobre, d'un montant de 1 739,56 € TTC, reste impayée. Nous vous mettons en demeure de régler cette somme sous 8 jours à compter de la réception de ce courrier. À défaut, nous saisirons la juridiction compétente. Les sommes dues porteront intérêts au taux légal à compter de la présente mise en demeure.");
    const pro = texteRelance("demeure", AUTEUIL, { societe: true, entreprise: "ABL Expert Renov" });
    assert.ok(pro.includes("indemnité forfaitaire de 40 €"));
    assert.ok(pro.startsWith("Objet : mise en demeure de payer\n\nMadame, Monsieur, la facture KJ-2026-109"));
    assert.ok(pro.endsWith("\n\nABL Expert Renov"));
    assert.ok(texteRelance("ferme", CAULAINCOURT, { aujourdhui: JOUR }).includes("Malgré notre précédent rappel du 25 novembre, la situation de travaux KJ-2026-130"));
  });
});

describe("passe quotidienne des relances automatiques (PRO-06.2)", () => {
  it("relance par e-mail à J+3, prépare la mise en demeure à J+30, rien si désactivé", async () => {
    const { passerRelances } = await import("../../lib/relances-passe.js");
    const db = {
      relancesAuto: { u1: { actif: true } },
      notifications: [],
      users: [],
      invoices: [
        { ...AUTEUIL, userId: "u1", quoteId: "", clientEmail: "auteuil@exemple.fr" },
        { ...LEFEVRE, userId: "u1", quoteId: "" },
        { ...AUTEUIL, id: "f9", userId: "u2", quoteId: "", clientEmail: "autre@exemple.fr" }
      ]
    };
    const envois = [];
    const fait = await passerRelances(db, { aujourdhui: "2026-12-06", envoyer: async (m) => { envois.push(m); return { ok: true }; } });
    assert.deepStrictEqual(envois.map((m) => [m.to, m.subject]), [["auteuil@exemple.fr", "Rappel : facture KJ-2026-109"]]);
    assert.deepStrictEqual(fait.preparees, ["f1"]);
    assert.ok(db.invoices[1].demeurePrete);
    assert.strictEqual(db.notifications[0].actionUrl, "/facturation/impayes?demeure=f1");
    // Deuxième passe le même jour : rien de plus.
    const encore = await passerRelances(db, { aujourdhui: "2026-12-06", envoyer: async (m) => { envois.push(m); return { ok: true }; } });
    assert.strictEqual(encore.envoyees.length + encore.preparees.length, 0);
  });
});
