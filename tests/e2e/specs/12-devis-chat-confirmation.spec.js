const assert = require("assert");
const { By, Key } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

// Verifie le workflow complet du chat "Avec l'IA" (22-23 oct,
// lib/devis-chat-prompt.js) : propose puis attend l'accord AVANT d'ecrire
// (regle 5), puis reste au conditionnel jusqu'a une confirmation reelle
// APRES ecriture (regle 10 + components/DevisChatPanel.jsx). Necessite un
// vrai compte entreprise + E2E_WRITE (ecrit un vrai devis) + E2E_AI
// (appelle reellement Claude, payant) — sans ca, ce test est ignore.
describe("Devis 'Avec l'IA' — proposer puis confirmer (E2E_WRITE + E2E_AI requis)", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise || !config.write || !config.ai) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  async function assistantBubbles() {
    const bubbles = await driver.findElements(By.css(".devis-chat-bubble-row:not(.user) .devis-chat-bubble"));
    const texts = [];
    for (const bubble of bubbles) texts.push((await bubble.getText()).toLowerCase());
    return texts;
  }

  function assertNoWriteConfirmationLanguage(text, context) {
    for (const forbidden of ["c'est fait", "j'ai ajouté", "c'est enregistré", "ajouté au devis"]) {
      assert.ok(!text.includes(forbidden), `${context} : ne devrait jamais annoncer un succes avant confirmation reelle (trouve "${forbidden}" dans "${text}").`);
    }
  }

  it("ne propose qu'une recherche + une question avant tout accord, n'ecrit qu'apres le 'oui', puis confirme avec les vraies valeurs", async function () {
    await h.goto(driver, "/devis?new=1&mode=ia");
    await h.waitVisible(driver, By.css(".devis-chat-panel"), 20000);

    const input = await h.waitClickable(driver, By.css(".devis-chat-form input"));
    await input.sendKeys(
      "Ajoute 10m² de pose de carrelage 60x60 au sol dans la cuisine, c'est pour Jean Dupont.",
      Key.RETURN
    );

    // Premiere bulle assistant : une PROPOSITION (lot/designation/quantite/
    // unite/prix + une question de validation) — jamais une ecriture directe.
    const proposalBubble = await h.waitVisible(
      driver,
      By.xpath("(//div[contains(@class,'devis-chat-bubble-row') and not(contains(@class,'user'))])[2]//div[contains(@class,'devis-chat-bubble')]"),
      30000
    );
    const proposalText = (await proposalBubble.getText()).toLowerCase();
    assertNoWriteConfirmationLanguage(proposalText, "La proposition initiale");
    assert.ok(proposalText.includes("?"), `La proposition devrait se terminer par une question de validation : "${proposalText}"`);

    // Aucune ligne ne doit exister tant que l'accord n'a pas ete donne.
    await h.clickWhenReady(driver, By.xpath("//button[normalize-space()='Lots']"));
    const beforeConfirm = await driver.findElements(By.xpath("//*[contains(translate(., 'CARRELAGE', 'carrelage'), 'carrelage')]"));
    assert.strictEqual(beforeConfirm.length, 0, "Aucune ligne de carrelage ne devrait exister avant la confirmation de l'entreprise.");

    // Accord explicite.
    const inputAgain = await h.waitClickable(driver, By.css(".devis-chat-form input"));
    await inputAgain.sendKeys("Oui, vas-y.", Key.RETURN);

    // Apres le "oui", l'ecriture se declenche : la reponse immediate reste
    // au conditionnel (regle 10), puis l'auto-enregistrement reel confirme.
    await h.waitVisible(driver, By.css("p.devis-chat-save-notice"), 45000);

    const bubbles = await assistantBubbles();
    const lastBubbleText = bubbles[bubbles.length - 1];
    assert.ok(
      /enregistr|ajouté|c'est fait/.test(lastBubbleText),
      `La derniere reponse devrait confirmer l'enregistrement reel : "${lastBubbleText}"`
    );

    // Le tour synthetique "[RESULTAT_ECRITURE]" ne doit JAMAIS apparaitre
    // dans la conversation affichee (filtre `hidden`, voir DevisChatPanel.jsx).
    const threadText = await driver.findElement(By.css(".devis-chat-thread")).getText();
    assert.ok(!threadText.includes("RESULTAT_ECRITURE"), "Le tour de confirmation interne ne doit jamais s'afficher dans le chat.");

    // Et la ligne doit maintenant reellement exister dans le devis.
    await h.waitVisible(driver, By.xpath("//*[contains(translate(., 'CARRELAGE', 'carrelage'), 'carrelage')]"), 10000);
  });
});
