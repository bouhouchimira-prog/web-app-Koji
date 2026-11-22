const assert = require("assert");
const { appDuLien, appDepuisJeton, NOM_APP } = require("../../lib/reset-app");

const jeton = (userMetadata) =>
  `x.${Buffer.from(JSON.stringify({ sub: "u1", user_metadata: userMetadata })).toString("base64url")}.y`;

describe("lib/reset-app", () => {
  it("l'app le dit elle-même : on la croit", () => {
    assert.strictEqual(appDuLien({ demande: "koji", isPro: true }), "koji");
    assert.strictEqual(appDuLien({ demande: "pro", isPro: false }), "pro");
  });

  it("compte particulier : toujours l'app Koji (pas d'espace sur le site Pro)", () => {
    assert.strictEqual(appDuLien({ isPro: false, userAgent: "Mozilla/5.0" }), "koji");
    assert.strictEqual(appDuLien({ isPro: false, userAgent: "Dart/3.6 (dart:io)" }), "koji");
  });

  it("app Koji Pro ≤ 74 (client HTTP Dart, pas de paramètre) : Koji Pro", () => {
    assert.strictEqual(appDuLien({ isPro: true, userAgent: "Dart/3.6 (dart:io)" }), "pro");
    assert.strictEqual(appDuLien({ userAgent: "dart/3.9" }), "pro");
  });

  it("demande faite sur le site : comportement du site", () => {
    assert.strictEqual(appDuLien({ isPro: true, userAgent: "Mozilla/5.0 (iPhone)" }), null);
    assert.strictEqual(appDuLien({ demande: "autre", isPro: true }), null);
    assert.strictEqual(appDuLien(), null);
  });

  it("lien Supabase des anciennes apps : le jeton dit particulier ou Pro", () => {
    assert.strictEqual(appDepuisJeton(jeton({ is_pro: false })), "koji");
    assert.strictEqual(appDepuisJeton(jeton({ is_pro: true })), "pro");
    assert.strictEqual(appDepuisJeton(jeton({ name: "Imed Lachiheb" })), "pro");
    assert.strictEqual(appDepuisJeton(jeton({ name: "Élodie Ç" })), "pro");
    assert.strictEqual(appDepuisJeton("pas-un-jeton"), null);
    assert.strictEqual(appDepuisJeton(""), null);
  });

  it("noms affichés", () => {
    assert.deepStrictEqual(NOM_APP, { koji: "Koji", pro: "Koji Pro" });
  });
});

describe("lib/reset-app — demandes répétées", () => {
  const { jetonResetReutilisable, RESET_MARGE_REUTILISATION_MS } = require("../../lib/reset-app");
  const T0 = Date.parse("2026-11-21T22:44:34.000Z");
  const dans = (minutes) => new Date(T0 + minutes * 60 * 1000).toISOString();

  it("deuxième demande 90 secondes après : même lien, le premier e-mail reste valable", () => {
    assert.strictEqual(jetonResetReutilisable("reset-1-abc", dans(28.5), T0), true);
  });

  it("jeton proche de sa fin ou expiré : nouveau lien", () => {
    assert.strictEqual(jetonResetReutilisable("reset-1-abc", dans(14), T0), false);
    assert.strictEqual(jetonResetReutilisable("reset-1-abc", dans(-5), T0), false);
  });

  it("limite exacte : 15 minutes restantes suffisent", () => {
    assert.strictEqual(jetonResetReutilisable("reset-1-abc", new Date(T0 + RESET_MARGE_REUTILISATION_MS).toISOString(), T0), true);
  });

  it("pas de jeton, pas de date ou date illisible : nouveau lien", () => {
    assert.strictEqual(jetonResetReutilisable(null, dans(30), T0), false);
    assert.strictEqual(jetonResetReutilisable("reset-1-abc", null, T0), false);
    assert.strictEqual(jetonResetReutilisable("reset-1-abc", "n'importe quoi", T0), false);
    assert.strictEqual(jetonResetReutilisable(undefined, undefined), false);
  });
});
