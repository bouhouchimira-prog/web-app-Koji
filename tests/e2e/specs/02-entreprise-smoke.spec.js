const assert = require("assert");
const { By } = require("selenium-webdriver");
const { getDriver } = require("../support/driver");
const config = require("../support/config");
const h = require("../support/helpers");
const { loginEntreprise } = require("../support/auth");

// Test de fumee : chaque page entreprise charge, affiche un titre, pas
// d'erreur Next.js. Le compte de test peut ne pas avoir Koji Premium ni
// etre admin — dans ce cas components/Shell.jsx redirige certaines pages
// vers /abonnement, ce qui est un resultat ATTENDU ici, pas un echec (voir
// PREMIUM_PATHS dans Shell.jsx).
const PAGES = [
  "/", "/chantiers", "/chantier/new", "/devis", "/devis-ia/new", "/avenant",
  "/facturation", "/fournitures", "/fournitures/catalogue", "/bibliotheque-ouvrages",
  "/comptabilite", "/contacts", "/clients", "/equipe", "/calendrier", "/archives",
  "/corbeille", "/interventions", "/marketplace", "/notifications", "/profil",
  "/profil/carte-de-visite", "/profil/site-web", "/parametres", "/parametres/abonnement",
  "/business-info", "/chiffre-affaires", "/planning", "/profession-selection"
];

describe("Espace entreprise — fumee de toutes les pages", function () {
  let driver;

  before(async function () {
    if (!config.hasEntreprise) return this.skip();
    driver = getDriver();
    await loginEntreprise(driver);
  });

  afterEach(async function () {
    if (driver) await h.captureOnFailure(this, driver);
  });

  for (const pagePath of PAGES) {
    it(`'${pagePath}' charge sans erreur`, async function () {
      await h.goto(driver, pagePath);
      await driver.wait(async () => {
        const url = await driver.getCurrentUrl();
        if (url.includes("/abonnement")) return true;
        const h1s = await driver.findElements(By.css("h1"));
        for (const el of h1s) {
          if ((await el.getText()).trim().length > 0) return true;
        }
        return false;
      }, 20000, `Ni titre (h1) ni redirection /abonnement sur '${pagePath}'.`);
      await h.assertNoAppError(driver);
    });
  }
});
