const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise, loginWorker } = require("../support/auth");

// Pas d'identifiants ouvrier fixes dans .env.e2e (la spec ne le demande
// pas) : comme pour l'equipe (voir 07), ce test cree un ouvrier jetable
// prefixe "E2E-" pour pouvoir se connecter avec de vrais identifiants.
describe("Espace ouvrier et signature", function () {
  let driver;

  before(function () {
    driver = getDriver();
  });

  afterEach(async function () {
    await h.captureOnFailure(this, driver);
  });

  it("tableau de bord ouvrier : connexion et affichage apres creation (E2E_WRITE requis)", async function () {
    if (!config.hasEntreprise || !config.write) return this.skip();
    const name = `E2E-ouvrier-sig-${Date.now()}`;

    await loginEntreprise(driver);
    await h.goto(driver, "/equipe");
    await h.clickWhenReady(driver, By.css("button.team-fab"));
    await h.clickWhenReady(driver, By.css(".team-quickadd-tile.tile-worker"));
    const nameInput = await h.findByLabel(driver, "Nom complet");
    await nameInput.sendKeys(name);
    await h.clickWhenReady(driver, By.css("button.mobile-primary"));

    const loginIdInput = await h.waitVisible(driver, By.xpath("//label[.//span[normalize-space()='Identifiant de connexion']]//input"), 20000);
    const loginId = await loginIdInput.getAttribute("value");
    const passwordInput = await h.waitVisible(driver, By.xpath("//label[.//span[normalize-space()='Mot de passe']]//input"));
    const password = await passwordInput.getAttribute("value");

    await loginWorker(driver, loginId, password);
    await h.waitVisible(driver, By.css(".worker-page"), 20000);
    await h.assertNoAppError(driver);

    // Tableau de bord : en-tete + navigation + sections chantiers/taches du
    // jour (meme sans chantier assigne, les sections et leur etat "vide"
    // doivent s'afficher).
    await h.waitVisible(driver, By.css(".worker-topbar"));
    await h.waitVisible(driver, By.css(".worker-nav"));
    const sections = await driver.findElements(By.css(".worker-section"));
    assert.ok(sections.length >= 2, "Le tableau de bord ouvrier devrait afficher au moins 2 sections (chantiers, taches du jour).");
  });

  it("'/signature/login' : bouton de connexion desactive si les champs sont vides", async function () {
    await h.clearSession(driver);
    await h.goto(driver, "/signature/login");
    const submitBtn = await h.waitVisible(driver, By.css("button.button.blue"));
    assert.strictEqual(await submitBtn.isEnabled(), false);
  });
});
