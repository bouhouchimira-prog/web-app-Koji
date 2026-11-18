import assert from "node:assert/strict";
import { champsSignes, erreurSignature, imageSignatureValide, mentionTvaAttendue, preuveDeRequete, regleSignature, TEXTE_PREUVE } from "../../lib/signature-devis.js";
import { MENTION_TAUX_REDUIT } from "../../lib/tva.js";

// Signature d'un devis par le particulier (CLI-02 onglet Devis, CLI-07 lien) :
// mêmes règles aux deux endroits (PRO-03.5, PRO-03.6, PRO-03.7).
describe("Koji Client : règles de signature du devis (CLI-02, CLI-07)", () => {
  const image = `data:image/png;base64,${"A".repeat(400)}`;
  const devis = (plus = {}) => ({ id: "q1", status: "Envoye", clientType: "particulier", vatRate: 10, client: "Sophie Lefèvre", clientEmail: "Sophie@Exemple.fr", startDate: "2026-11-24", items: [], ...plus });

  it("rien n'est coché d'avance ; la mention TVA suit le taux réduit", () => {
    const r = regleSignature(devis(), { aujourdhui: "2026-11-18" });
    assert.equal(r.mentionTva.libelle, "Logement de plus de 2 ans, à usage d'habitation (TVA 10 %)");
    assert.equal(r.mentionTva.texte, MENTION_TAUX_REDUIT);
    assert.equal(r.finRetractation, "2026-12-02");
    assert.match(r.retractation, /jusqu'au 2 décembre inclus/);
    assert.match(r.demarrage.libelle, /^Je demande que les travaux commencent le 24 novembre/);
    assert.equal(r.preuve, TEXTE_PREUVE);
    assert.ok(!/manuscrite/.test(JSON.stringify(r)), "pas d'équivalence juridique affirmée");
    assert.match(regleSignature(devis({ vatRate: 5.5 }), { aujourdhui: "2026-11-18" }).mentionTva.libelle, /TVA 5,5 %/);
    assert.equal(regleSignature(devis({ vatRate: 20 }), { aujourdhui: "2026-11-18" }).mentionTva, null);
    assert.equal(regleSignature(devis({ autoliquidation: true }), { aujourdhui: "2026-11-18" }).mentionTva, null);
  });

  it("démarrage anticipé proposé seulement si le début tombe dans le délai ; pas pour une société", () => {
    assert.equal(regleSignature(devis({ startDate: "2026-12-15" }), { aujourdhui: "2026-11-18" }).demarrage, null);
    const pro = regleSignature(devis({ clientType: "societe" }), { aujourdhui: "2026-11-18" });
    assert.equal(pro.retractation, "");
    assert.equal(pro.demarrage, null);
  });

  it("un devis signé, rétracté ou annulé ne se signe plus", () => {
    assert.equal(regleSignature(devis({ signatureStatus: "Signe" })), null);
    assert.equal(regleSignature(devis({ retracteLe: "2026-11-10" })), null);
    assert.equal(regleSignature(devis({ status: "Annule" })), null);
  });

  it("refuse une signature incomplète, dans l'ordre de l'écran", () => {
    const ok = { consent: true, mentionTva: true, signerName: "Sophie", signature: image };
    assert.equal(erreurSignature(devis(), ok), "");
    assert.match(erreurSignature(devis(), { ...ok, consent: false }), /J'ai lu le devis/);
    assert.match(erreurSignature(devis(), { ...ok, mentionTva: false }), /TVA à taux réduit/);
    assert.equal(erreurSignature(devis({ vatRate: 20 }), { ...ok, mentionTva: false }), "");
    assert.match(erreurSignature(devis(), { ...ok, signature: "" }), /Signez dans le cadre/);
    assert.ok(mentionTvaAttendue(devis({ vatRate: 20, items: [{ tauxTva: 5.5 }] })));
  });

  it("n'accepte qu'une image PNG de taille raisonnable", () => {
    assert.ok(imageSignatureValide(image));
    assert.ok(!imageSignatureValide("data:image/svg+xml;base64,AAAA"));
    assert.ok(!imageSignatureValide(`data:image/png;base64,${"A".repeat(400001)}`));
    assert.ok(!imageSignatureValide("data:image/png;base64,AAAA"));
  });

  it("enregistre la signature en ligne avec ses preuves", () => {
    const now = "2026-11-18T09:12:00.000Z";
    const preuve = preuveDeRequete(new Map([["x-forwarded-for", "203.0.113.7, 10.0.0.1"], ["user-agent", "Navigateur"]]), now);
    assert.deepEqual(preuve, { le: now, ip: "203.0.113.7", appareil: "Navigateur" });
    const c = champsSignes(devis(), { signerName: "Sophie Lefèvre", mentionTva: true, demandeExpresse: true, consent: true, signature: image }, { now, preuve, origine: "espace" });
    assert.equal(c.status, "Signe");
    assert.equal(c.signatureLieu, "en-ligne");
    assert.equal(c.signerEmail, "sophie@exemple.fr");
    assert.equal(c.retractationJusquau, "2026-12-02");
    assert.equal(c.demarrageDemande, "2026-11-24");
    assert.deepEqual(c.consentements, { demandeExpresse: now, mentionTva: now, exemplaireEmail: "" });
    assert.equal(c.mentionTvaLe, now);
    assert.equal(c.signatureImage, image);
    assert.equal(c.preuveSignature.origine, "espace Koji Client");
    // Demande expresse ignorée quand le début est après le délai.
    const tard = champsSignes(devis({ startDate: "2026-12-20" }), { demandeExpresse: true, consent: true, signature: image }, { now });
    assert.equal(tard.demarrageDemande, "");
    assert.equal(tard.consentements.demandeExpresse, "");
  });
});
