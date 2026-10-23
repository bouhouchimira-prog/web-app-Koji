const assert = require("assert");
const { By, Key } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

// Verifie le protocole de confirmation du chat "Avec l'IA" (22 oct,
// lib/devis-chat-prompt.js regle 10 + components/DevisChatPanel.jsx) :
// l'assistant ne doit jamais annoncer un changement comme fait avant que
// l'auto-enregistrement reel ait reussi. Necessite un vrai compte
// entreprise + E2E_WRITE (ecrit un vrai devis) + E2E_AI (appelle
// reellement Claude, payant) — sans ca, ce test est ignore.
describe("Devis 'Avec l'IA' — protocole de confirmation (E2E_WRITE + E2E_AI requis)", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise || !config.write || !config.ai) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  it("reste au conditionnel juste apres l'action, puis confirme avec les vraies valeurs une fois enregistre", async function () {
    await h.goto(driver, "/devis?new=1&mode=ia");
    await h.waitVisible(driver, By.css(".devis-chat-panel"), 20000);

    const input = await h.waitClickable(driver, By.css(".devis-chat-form input"));
    await input.sendKeys(
      "Ajoute 10m² de pose de carrelage 60x60 au sol dans la cuisine, c'est pour Jean Dupont.",
      Key.RETURN
    );

    // Premiere bulle assistant (intention/tentative) : jamais de langage de
    // succes confirme avant la boucle de confirmation.
    const firstBubble = await h.waitVisible(
      driver,
      By.xpath("(//div[contains(@class,'devis-chat-bubble-row') and not(contains(@class,'user'))])[2]//div[contains(@class,'devis-chat-bubble')]"),
      30000
    );
    const firstText = (await firstBubble.getText()).toLowerCase();
    for (const forbidden of ["c'est fait", "j'ai ajouté", "c'est enregistré", "ajouté au devis"]) {
      assert.ok(!firstText.includes(forbidden), `La premiere reponse ne devrait jamais annoncer un succes avant confirmation reelle (trouve: "${forbidden}" dans "${firstText}").`);
    }

    // La confirmation reelle arrive ensuite, automatiquement (pas de
    // nouvelle saisie) — attendre le mot de confirmation d'enregistrement
    // automatique cote UI, signe que la boucle onAutoSave -> [RESULTAT_ECRITURE]
    // -> reponse du modele est allee jusqu'au bout.
    await h.waitVisible(driver, By.css("p.devis-chat-save-notice"), 45000);

    // La derniere bulle assistant doit maintenant confirmer au passe
    // compose, avec de vraies valeurs (visibles aussi dans le panneau de
    // droite, verifie juste apres).
    const bubbles = await driver.findElements(By.css(".devis-chat-bubble-row:not(.user) .devis-chat-bubble"));
    const lastBubbleText = (await bubbles[bubbles.length - 1].getText()).toLowerCase();
    assert.ok(
      /enregistr|ajouté|c'est fait/.test(lastBubbleText),
      `La derniere reponse devrait confirmer l'enregistrement reel : "${lastBubbleText}"`
    );

    // Le tour synthetique "[RESULTAT_ECRITURE]" ne doit JAMAIS apparaitre
    // dans la conversation affichee (filtre `hidden`, voir DevisChatPanel.jsx).
    const threadText = (await driver.findElement(By.css(".devis-chat-thread")).getText());
    assert.ok(!threadText.includes("RESULTAT_ECRITURE"), "Le tour de confirmation interne ne doit jamais s'afficher dans le chat.");

    // Et la ligne doit reellement exister dans le devis (onglet Lots).
    await h.clickWhenReady(driver, By.xpath("//button[normalize-space()='Lots']"));
    await h.waitVisible(driver, By.xpath("//*[contains(translate(., 'CARRELAGE', 'carrelage'), 'carrelage')]"), 10000);
  });
});
