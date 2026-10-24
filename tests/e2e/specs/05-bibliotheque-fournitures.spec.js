const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

describe("Fournitures et bibliotheque koji (E2E_WRITE requis)", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise || !config.write) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  it("catalogue fournitures : ajoute puis supprime une fourniture", async function () {
    const name = `E2E-fourniture-${Date.now()}`;

    await h.goto(driver, "/fournitures/catalogue");
    await h.clickWhenReady(driver, By.xpath("//button[contains(., 'Ajouter une fourniture')]"));

    const nameInput = await h.findByLabel(driver, "Description");
    await nameInput.sendKeys(name);
    await h.clickWhenReady(driver, By.xpath("//button[contains(@class,'mobile-primary') and normalize-space()='Créer la fourniture']"));

    // Retour a la liste.
    const row = await h.waitVisible(driver, By.xpath(`//article[contains(@class,'supply-row')][.//strong[normalize-space()=${JSON.stringify(name)}]]`), 20000);
    const deleteBtn = await row.findElement(By.css(".mini-danger"));
    await deleteBtn.click();

    const rows = await driver.findElements(By.xpath(`//article[contains(@class,'supply-row')][.//strong[normalize-space()=${JSON.stringify(name)}]]`));
    assert.strictEqual(rows.length, 0, "La fourniture supprimee ne devrait plus apparaitre.");
  });

  it("bibliotheque koji : cree puis supprime un tarif personnalise", async function () {
    const family = `E2E-famille-${Date.now()}`;
    const label = `Ouvrage test E2E ${Date.now()}`;

    await h.goto(driver, "/bibliotheque-ouvrages");
    await h.clickWhenReady(driver, By.xpath("//button[contains(., 'Créer un tarif personnalisé')]"));

    const designationInput = await h.findByLabel(driver, "Désignation");
    await designationInput.sendKeys(label);
    const familyInput = await h.findByLabel(driver, "Famille");
    await h.clearControlledInput(driver, familyInput);
    await familyInput.sendKeys(family);
    await h.clickWhenReady(driver, By.xpath("//footer[contains(@class,'biblio-modal-footer')]//button[contains(., 'Enregistrer le tarif')]"));

    const row = await h.waitVisible(driver, By.xpath(`//div[contains(@class,'biblio-row')][.//div[contains(@class,'biblio-label')][normalize-space()=${JSON.stringify(label)}]]`), 20000);
    const deleteBtn = await row.findElement(By.css(".mini-danger"));
    await deleteBtn.click();
    await driver.switchTo().alert().accept();

    const rows = await driver.findElements(By.xpath(`//div[contains(@class,'biblio-row')][.//div[contains(@class,'biblio-label')][normalize-space()=${JSON.stringify(label)}]]`));
    assert.strictEqual(rows.length, 0, "Le tarif supprime ne devrait plus apparaitre.");
  });
});
