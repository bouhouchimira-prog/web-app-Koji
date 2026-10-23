const assert = require("assert");
const { By, until } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");

// Pages accessibles sans connexion — landing, connexion (2 profils),
// mot de passe oublie, inscription, mentions legales, portails ouvrier et
// signature, page de site publique inexistante, sitemap.xml.
describe("Espace public", function () {
  let driver;

  before(function () {
    driver = getDriver();
  });

  afterEach(async function () {
    await h.captureOnFailure(this, driver);
  });

  it("'/' affiche la landing visiteur (components/PublicLanding)", async function () {
    await h.clearSession(driver);
    await h.goto(driver, "/");
    await h.waitVisible(driver, By.css("main.ld"));
    await h.assertNoAppError(driver);
  });

  it("'/entreprise' affiche la landing Koji Pro (components/EntrepriseLanding)", async function () {
    await h.goto(driver, "/entreprise");
    await h.waitVisible(driver, By.css("main.ep"));
    await h.assertNoAppError(driver);
  });

  describe("Connexion entreprise (/login?type=entreprise)", function () {
    it("email invalide affiche une erreur a l'etape 1", async function () {
      await h.clearSession(driver);
      await h.goto(driver, "/login?type=entreprise");
      const emailInput = await h.waitClickable(driver, By.css("input[type='email'].auth-input-v2"));
      await emailInput.sendKeys("test@koji");
      await h.clickWhenReady(driver, By.css(".auth-btn-primary"));
      const errorEl = await h.waitVisible(driver, By.css(".auth-error"));
      assert.ok((await errorEl.getText()).length > 0, "Un message d'erreur devrait s'afficher.");
    });

    it("mauvais mot de passe affiche .auth-error a l'etape 2", async function () {
      if (!config.hasEntreprise) return this.skip();
      await h.clearSession(driver);
      await h.goto(driver, "/login?type=entreprise");
      const emailInput = await h.waitClickable(driver, By.css("input[type='email'].auth-input-v2"));
      await emailInput.sendKeys(config.entreprise.email);
      await h.clickWhenReady(driver, By.css(".auth-btn-primary"));
      const passwordInput = await h.waitClickable(driver, By.css("input[autocomplete='current-password']"));
      await passwordInput.sendKeys("un-mot-de-passe-definitivement-faux-123");
      await h.clickWhenReady(driver, By.css(".auth-btn-primary"));
      const errorEl = await h.waitVisible(driver, By.css(".auth-error"));
      assert.ok((await errorEl.getText()).length > 0);
    });

    it("l'onglet 'Créer un compte' mene a /signup?type=entreprise", async function () {
      await h.clearSession(driver);
      await h.goto(driver, "/login?type=entreprise");
      await h.clickWhenReady(driver, By.css("a.auth-mode-tab"));
      await driver.wait(until.urlContains("/signup"), 15000);
    });

    it("carte de bascule de profil mene vers l'espace particulier", async function () {
      await h.clearSession(driver);
      await h.goto(driver, "/login?type=entreprise");
      await h.clickWhenReady(driver, By.css(".auth-switch-card"));
      // Bascule en place (pas de navigation) : le badge "Espace particulier" apparait.
      await h.waitVisible(driver, By.css(".auth-eyebrow-badge.particulier"));
    });
  });

  describe("Connexion particulier (/login?type=particulier)", function () {
    it("mauvais mot de passe affiche .auth-error", async function () {
      if (!config.hasParticulier) return this.skip();
      await h.clearSession(driver);
      await h.goto(driver, "/login?type=particulier");
      const identifierInput = await h.waitClickable(driver, By.css("input[autocomplete='username']"));
      await identifierInput.sendKeys(config.particulier.email);
      const passwordInput = await h.waitClickable(driver, By.css("input[autocomplete='current-password']"));
      await passwordInput.sendKeys("un-mot-de-passe-definitivement-faux-123");
      await h.clickWhenReady(driver, By.css(".auth-btn-primary"));
      const errorEl = await h.waitVisible(driver, By.css(".auth-error"));
      assert.ok((await errorEl.getText()).length > 0);
    });

    it("bouton de connexion desactive si les champs sont vides", async function () {
      await h.clearSession(driver);
      await h.goto(driver, "/login?type=particulier");
      const submitBtn = await h.waitVisible(driver, By.css(".auth-btn-primary"));
      assert.strictEqual(await submitBtn.isEnabled(), false);
    });

    it("onglet 'Créer un compte' (sur place) + mot de passe < 8 caracteres affiche une erreur", async function () {
      await h.clearSession(driver);
      await h.goto(driver, "/login?type=particulier");
      const tabs = await driver.findElements(By.css(".auth-mode-tab"));
      assert.ok(tabs.length >= 2, "Les 2 onglets Connexion/Creer un compte devraient etre presents.");
      await tabs[1].click();
      const nameInput = await h.waitClickable(driver, By.css("input[autocomplete='name']"));
      await nameInput.sendKeys("Test E2E");
      const emailInput = await driver.findElement(By.css("input[autocomplete='email']"));
      await emailInput.sendKeys(`e2e-${Date.now()}@example.com`);
      const passwordInputs = await driver.findElements(By.css("input[autocomplete='new-password']"));
      await passwordInputs[0].sendKeys("short1");
      await passwordInputs[1].sendKeys("short1");
      await h.clickWhenReady(driver, By.css(".auth-btn-primary"));
      const errorEl = await h.waitVisible(driver, By.css(".auth-error"));
      assert.ok((await errorEl.getText()).length > 0);
    });
  });

  it("'/login' sans ?type= redirige vers '/'", async function () {
    await h.clearSession(driver);
    await h.goto(driver, "/login");
    await driver.wait(async () => (await driver.getCurrentUrl()) === h.fullUrl("/"), 15000);
  });

  it("'/forgot-password' affiche le formulaire de reinitialisation", async function () {
    await h.goto(driver, "/forgot-password?type=entreprise");
    await h.waitVisible(driver, By.css(".auth-screen input.auth-input"));
  });

  describe("'/signup?type=entreprise'", function () {
    it("mot de passe < 8 caracteres affiche une erreur a l'etape details", async function () {
      await h.clearSession(driver);
      await h.goto(driver, "/signup?type=entreprise");
      const emailInput = await h.waitClickable(driver, By.css("input[type='email'].auth-input-v2"));
      await emailInput.sendKeys(`e2e-${Date.now()}@example.com`);
      await h.clickWhenReady(driver, By.css(".auth-btn-primary"));
      const nameInput = await h.waitClickable(driver, By.css("input[autocomplete='name']"));
      await nameInput.sendKeys("Test E2E");
      const passwordInput = await driver.findElement(By.css("input[autocomplete='new-password']"));
      await passwordInput.sendKeys("short1");
      await h.clickWhenReady(driver, By.css(".auth-btn-primary"));
      const errorEl = await h.waitVisible(driver, By.css(".auth-error"));
      assert.ok((await errorEl.getText()).length > 0);
    });
  });

  it("'/legal' affiche les mentions legales", async function () {
    await h.goto(driver, "/legal");
    await h.waitVisible(driver, By.css("main.static-page"));
    await h.assertNoAppError(driver);
  });

  describe("'/worker' (portail ouvrier)", function () {
    it("mauvais identifiants affiche .worker-error", async function () {
      await h.clearSession(driver);
      await h.goto(driver, "/worker");
      const identifierInput = await h.waitClickable(driver, By.css(".worker-login-card input[placeholder='OUV-ABCDEF']"));
      await identifierInput.sendKeys("OUV-FAUXFAUX");
      const passwordInput = await driver.findElement(By.css(".worker-login-card input[type='password']"));
      await passwordInput.sendKeys("mauvais-mot-de-passe");
      await h.clickWhenReady(driver, By.css(".worker-login-card .worker-primary"));
      const errorEl = await h.waitVisible(driver, By.css(".worker-error"));
      assert.ok((await errorEl.getText()).length > 0);
    });
  });

  it("'/signature/login' affiche le formulaire d'acces signature", async function () {
    await h.goto(driver, "/signature/login");
    await h.waitVisible(driver, By.css("button.button.blue"));
  });

  it("'/signature/<token-bidon>' affiche un message d'erreur", async function () {
    await h.goto(driver, "/signature/token-completement-bidon-e2e");
    const errorEl = await h.waitVisible(driver, By.css(".empty-state"), 20000);
    assert.ok((await errorEl.getText()).length > 0);
  });

  it("'/site/<slug-inexistant>' affiche 'Page introuvable'", async function () {
    await h.goto(driver, "/site/slug-qui-nexiste-vraiment-pas-e2e");
    await driver.wait(until.elementLocated(By.xpath("//h1[normalize-space()='Page introuvable']")), 20000);
  });

  it("'/sitemap.xml' repond 200 en XML avec les routes publiques connues", async function () {
    const response = await fetch(h.fullUrl("/sitemap.xml"));
    assert.strictEqual(response.status, 200);
    const contentType = response.headers.get("content-type") || "";
    assert.ok(contentType.includes("xml"), `Content-Type inattendu : ${contentType}`);
    const body = await response.text();
    for (const path of ["/login", "/legal", "/aide", "/worker", "/signature/login"]) {
      assert.ok(body.includes(path), `sitemap.xml devrait contenir ${path}`);
    }
  });
});
