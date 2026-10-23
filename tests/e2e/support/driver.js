const { Builder, Browser } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const config = require("./config");

// Un seul driver Chrome pour toute la suite (plus rapide qu'un par test),
// ferme dans le hook global after() de .mocharc.cjs. Fenetre fixe
// 1440x900 (demande explicite) : certains menus/boutons de Shell.jsx se
// reorganisent sous un breakpoint mobile, on veut toujours tester la vue
// desktop ici.
async function buildDriver() {
  const options = new chrome.Options();
  options.addArguments("--window-size=1440,900");
  options.addArguments("--lang=fr-FR");
  // Les tests cliquent toujours via WebDriverWait + ExpectedConditions,
  // jamais en devinant un delai — ce flag evite juste les popups natifs
  // (ex: "Chrome controle par un logiciel de test") qui peuvent gener en
  // mode non-headless.
  options.excludeSwitches("enable-automation");
  if (config.headless) {
    options.addArguments("--headless=new");
    options.addArguments("--disable-gpu");
  }

  const driver = await new Builder()
    .forBrowser(Browser.CHROME)
    .setChromeOptions(options)
    .build();

  await driver.manage().setTimeouts({ implicit: 0 });
  return driver;
}

// Singleton pose par root-hooks.js (un seul Chrome pour toute la suite) —
// les specs le recuperent via getDriver() plutot que de reconstruire le
// leur, pour rester rapides et partager cookies/localStorage nettoyes par
// support/auth.js entre chaque connexion.
function getDriver() {
  if (!global.__e2eDriver) {
    throw new Error("Driver Selenium non initialise — verifiez que tests/e2e/support/root-hooks.js est bien charge via .mocharc.cjs (option 'require').");
  }
  return global.__e2eDriver;
}

module.exports = { buildDriver, getDriver };
