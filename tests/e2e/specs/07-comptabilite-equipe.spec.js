const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise, loginWorker } = require("../support/auth");

describe("Comptabilite et equipe (E2E_WRITE requis)", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise || !config.write) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  it("comptabilite : ajoute une charge", async function () {
    const label = `E2E-charge-${Date.now()}`;

    await h.goto(driver, "/comptabilite");
    await h.clickWhenReady(driver, By.xpath("//button[contains(., 'Ajouter une charge')]"));

    const labelInput = await h.findByLabel(driver, "Libellé");
    await labelInput.sendKeys(label);
    const amountInput = await h.findByLabel(driver, "Montant (TTC)");
    await h.typeInto(driver, amountInput, "123.45");
    await h.clickWhenReady(driver, By.xpath("//form[contains(@class,'category-modal')]//button[@type='submit']"));

    await h.waitVisible(driver, By.xpath(`//div[contains(@class,'compta-ecriture-row')][.//strong[normalize-space()=${JSON.stringify(label)}]]`), 20000);
  });

  it("equipe : cree un ouvrier, recupere ses identifiants, et se connecte avec sur l'espace ouvrier", async function () {
    const name = `E2E-ouvrier-${Date.now()}`;

    await h.goto(driver, "/equipe");
    await h.clickWhenReady(driver, By.css("button.team-fab"));
    await h.clickWhenReady(driver, By.css(".team-quickadd-tile.tile-worker"));

    const nameInput = await h.findByLabel(driver, "Nom complet");
    await nameInput.sendKeys(name);
    await h.clickWhenReady(driver, By.css("button.mobile-primary"));

    // Apres creation, le panneau "Accès Koji" s'ouvre automatiquement avec
    // l'identifiant et le mot de passe generes.
    const loginIdInput = await h.waitVisible(driver, By.xpath("//label[.//span[normalize-space()='Identifiant de connexion']]//input"), 20000);
    const loginId = await loginIdInput.getAttribute("value");
    const passwordInput = await h.waitVisible(driver, By.xpath("//label[.//span[normalize-space()='Mot de passe']]//input"));
    const password = await passwordInput.getAttribute("value");
    assert.ok(loginId, "Un identifiant de connexion devrait avoir ete genere.");
    assert.ok(password, "Un mot de passe devrait avoir ete genere et affiche.");

    await loginWorker(driver, loginId, password);
    await h.waitVisible(driver, By.css(".worker-page"), 20000);
    await h.assertNoAppError(driver);
  });
});
