import assert from "node:assert/strict";
import {
  adresseMasquee, cleAdresse, empreinteCode, enregistrerDemande, genererCode, nettoyerCodes, peutEnvoyer, verifierCode,
  CODE_DUREE_MS, CODE_ESSAIS_MAX, ENVOI_INTERVALLE_MS, ENVOIS_PAR_HEURE
} from "../../lib/code-particulier.js";

// « Retrouver mon projet » par code reçu par e-mail (maquette CLI-05).
describe("Koji Client : code de connexion par e-mail (CLI-05)", () => {
  const secret = "secret-de-test";
  const t0 = Date.parse("2026-11-18T10:00:00.000Z");
  const demande = (code = "730512", maintenant = t0, entree) => enregistrerDemande(entree, { userId: "cli-1", code, sel: "sel1", secret, maintenant });

  it("tire un code de 6 chiffres, zéros compris, par la source cryptographique", () => {
    assert.equal(genererCode(() => 42), "000042");
    assert.equal(genererCode(() => 999999), "999999");
    for (let i = 0; i < 50; i += 1) assert.match(genererCode(), /^\d{6}$/);
  });

  it("ne garde jamais le code ni l'adresse en clair", () => {
    const e = demande();
    assert.ok(!JSON.stringify(e).includes("730512"));
    assert.equal(e.empreinte, empreinteCode("730512", "sel1", secret));
    assert.notEqual(empreinteCode("730512", "sel2", secret), e.empreinte);
    assert.notEqual(empreinteCode("730512", "sel1", "autre-secret"), e.empreinte);
    const cle = cleAdresse(" S.Lefevre@Exemple.fr ", secret);
    assert.equal(cle, cleAdresse("s.lefevre@exemple.fr", secret));
    assert.ok(!cle.includes("lefevre"));
  });

  it("accepte le bon code une seule fois, avant 10 minutes", () => {
    const e = demande();
    const r = verifierCode(e, "730 512", secret, t0 + CODE_DUREE_MS - 1);
    assert.equal(r.ok, true);
    assert.equal(r.userId, "cli-1");
    assert.equal(r.entree.empreinte, undefined);
    assert.equal(verifierCode(r.entree, "730512", secret, t0 + 1000).raison, "absent");
  });

  it("refuse un code expiré et l'efface", () => {
    const r = verifierCode(demande(), "730512", secret, t0 + CODE_DUREE_MS + 1);
    assert.deepEqual([r.ok, r.raison, r.entree.empreinte], [false, "expire", undefined]);
  });

  it("compte les essais faux et exige un nouveau code au 5e", () => {
    let e = demande();
    for (let i = 1; i < CODE_ESSAIS_MAX; i += 1) {
      const r = verifierCode(e, "000000", secret, t0 + i);
      assert.equal(r.raison, "faux");
      assert.equal(r.entree.essais, i);
      e = r.entree;
    }
    const cinquieme = verifierCode(e, "000000", secret, t0 + 10);
    assert.equal(cinquieme.raison, "epuise");
    assert.equal(cinquieme.entree.empreinte, undefined);
    assert.equal(verifierCode(cinquieme.entree, "730512", secret, t0 + 11).ok, false, "même le bon code ne passe plus");
  });

  it("adresse sans compte : mêmes réponses, essai par essai, que l'adresse existe ou non", () => {
    let connue = demande();
    let inconnue = enregistrerDemande(undefined, { secret, maintenant: t0 });
    assert.equal(inconnue.empreinte, undefined, "aucun code n'existe sans compte");
    for (let i = 1; i <= CODE_ESSAIS_MAX + 1; i += 1) {
      const a = verifierCode(connue, "000000", secret, t0 + i);
      const b = verifierCode(inconnue, "000000", secret, t0 + i);
      assert.equal(b.raison, a.raison, `essai ${i}`);
      connue = a.entree;
      inconnue = b.entree;
    }
    // Après 10 minutes : « expiré » des deux côtés.
    const c = verifierCode(demande(), "000000", secret, t0 + CODE_DUREE_MS + 1);
    const d = verifierCode(enregistrerDemande(undefined, { secret, maintenant: t0 }), "000000", secret, t0 + CODE_DUREE_MS + 1);
    assert.equal(d.raison, c.raison);
  });

  it("refuse un code mal formé sans planter", () => {
    assert.equal(verifierCode(demande(), "abc", secret, t0).raison, "faux");
    assert.equal(verifierCode(undefined, "730512", secret, t0).raison, "absent");
    assert.equal(verifierCode({ envois: [t0] }, "730512", secret, t0).raison, "absent");
  });

  it("un nouveau code remplace le précédent", () => {
    const premier = demande("111111", t0);
    const second = demande("222222", t0 + ENVOI_INTERVALLE_MS, premier);
    assert.equal(verifierCode(second, "111111", secret, t0 + ENVOI_INTERVALLE_MS + 1).ok, false);
    assert.equal(verifierCode(second, "222222", secret, t0 + ENVOI_INTERVALLE_MS + 1).ok, true);
    assert.equal(second.envois.length, 2);
  });

  it("limite les envois : 1 par minute, 5 par heure, même sans compte", () => {
    let e;
    assert.equal(peutEnvoyer(e, t0).ok, true);
    e = enregistrerDemande(e, { maintenant: t0 });
    assert.equal(e.empreinte, undefined, "pas de code pour une adresse inconnue");
    assert.equal(peutEnvoyer(e, t0 + 30 * 1000).ok, false);
    assert.equal(peutEnvoyer(e, t0 + ENVOI_INTERVALLE_MS).ok, true);
    for (let i = 1; i < ENVOIS_PAR_HEURE; i += 1) e = enregistrerDemande(e, { maintenant: t0 + i * ENVOI_INTERVALLE_MS });
    const bloque = peutEnvoyer(e, t0 + 10 * ENVOI_INTERVALLE_MS);
    assert.equal(bloque.ok, false);
    assert.ok(bloque.attenteMs > 0);
    assert.equal(peutEnvoyer(e, t0 + 60 * 60 * 1000 + 1).ok, true, "une heure après le premier envoi");
  });

  it("fait le ménage des entrées sans code valable ni envoi dans l'heure", () => {
    const codes = {
      actif: demande("123456", t0),
      vieux: { envois: [t0 - 2 * 60 * 60 * 1000] },
      envoiRecent: { envois: [t0 - 10 * 60 * 1000] }
    };
    const propre = nettoyerCodes(codes, t0 + 60 * 1000);
    assert.deepEqual(Object.keys(propre).sort(), ["actif", "envoiRecent"]);
    assert.deepEqual(Object.keys(nettoyerCodes(codes, t0 + 2 * 60 * 60 * 1000)), []);
  });

  it("masque l'adresse sur l'écran « Code reçu »", () => {
    assert.equal(adresseMasquee("S.Lefevre@exemple.fr"), "s••••@••••.fr");
    assert.equal(adresseMasquee("pas-une-adresse"), "");
  });
});
