import assert from "node:assert/strict";
import { estQuestion, executerOutil, MENTION_IA, nettoyerReponse, repondreQuestion } from "../../lib/koji-questions.js";

// Maquettes PRO-18 à 18.2 : questions, chiffres calculés par Koji, sources, actions à valider.
const d = {
  userId: "u", aujourdhui: "2026-11-09", entreprise: "ABL Expert Renov", coutHoraire: 45, articles: [], pieces: [],
  chantiers: [{ projectId: "c1", title: "Cuisine, Montreuil", address: "Montreuil", status: "en cours", quote: { id: "q1", quoteNumber: "2026-044", client: "M. Caron", status: "Signe", signatureStatus: "Signe", totalHt: 4710, totalTtc: 5181, items: [] } }],
  quotes: [{ id: "q2", quoteNumber: "2026-050", client: "Mme Petit", status: "Envoye", sentAt: "2026-10-28T10:00:00Z", totalTtc: 2400 }],
  db: {
    invoices: [
      { id: "f1", userId: "u", invoiceNumber: "KJ-2026-118", client: "M. Caron", projectId: "c1", quoteId: "q1", type: "Facture d'acompte", status: "Emise", amountTtc: 1554.3, dueDate: "2026-11-06" },
      { id: "f2", userId: "u", invoiceNumber: "KJ-2026-119", client: "Mme Petit", status: "Payee", amountTtc: 500 },
      { id: "f3", userId: "autre", invoiceNumber: "X", client: "Autre", status: "Emise", amountTtc: 999 }
    ],
    tasks: [{ id: "t1", userId: "u", projectId: "c1", label: "Dépose", startDate: "2026-11-09", endDate: "2026-11-09", workerIds: ["w1"] }],
    workers: [{ id: "w1", userId: "u", name: "Yanis K." }],
    avenants: [], attendanceEntries: [], clotures: []
  }
};

describe("Koji répond (PRO-18)", () => {
  it("question ou demande d'action", () => {
    assert.equal(estQuestion("Quels chantiers perdent de l'argent ce mois-ci ?"), true);
    assert.equal(estQuestion("Je peux commencer lundi chez M. Caron ?"), true);
    assert.equal(estQuestion("qui me doit de l'argent"), true);
    assert.equal(estQuestion("Crée un devis pour Mme Petit"), false);
    assert.equal(estQuestion("Ajoute une fourniture ?"), false);
  });

  it("chiffres calculés par Koji, limités au compte", async () => {
    const e = await executerOutil(d, "a_encaisser");
    assert.equal(e.factures.length, 1);
    assert.equal(e.factures[0].reste_du, "1 554,30 €");
    assert.equal(e.factures[0].retard_jours, 3);
    assert.equal(e.factures[0].href, "/facturation?relancer=f1");
    assert.equal(e.total, "1 554,30 €");
    const dv = await executerOutil(d, "devis_en_attente");
    assert.equal(dv[0].a_relancer, true);
    assert.match(dv[0].message_relance, /Mme Petit|devis/i);
    const a = await executerOutil(d, "agenda", { debut: "2026-11-09", fin: "2026-11-13" });
    assert.deepEqual([a[0].tache, a[0].equipe], ["Dépose", "Yanis K."]);
    const c = await executerOutil(d, "chantier", { ref: "caron" });
    assert.equal(c.chantier, "Cuisine, Montreuil");
    assert.equal(c.factures[0].reste_du, "1 554,30 €");
  });

  it("réponse nettoyée : liens internes connus, actions à valider", () => {
    const r = nettoyerReponse({
      constat: "Oui, à deux conditions.",
      sources: [{ label: "Devis 2026-044", href: "/devis?id=q1" }, { label: "Piège", href: "https://exemple.invalid" }, { label: "Inconnu", href: "/admin" }],
      actions: [{ type: "message_client", label: "Relancer l'acompte", quoteId: "q1", texte: "Bonjour M. Caron…" }, { type: "ouvrir", label: "Supprimer", href: "/admin" }, { type: "payer", label: "x" }]
    }, new Set(["/devis?id=q1"]));
    assert.deepEqual(r.sources.map((s) => s.href), ["/devis?id=q1"]);
    assert.deepEqual(r.actions.map((a) => a.type), ["message_client"]);
    assert.equal(r.mention, MENTION_IA);
  });

  it("boucle d'outils puis réponse (modèle simulé)", async () => {
    const appels = [];
    const client = { messages: { create: async (p) => {
      appels.push(p);
      if (appels.length === 1) return { content: [{ type: "tool_use", id: "a1", name: "a_encaisser", input: {} }] };
      return { content: [{ type: "tool_use", id: "a2", name: "repondre", input: { constat: "M. Caron vous doit 1 554,30 €.", sources: [{ label: "Facture KJ-2026-118", href: "/facturation?relancer=f1" }] } }] };
    } } };
    const fakeEntreprise = { userId: "u" };
    // chargerDonnees lit Supabase : on le contourne en passant par executerOutil via un client simulé.
    const r = await repondreQuestion({ entreprise: fakeEntreprise, db: d.db, question: "Qui me doit de l'argent ?", client, donnees: d });
    assert.equal(r.reponse.constat, "M. Caron vous doit 1 554,30 €.");
    assert.equal(r.reponse.sources[0].href, "/facturation?relancer=f1");
    assert.equal(appels[1].messages.at(-1).content[0].type, "tool_result");
  });
});

import { contactInactif } from "../../lib/contacts-pro.js";
describe("Archivage (PRO-19.1)", () => {
  it("contact inactif après 24 mois sans échange", () => {
    assert.equal(contactInactif({ createdAt: "2024-01-10" }, [], "2026-11-17"), true);
    assert.equal(contactInactif({ createdAt: "2024-01-10" }, [{ quand: "2025-06-01" }], "2026-11-17"), false);
    assert.equal(contactInactif({}, [], "2026-11-17"), false);
  });
});
