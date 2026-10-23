const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

// 3 bugs reperes en lisant le code avant d'ecrire cette suite (voir echange
// de planification) — chaque test affirme le comportement ATTENDU (correct).
// Un echec ici confirme le bug ; un succes signifie qu'il a ete corrige.
describe("Bugs connus (a confirmer)", function () {
  let driver;

  before(function () {
    driver = getDriver();
  });

  afterEach(async function () {
    await h.captureOnFailure(this, driver);
  });

  it("BUG #1 — '/login?type=ouvrier' ne devrait pas renvoyer silencieusement vers '/'", async function () {
    // app/equipe/page.jsx genere ce lien pour les ouvriers, mais
    // app/login/page.jsx ne reconnait que type=entreprise|particulier :
    // typeParam inconnu -> profile=null -> redirection vers "/".
    await h.clearSession(driver);
    await h.goto(driver, "/login?type=ouvrier");
    await driver.sleep(1500); // laisse le temps a une eventuelle redirection client-side
    const url = await driver.getCurrentUrl();
    assert.notStrictEqual(url, h.fullUrl("/"), "'/login?type=ouvrier' redirige vers '/' au lieu d'afficher une connexion ouvrier.");
  });

  it("BUG #2 — '/aide' est declaree publique dans le sitemap mais exige une connexion", async function () {
    // app/sitemap.ts affirme (dans son propre commentaire) qu'aucune page
    // listee n'importe Shell — faux pour app/aide/page.jsx, qui l'importe et
    // redirige donc vers /login comme n'importe quelle page entreprise.
    await h.clearSession(driver);
    await h.goto(driver, "/aide");
    await driver.sleep(1500);
    const url = await driver.getCurrentUrl();
    assert.ok(!url.includes("/login"), "'/aide' devrait etre accessible sans connexion (declaree publique dans sitemap.ts).");
  });

  it("BUG #3 — la bibliotheque koji ne devrait pas masquer un ouvrage d'une autre famille lors d'une recherche", async function () {
    if (!config.hasEntreprise || !config.write) return this.skip();
    // Au chargement, useState("") + le useEffect "if (!family) setFamily(families[0])"
    // selectionne TOUJOURS la premiere famille (jamais "toutes") ; le filtre
    // croise family ET query en ET logique, donc un ouvrage d'une autre
    // famille que celle auto-selectionnee n'est jamais trouve par la
    // recherche, sans aucun indice visuel qu'un filtre restreint la vue.
    await loginEntreprise(driver);

    const label = `E2E-bug3-${Date.now()}`;
    await h.goto(driver, "/bibliotheque-ouvrages");
    await h.clickWhenReady(driver, By.css("button.library-add"));

    const codeInput = await h.findByLabel(driver, "Code");
    await codeInput.sendKeys(`E2E-${Date.now()}`);
    const designationInput = await h.findByLabel(driver, "Désignation", "textarea");
    await designationInput.sendKeys(label);
    // Famille volontairement en minuscules ("zzz-...") : toutes les
    // familles reelles de l'app commencent par une majuscule, donc elle ne
    // peut jamais etre choisie par erreur comme "premiere famille" (ordre
    // alphabetique, majuscules < minuscules en JS).
    const familyInput = await h.findByLabel(driver, "Famille");
    await h.clearControlledInput(driver, familyInput);
    await familyInput.sendKeys("zzz-e2e-bug3");
    await h.clickWhenReady(driver, By.xpath("//button[contains(@class,'library-submit')]"));

    // Nouveau chargement "a froid" du tableau de bord : reproduit exactement
    // le scenario du bug (useState("") puis l'auto-selection de la premiere
    // famille au montage).
    await h.goto(driver, "/bibliotheque-ouvrages");
    const searchInput = await h.waitClickable(driver, By.css("input.library-search"));
    await h.typeInto(driver, searchInput, label);

    const results = await driver.findElements(By.xpath(`//article[contains(@class,'library-card')][.//h3[normalize-space()=${JSON.stringify(label)}]]`));
    assert.strictEqual(results.length, 1, "L'ouvrage devrait etre trouve par la recherche meme s'il appartient a une autre famille que celle auto-selectionnee.");
  });
});
