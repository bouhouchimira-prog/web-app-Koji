import assert from "node:assert/strict";
import {
  TEXTE_RETIRE, agir, banni, cibleSignalement, compteSuspendu, examiner, filDeLaCible,
  natureSignalement, particulierSuspendu
} from "../../lib/moderation.js";
import { cleInterne, signerInterne, verifierInterne } from "../../lib/interne-signature.js";

// Accès aux tables Supabase simulé : devis, messages de devis, échanges du
// Réseau pro, comptes (entreprises et app Koji) et suspensions.
function fauxAcces({ devis = [], messagesDevis = [], echanges = [], messagesEchange = [], comptes = [] } = {}) {
  const bannis = new Set();
  const acces = {
    bannis,
    async devis(id) { return devis.find((d) => d.id === id) || null; },
    async messagesDevis(q) { return messagesDevis.filter((m) => m.quote_id === q); },
    async modifierMessagesDevis(ids, t) { for (const m of messagesDevis) if (ids.includes(m.id)) m.text = t; },
    async echange(id) { return echanges.find((e) => e.id === id) || null; },
    async messagesEchange(id) { return messagesEchange.filter((m) => m.echange_id === id); },
    async modifierMessagesEchange(ids, t) { for (const m of messagesEchange) if (ids.includes(m.id)) m.text = t; },
    async entreprise(id) {
      const c = comptes.find((x) => x.id === id);
      return c ? { type: c.pro === false ? "particulier" : "entreprise", compte: "supabase", id: c.id, nom: c.nom, email: c.email, suspendu: bannis.has(c.id) } : null;
    },
    async compteParEmail(email) {
      const c = comptes.find((x) => x.email === email);
      return c ? acces.entreprise(c.id) : null;
    },
    async suspendre(id, oui) { if (oui) bannis.add(id); else bannis.delete(id); }
  };
  return acces;
}

const baseRadar = () => ({
  users: [{ id: "part-1", accountType: "particulier", name: "Laura Martin", email: "laura@exemple.invalid" }],
  chantierOffres: [{ id: "offre-1", userId: "part-1", clientName: "Laura Martin", description: "Refaire la salle de bain", status: "Publiee", createdAt: "2026-11-18T10:00:00Z" }],
  chantierOffreMessages: [
    { id: "m1", offerId: "offre-1", entrepriseUserId: "pro-1", senderType: "entreprise", message: "Bonjour, je peux passer jeudi.", createdAt: "2026-11-19T09:00:00Z" },
    { id: "m2", offerId: "offre-1", entrepriseUserId: "pro-1", senderType: "particulier", message: "Propos injurieux", createdAt: "2026-11-19T10:00:00Z" },
    { id: "m3", offerId: "offre-1", entrepriseUserId: "pro-2", senderType: "particulier", message: "Autre fil", createdAt: "2026-11-19T11:00:00Z" }
  ],
  notifications: [{ id: "n1", type: "radar.message", offerId: "offre-1", userId: "part-1", message: "Bonjour, je peux passer jeudi." }],
  companySiteLeads: [{ id: "lead-1", userId: "pro-1", name: "Paul Durand", email: "paul@exemple.invalid", message: "Spam", createdAt: "2026-11-19T08:00:00Z" }]
});
const comptes = [{ id: "pro-1", nom: "Rénov Plus", email: "pro1@exemple.invalid" }, { id: "pro-2", nom: "Bati Sud", email: "pro2@exemple.invalid" }];

describe("modération : nature et cible d'un signalement", () => {
  it("reconnaît Signaler et Bloquer, champ ou préfixe des anciennes apps", () => {
    assert.equal(natureSignalement({ nature: "contenu" }, "x"), "contenu");
    assert.equal(natureSignalement({}, "[Signalement contenu] Conversation"), "contenu");
    assert.equal(natureSignalement({}, "[Blocage] Annonce"), "blocage");
    assert.equal(natureSignalement({}, "Le bouton ne marche pas"), "technique");
  });

  it("lit la cible envoyée, sinon la ligne « Type : … · id : … »", () => {
    assert.deepEqual(cibleSignalement({ cible: { type: "conversation", id: "radar:offre-1:pro-1" } }), { type: "conversation", id: "radar:offre-1:pro-1" });
    assert.deepEqual(cibleSignalement({}, "[Blocage] Annonce\nType : offre_radar · id : offre-1"), { type: "offre_radar", id: "offre-1" });
    assert.equal(cibleSignalement({ cible: { type: "autre", id: "x" } }), null);
    assert.equal(cibleSignalement({ cible: { type: "offre_radar", id: "a b<script>" } }), null);
  });

  it("traduit la cible en fil", () => {
    assert.deepEqual(filDeLaCible({ type: "message_devis", id: "q1" }), { kind: "devis", quoteId: "q1" });
    assert.deepEqual(filDeLaCible({ type: "conversation", id: "radar:o1" }), { kind: "radar", offerId: "o1", entrepriseUserId: "" });
    assert.deepEqual(filDeLaCible({ type: "conversation", id: "reseau:e1" }), { kind: "reseau", echangeId: "e1" });
    assert.equal(filDeLaCible({ type: "conversation", id: "inconnu:1" }), null);
  });
});

describe("modération : examiner", () => {
  it("fil Radar signalé par l'entreprise : l'auteur est le particulier, seuls ses messages de ce fil", async () => {
    const db = baseRadar();
    const ex = await examiner({ userId: "pro-1", sessionKind: "entreprise", cible: { type: "conversation", id: "radar:offre-1" } }, { db, acces: fauxAcces({ comptes }) });
    assert.equal(ex.auteur.id, "part-1");
    assert.equal(ex.auteur.compte, "site");
    assert.deepEqual(ex.contenus.map((c) => c.id), ["m2"]);
    assert.equal(ex.peutRetirer, true);
    assert.equal(ex.peutSuspendre, true);
  });

  it("fil Radar signalé par le particulier (app Koji) : l'auteur est l'entreprise du fil", async () => {
    const db = baseRadar();
    const ex = await examiner({ userId: "part-1", sessionKind: "particulier", cible: { type: "conversation", id: "radar:offre-1:pro-1" } }, { db, acces: fauxAcces({ comptes }) });
    assert.equal(ex.auteur.id, "pro-1");
    assert.equal(ex.auteur.type, "entreprise");
    assert.deepEqual(ex.contenus.map((c) => c.id), ["m1"]);
  });

  it("devis : signalé par l'entreprise, l'auteur est le client ; par le client, l'entreprise", async () => {
    const acces = fauxAcces({
      comptes: [...comptes, { id: "app-9", nom: "Jean Client", email: "jean@exemple.invalid", pro: false }],
      devis: [{ id: "q1", user_id: "pro-1" }],
      messagesDevis: [
        { id: "d1", quote_id: "q1", text: "Bonjour", author_email: "pro1@exemple.invalid" },
        { id: "d2", quote_id: "q1", text: "Insulte", author_email: "jean@exemple.invalid", author_name: "Jean" }
      ]
    });
    const parPro = await examiner({ userId: "pro-1", cible: { type: "message_devis", id: "q1" } }, { db: { users: [] }, acces });
    assert.equal(parPro.auteur.id, "app-9");
    assert.deepEqual(parPro.contenus.map((c) => c.id), ["d2"]);
    const parClient = await examiner({ userId: "app-9", cible: { type: "conversation", id: "devis:q1" } }, { db: { users: [] }, acces });
    assert.equal(parClient.auteur.id, "pro-1");
    assert.deepEqual(parClient.contenus.map((c) => c.id), ["d1"]);
  });

  it("KojiPage : visiteur sans compte, on peut retirer mais pas suspendre", async () => {
    const ex = await examiner({ userId: "pro-1", cible: { type: "conversation", id: "kojipage:lead-1" } }, { db: baseRadar(), acces: fauxAcces() });
    assert.equal(ex.auteur.type, "visiteur");
    assert.equal(ex.peutRetirer, true);
    assert.equal(ex.peutSuspendre, false);
  });
});

describe("modération : agir", () => {
  it("retirer un fil Radar remplace les messages de l'auteur et l'aperçu des notifications", async () => {
    const db = baseRadar();
    const report = { id: "r1", userId: "part-1", sessionKind: "particulier", cible: { type: "conversation", id: "radar:offre-1:pro-1" } };
    const r = await agir(report, "retirer", { db, acces: fauxAcces({ comptes }), par: "admin@exemple.invalid", maintenant: "2026-11-20T18:00:00Z" });
    assert.equal(r.ok, true);
    assert.equal(db.chantierOffreMessages.find((m) => m.id === "m1").message, TEXTE_RETIRE);
    assert.equal(db.chantierOffreMessages.find((m) => m.id === "m2").message, "Propos injurieux");
    assert.equal(db.notifications[0].message, TEXTE_RETIRE);
    assert.equal(report.moderation.historique[0].par, "admin@exemple.invalid");
    // Une deuxième fois : plus rien à retirer.
    assert.equal((await agir(report, "retirer", { db, acces: fauxAcces({ comptes }) })).ok, false);
  });

  it("retirer une demande du Radar la passe à « Retiree »", async () => {
    const db = baseRadar();
    const r = await agir({ id: "r2", userId: "pro-1", cible: { type: "offre_radar", id: "offre-1" } }, "retirer", { db, acces: fauxAcces() });
    assert.equal(r.ok, true);
    assert.equal(db.chantierOffres[0].status, "Retiree");
  });

  it("suspendre puis réactiver un particulier du site", async () => {
    const db = baseRadar();
    const report = { id: "r3", userId: "pro-1", sessionKind: "entreprise", cible: { type: "offre_radar", id: "offre-1" } };
    assert.equal((await agir(report, "suspendre", { db, acces: fauxAcces() })).ok, true);
    assert.equal(particulierSuspendu(db, "part-1"), true);
    assert.equal(compteSuspendu(db.users[0]), true);
    assert.equal((await agir(report, "reactiver", { db, acces: fauxAcces() })).ok, true);
    assert.equal(particulierSuspendu(db, "part-1"), false);
  });

  it("suspendre une entreprise passe par la suspension du compte Supabase", async () => {
    const db = baseRadar();
    const acces = fauxAcces({ comptes });
    const report = { id: "r4", userId: "part-1", sessionKind: "particulier", cible: { type: "conversation", id: "radar:offre-1:pro-1" } };
    assert.equal((await agir(report, "suspendre", { db, acces })).ok, true);
    assert.ok(acces.bannis.has("pro-1"));
    assert.equal((await examiner(report, { db, acces })).auteur.suspendu, true);
  });

  it("visiteur KojiPage : suspension refusée ; classer et rouvrir", async () => {
    const db = baseRadar();
    const report = { id: "r5", userId: "pro-1", status: "nouveau", cible: { type: "conversation", id: "kojipage:lead-1" } };
    assert.equal((await agir(report, "suspendre", { db, acces: fauxAcces() })).ok, false);
    await agir(report, "classer", { db, acces: fauxAcces(), maintenant: "2026-11-20T18:00:00Z" });
    assert.equal(report.status, "traité");
    await agir(report, "rouvrir", { db, acces: fauxAcces() });
    assert.equal(report.status, "nouveau");
    assert.equal((await agir(report, "effacer", { db, acces: fauxAcces() })).ok, false);
  });

  it("compte Supabase banni : seulement si banned_until est dans le futur", () => {
    const t = Date.parse("2026-11-20T18:00:00Z");
    assert.equal(banni({ banned_until: "2126-01-01T00:00:00Z" }, t), true);
    assert.equal(banni({ banned_until: "2026-01-01T00:00:00Z" }, t), false);
    assert.equal(banni({}, t), false);
  });
});

describe("appels internes back-office → site", () => {
  const cle = cleInterne("cle-de-test");
  it("une signature valide passe, un corps modifié ou trop vieux non", () => {
    const corps = JSON.stringify({ action: "classer", reportId: "r1" });
    const t = 1_800_000_000_000;
    const entete = signerInterne(corps, cle, t);
    assert.equal(verifierInterne(entete, corps, cle, t + 1000), true);
    assert.equal(verifierInterne(entete, corps.replace("classer", "suspendre"), cle, t), false);
    assert.equal(verifierInterne(entete, corps, cle, t + 6 * 60 * 1000), false);
    assert.equal(verifierInterne(entete, corps, cleInterne("autre"), t), false);
    assert.equal(verifierInterne("", corps, cle, t), false);
    assert.equal(cleInterne(""), null);
  });
});
