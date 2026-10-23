const { buildDriver } = require("./driver");
const config = require("./config");

// Root hooks Mocha (charges via l'option "require" de .mocharc.cjs) : un
// seul navigateur Chrome construit avant toute la suite, ferme a la toute
// fin. global.__e2eDriver est lu par support/driver.js::getDriver(), que
// chaque spec appelle plutot que de gerer son propre cycle de vie.
exports.mochaHooks = {
  async beforeAll() {
    console.log(`\n[e2e] Base URL: ${config.baseUrl} | headless: ${config.headless} | E2E_WRITE: ${config.write} | E2E_AI: ${config.ai}`);
    if (!config.hasEntreprise) console.log("[e2e] E2E_ENTREPRISE_EMAIL/PASSWORD absents — tests entreprise authentifies ignores.");
    if (!config.hasParticulier) console.log("[e2e] E2E_PARTICULIER_EMAIL/PASSWORD absents — tests particulier authentifies ignores.");
    global.__e2eDriver = await buildDriver();
  },
  async afterAll() {
    if (global.__e2eDriver) {
      await global.__e2eDriver.quit();
      global.__e2eDriver = null;
    }
  }
};
