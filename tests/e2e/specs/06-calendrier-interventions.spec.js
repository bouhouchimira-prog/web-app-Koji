const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const { Key } = require("selenium-webdriver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

describe("Calendrier et interventions (E2E_WRITE requis)", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise || !config.write) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  it("calendrier : cree un evenement puis le supprime", async function () {
    const title = `E2E-evenement-${Date.now()}`;

    await h.goto(driver, "/calendrier");
    await h.clickWhenReady(driver, By.xpath("//div[contains(@class,'fournitures-dashboard-head-actions')]//button[contains(., 'Nouvel événement')]"));

    // startAt/endAt sont deja pre-remplis a "maintenant" par openCreateEvent() —
    // seul le titre est a saisir.
    const titleInput = await h.findByLabel(driver, "Titre de l'événement");
    await titleInput.sendKeys(title);
    await h.clickWhenReady(driver, By.xpath("//button[contains(@class,'mobile-primary')]"));

    const row = await h.waitVisible(driver, By.xpath(`//article[contains(@class,'calendar-row')][.//strong[normalize-space()=${JSON.stringify(title)}]]`), 20000);
    const deleteBtn = await row.findElement(By.css(".mini-danger"));
    await deleteBtn.click();

    const rows = await driver.findElements(By.xpath(`//article[contains(@class,'calendar-row')][.//strong[normalize-space()=${JSON.stringify(title)}]]`));
    assert.strictEqual(rows.length, 0, "L'evenement supprime ne devrait plus apparaitre.");
  });

  it("interventions : cree un rapport puis le supprime", async function () {
    const client = `E2E-client-intervention-${Date.now()}`;

    await h.goto(driver, "/interventions");
    await h.clickWhenReady(driver, By.xpath("//button[contains(., 'Nouvelle intervention')]"));

    const clientInput = await h.findByLabel(driver, "Client");
    await clientInput.sendKeys(client, Key.RETURN);

    // Ecran d'apercu -> "Générer le rapport".
    await h.clickWhenReady(driver, By.xpath("//button[contains(@class,'mobile-primary') and contains(., 'Générer')]"));

    const deleteBtn = await h.waitVisible(driver, By.css(".mini-danger"), 20000);
    await deleteBtn.click();

    await driver.wait(async () => {
      const rows = await driver.findElements(By.xpath(`//*[contains(., ${JSON.stringify(client)})]`));
      return rows.length === 0;
    }, 15000);
  });
});
