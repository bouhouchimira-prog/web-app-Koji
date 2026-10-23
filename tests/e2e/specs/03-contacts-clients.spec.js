const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

describe("Contacts et clients (E2E_WRITE requis)", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise || !config.write) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  it("cree un contact, le retrouve par recherche, puis l'archive", async function () {
    const name = `E2E-${Date.now()}`;

    await h.goto(driver, "/contacts");
    await h.clickWhenReady(driver, By.css(".fournitures-dashboard-head-actions button.blue"));

    const lastNameInput = await h.findByLabel(driver, "Nom");
    await lastNameInput.sendKeys(name);
    await h.clickWhenReady(driver, By.css("button.mobile-primary"));

    // Retour a la liste : "Nouveau contact" doit avoir disparu (closeForm()).
    await h.waitVisible(driver, By.css(".fournitures-dashboard-head-actions button.blue"));

    const searchInput = await h.waitClickable(driver, By.css("input.supplier-search-input"));
    await h.typeInto(driver, searchInput, name);
    const row = await h.waitVisible(driver, By.xpath(`//div[contains(@class,'divers-purchase-row')][.//strong[contains(., ${JSON.stringify(name)})]]`));
    await row.click();

    await h.clickWhenReady(driver, By.xpath("//button[contains(@class,'button') and contains(@class,'secondary') and normalize-space()='Archiver']"));

    // Confirme l'archivage : reaffiche les contacts archives puis recherche a nouveau.
    const showArchivedCheckbox = await h.waitClickable(driver, By.css("input[type='checkbox']"));
    if (!(await showArchivedCheckbox.isSelected())) await showArchivedCheckbox.click();
    const searchAgain = await h.waitClickable(driver, By.css("input.supplier-search-input"));
    await h.typeInto(driver, searchAgain, name);
    const archivedRow = await h.waitVisible(driver, By.xpath(`//div[contains(@class,'divers-purchase-row')][.//strong[contains(., ${JSON.stringify(name)})]]`));
    assert.ok((await archivedRow.getText()).includes("Archivé"), "Le contact devrait apparaitre marque (Archivé).");
  });

  it("cree un client puis le supprime", async function () {
    const name = `E2E-${Date.now()}`;

    await h.goto(driver, "/clients");
    await h.clickWhenReady(driver, By.css("button.team-fab"));

    const lastNameInput = await h.findByLabel(driver, "Nom");
    await lastNameInput.sendKeys(name);
    await h.clickWhenReady(driver, By.css("button.mobile-primary"));

    await h.waitVisible(driver, By.css("button.team-fab"));
    const searchInput = await h.waitClickable(driver, By.css(".search-pill input"));
    await h.typeInto(driver, searchInput, name);
    const row = await h.waitVisible(driver, By.xpath(`//div[contains(@class,'person-row')][contains(., ${JSON.stringify(name)})]`));
    await row.click();

    await h.clickWhenReady(driver, By.xpath("//button[contains(@class,'button') and contains(@class,'danger') and normalize-space()='Supprimer']"));

    // Retour a la liste ; le client ne doit plus etre retrouvable.
    await h.waitVisible(driver, By.css("button.team-fab"));
    const searchAgain = await h.waitClickable(driver, By.css(".search-pill input"));
    await h.typeInto(driver, searchAgain, name);
    const rows = await driver.findElements(By.xpath(`//div[contains(@class,'person-row')][contains(., ${JSON.stringify(name)})]`));
    assert.strictEqual(rows.length, 0, "Le client supprime ne devrait plus apparaitre dans la recherche.");
  });
});
