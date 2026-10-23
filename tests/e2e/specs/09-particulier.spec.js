const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginParticulier } = require("../support/auth");

// Smoke test de l'espace particulier. Important : on ne publie JAMAIS une
// vraie demande sur le Marketplace (Radar des Chantiers) depuis ces tests —
// /client/radar/new est uniquement teste jusqu'au choix du mode (IA/manuel),
// jamais jusqu'a l'envoi.
const PAGES = [
  "/client", "/client/chantiers", "/client/devis", "/client/messages",
  "/client/notifications", "/client/profil", "/client/parametres", "/client/aide", "/client/radar"
];

describe("Espace particulier", function () {
  let driver;

  before(async function () {
    if (!config.hasParticulier) return this.skip();
    driver = getDriver();
    await loginParticulier(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  for (const pagePath of PAGES) {
    it(`'${pagePath}' charge sans erreur`, async function () {
      await h.goto(driver, pagePath);
      await h.waitVisible(driver, By.css("main.client-space"), 20000);
      await h.assertNoAppError(driver);
    });
  }

  it("'/client/radar/new' : les 2 modes (IA/manuel) sont selectionnables sans jamais publier", async function () {
    await h.goto(driver, "/client/radar/new");
    const tabs = await driver.findElements(By.css(".radar-mode-tab"));
    assert.strictEqual(tabs.length, 2, "Les 2 onglets de mode (IA/manuel) devraient etre presents.");

    await tabs[1].click(); // manuel
    await h.waitVisible(driver, By.css(".radar-form-card"));
    await h.assertNoAppError(driver);

    await tabs[0].click(); // ia
    await h.waitVisible(driver, By.css(".radar-form-card"));
    await h.assertNoAppError(driver);
  });
});
