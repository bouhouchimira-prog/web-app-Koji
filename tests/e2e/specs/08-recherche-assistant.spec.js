const assert = require("assert");
const { By, Key } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

describe("Recherche globale et assistant koji", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
    await h.goto(driver, "/");
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  it("barre de recherche du haut : une requete renvoie au moins un resultat groupe", async function () {
    const searchInput = await h.waitClickable(driver, By.css(".topbar-search input"));
    await h.typeInto(driver, searchInput, "devis");
    const dropdown = await h.waitVisible(driver, By.css(".search-dropdown"), 15000);
    assert.ok((await dropdown.getText()).trim().length > 0, "La recherche devrait afficher au moins un groupe de resultats.");
  });

  it("ouverture du panneau assistant koji", async function () {
    await h.clickWhenReady(driver, By.css(".koji-assistant-bubble"));
    await h.waitVisible(driver, By.css(".koji-assistant-panel"), 15000);
  });

  it("envoi d'un message a l'assistant koji (E2E_AI requis)", async function () {
    if (!config.ai) return this.skip();
    await h.clickWhenReady(driver, By.css(".koji-assistant-bubble"));
    const input = await h.waitClickable(driver, By.css(".koji-assistant-bar input[type='text']"));
    await input.sendKeys("Resume mon activite recente en une phrase.", Key.RETURN);
    await h.waitVisible(driver, By.css(".koji-assistant-thread-row.koji-assistant-thread-assistant"), 30000);
  });
});
