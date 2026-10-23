const { By, until } = require("selenium-webdriver");
const config = require("./config");
const { goto, clearSession, waitClickable, clickWhenReady } = require("./helpers");

async function waitLeftLogin(driver, timeout = 20000) {
  await driver.wait(async () => !(await driver.getCurrentUrl()).includes("/login"), timeout);
}

// Connexion entreprise : flux en 2 etapes (email -> mot de passe), voir
// components/EntrepriseLogin.jsx. Lance depuis une session deja nettoyee
// (clearSession) pour ne jamais reutiliser un compte "connu" affiche par
// l'ecran (liste des comptes recents).
async function loginEntreprise(driver, email = config.entreprise.email, password = config.entreprise.password) {
  await clearSession(driver);
  await goto(driver, "/login?type=entreprise");

  const emailInput = await waitClickable(driver, By.css("input[type='email'].auth-input-v2"));
  await emailInput.sendKeys(email);
  await clickWhenReady(driver, By.css(".auth-btn-primary"));

  const passwordInput = await waitClickable(driver, By.css("input[autocomplete='current-password']"));
  await passwordInput.sendKeys(password);
  await clickWhenReady(driver, By.css(".auth-btn-primary"));

  await waitLeftLogin(driver);
}

// Connexion particulier : formulaire a un seul ecran (identifiant +
// mot de passe), voir app/login/page.jsx::ParticulierLogin. Redirige vers
// /client (compte particulier) ou /worker (si c'est en realite un ouvrier
// qui se connecte avec ses identifiants OUV sur ce meme formulaire).
async function loginParticulier(driver, email = config.particulier.email, password = config.particulier.password) {
  await clearSession(driver);
  await goto(driver, "/login?type=particulier");

  const identifierInput = await waitClickable(driver, By.css("input[autocomplete='username']"));
  await identifierInput.sendKeys(email);
  const passwordInput = await waitClickable(driver, By.css("input[autocomplete='current-password']"));
  await passwordInput.sendKeys(password);
  await clickWhenReady(driver, By.css(".auth-btn-primary"));

  await waitLeftLogin(driver);
}

// Connexion ouvrier : app/worker/page.jsx, formulaire propre (pas le meme
// que /login). loginId/temporaryPassword viennent typiquement de la
// creation d'un ouvrier (app/equipe/page.jsx) dans le meme passage de tests.
async function loginWorker(driver, loginId, password) {
  await clearSession(driver);
  await goto(driver, "/worker");

  const identifierInput = await waitClickable(driver, By.css(".worker-login-card input[placeholder='OUV-ABCDEF']"));
  await identifierInput.sendKeys(loginId);
  const passwordInput = await waitClickable(driver, By.css(".worker-login-card input[type='password']"));
  await passwordInput.sendKeys(password);
  await clickWhenReady(driver, By.css(".worker-login-card .worker-primary"));

  await driver.wait(until.elementLocated(By.css(".worker-page, .worker-error")), 20000);
}

module.exports = { loginEntreprise, loginParticulier, loginWorker, waitLeftLogin };
