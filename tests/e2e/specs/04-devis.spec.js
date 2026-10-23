const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

describe("Chantier et devis (E2E_WRITE requis)", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise || !config.write) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  it("'/chantier/new' : un brouillon avec titre mene a l'editeur de devis", async function () {
    await h.goto(driver, "/chantier/new");
    const titleInput = await h.waitClickable(driver, By.css(".wizard-field.full input"));
    await titleInput.sendKeys(`E2E-${Date.now()}`);
    await h.clickWhenReady(driver, By.css("button.wizard-primary"));
    await driver.wait(async () => (await driver.getCurrentUrl()).includes("/devis"), 15000);
    await h.assertNoAppError(driver);
  });

  it("devis manuel : ajoute un ouvrage cree sur place, renseigne le client, Enregistrer -> 'genere'", async function () {
    const label = `E2E-ouvrage-${Date.now()}`;
    const clientName = `E2E-client-${Date.now()}`;

    await h.goto(driver, "/devis?new=1&mode=manuel");
    await h.assertNoAppError(driver);

    // Onglet "Bibliothèque d'ouvrages" -> "Créer une ouvrage".
    await h.clickWhenReady(driver, By.xpath("//button[normalize-space()=\"Bibliothèque d'ouvrages\"]"));
    await h.clickWhenReady(driver, By.xpath("//button[contains(., 'Créer une ouvrage')]"));

    const designationInput = await h.findByLabel(driver, "Désignation");
    await designationInput.sendKeys(label);
    const priceInput = await h.findByLabel(driver, "Prix HT");
    await h.typeInto(driver, priceInput, "100");
    await h.clickWhenReady(driver, By.xpath("//div[contains(@class,'quote-picker-inline-form')]//button[contains(@class,'blue')]"));

    // La ligne doit apparaitre dans le devis (onglet "Lots").
    await h.clickWhenReady(driver, By.xpath("//button[normalize-space()='Lots']"));
    await h.waitVisible(driver, By.xpath(`//*[contains(., ${JSON.stringify(label)})]`));

    // Onglet "Client" -> "Modifier" -> renseigner le nom.
    await h.clickWhenReady(driver, By.xpath("//button[normalize-space()='Client']"));
    await h.clickWhenReady(driver, By.xpath("//section[contains(@class,'quote-client-card')]//button[normalize-space()='Modifier']"));
    const lastNameInput = await h.findByLabel(driver, "Nom");
    await lastNameInput.sendKeys(clientName);
    await h.clickWhenReady(driver, By.css(".quote-identity-save-btn"));

    // En-tete : "Enregistrer" -> message de succes "... généré".
    await h.clickWhenReady(driver, By.xpath("//div[contains(@class,'quote-final-actions')]/button[normalize-space()='Enregistrer']"));
    const messageEl = await h.waitVisible(driver, By.css("p.profile-message.success"), 20000);
    assert.ok((await messageEl.getText()).includes("généré"), "Le message devrait confirmer la generation du devis.");
  });
});
