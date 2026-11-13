const assert = require("assert");
const { AUTH_LINK_REDIRECT_SOURCE } = require("../../lib/auth-link-redirect");

// Le code est inséré tel quel dans un <script> : on teste exactement ce texte.
const cibleLienAuth = new Function(`${AUTH_LINK_REDIRECT_SOURCE}; return cibleLienAuth;`)();

// Forme exacte du lien vu sur les téléphones le 13 nov (jetons raccourcis).
const RECOVERY = "#access_token=eyJhbGciOi.x.y&expires_at=1763058000&expires_in=3600&refresh_token=abc123&token_type=bearer&type=recovery";

describe("lib/auth-link-redirect", () => {
  it("lien de réinitialisation arrivé sur l'accueil → page Nouveau mot de passe, jeton conservé", () => {
    assert.strictEqual(cibleLienAuth("/", RECOVERY), `/set-password?mode=reset&type=entreprise${RECOVERY}`);
  });

  it("même lien arrivé sur une autre page du site", () => {
    assert.strictEqual(cibleLienAuth("/login", RECOVERY), `/set-password?mode=reset&type=entreprise${RECOVERY}`);
  });

  it("déjà sur /set-password : on ne bouge pas (pas de boucle)", () => {
    assert.strictEqual(cibleLienAuth("/set-password", RECOVERY), null);
  });

  it("lien expiré ou déjà utilisé sur l'accueil → Mot de passe oublié", () => {
    const erreur = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";
    assert.strictEqual(cibleLienAuth("/", erreur), "/forgot-password?type=entreprise");
    assert.strictEqual(cibleLienAuth("/entreprise", erreur), null);
  });

  it("rien à faire : pas de hash, ancre de page, confirmation d'inscription", () => {
    assert.strictEqual(cibleLienAuth("/", ""), null);
    assert.strictEqual(cibleLienAuth("/", "#"), null);
    assert.strictEqual(cibleLienAuth("/entreprise", "#tarifs"), null);
    assert.strictEqual(cibleLienAuth("/", "#access_token=x&type=signup"), null);
    assert.strictEqual(cibleLienAuth("/", "#type=recovery"), null);
  });
});
