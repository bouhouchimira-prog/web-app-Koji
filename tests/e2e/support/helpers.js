const fs = require("fs");
const path = require("path");
const { By, until, Key } = require("selenium-webdriver");
const config = require("./config");

const DEFAULT_TIMEOUT = 15000;

function fullUrl(pathname) {
  return `${config.baseUrl}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

async function goto(driver, pathname) {
  await driver.get(fullUrl(pathname));
}

// Les <label> de l'app n'ont pas d'attribut "for" (verifie dans le code) —
// on cible le champ par le texte visible de son label, en gerant les
// apostrophes francaises ("ne pas", "d'ouvrage"...) via concat() pour que le
// XPath reste valide. Cherche a la fois un <span> enfant (pattern dominant
// dans les formulaires) et un texte direct dans le <label>.
function xpathLiteral(value) {
  if (!value.includes("'")) return `'${value}'`;
  const parts = value.split("'");
  return `concat(${parts.map((part, i) => (i < parts.length - 1 ? `'${part}', "'"` : `'${part}'`)).join(", ")})`;
}

function labelInputXPath(labelText, tag = "input") {
  const literal = xpathLiteral(labelText);
  return `//label[.//span[normalize-space()=${literal}] or normalize-space()=${literal}]//${tag}`;
}

async function findByLabel(driver, labelText, tag = "input") {
  return driver.wait(until.elementLocated(By.xpath(labelInputXPath(labelText, tag))), DEFAULT_TIMEOUT);
}

async function waitVisible(driver, locator, timeout = DEFAULT_TIMEOUT) {
  const el = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(el), timeout);
  return el;
}

async function waitClickable(driver, locator, timeout = DEFAULT_TIMEOUT) {
  const el = await waitVisible(driver, locator, timeout);
  await driver.wait(until.elementIsEnabled(el), timeout);
  return el;
}

async function clickWhenReady(driver, locator, timeout = DEFAULT_TIMEOUT) {
  const el = await waitClickable(driver, locator, timeout);
  await el.click();
  return el;
}

// Les inputs React controles ignorent souvent clear() (la valeur DOM revient
// instantanement via onChange/value) — selectionner tout puis supprimer
// reproduit un vrai geste utilisateur et declenche les bons evenements.
async function clearControlledInput(driver, element) {
  await element.click();
  await element.sendKeys(Key.CONTROL, "a");
  await element.sendKeys(Key.DELETE);
}

async function typeInto(driver, element, value) {
  await clearControlledInput(driver, element);
  if (value) await element.sendKeys(value);
}

// input[type=date|datetime-local] : sendKeys seul ne declenche pas toujours
// l'evenement "input" que React ecoute. On pose la valeur via le setter
// natif du prototype (contourne l'éventuel setter intercepte par React) puis
// on dispatch "input" nous-memes.
async function setNativeInputValue(driver, element, value) {
  await driver.executeScript(
    `const el = arguments[0];
     const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
     const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
     setter.call(el, arguments[1]);
     el.dispatchEvent(new Event("input", { bubbles: true }));
     el.dispatchEvent(new Event("change", { bubbles: true }));`,
    element,
    value
  );
}

// Supprime cookies + localStorage avant chaque connexion (demande explicite)
// — koji-lang est aussitot repose a "fr" car I18nProvider lit cette cle au
// montage : sans ca, le navigateur Chrome local (navigator.language) peut
// faire basculer l'app dans une autre langue et casser les assertions de
// texte.
async function clearSession(driver) {
  await driver.manage().deleteAllCookies();
  await driver.executeScript(`
    try { window.localStorage.clear(); } catch (e) {}
    try { window.sessionStorage.clear(); } catch (e) {}
    try { window.localStorage.setItem("koji-lang", "fr"); } catch (e) {}
  `);
}

// Vrai texte d'erreur applicatif Next.js (page crashee), pas un simple mot
// "error" qui pourrait apparaitre legitimement dans du contenu.
async function assertNoAppError(driver) {
  const bodyText = await driver.findElement(By.css("body")).getText();
  if (/application error/i.test(bodyText) || /unhandled runtime error/i.test(bodyText)) {
    throw new Error(`Erreur applicative Next.js detectee sur la page : "${bodyText.slice(0, 200)}..."`);
  }
}

function sanitizeFilename(value) {
  return String(value).replace(/[^a-z0-9-_]+/gi, "-").slice(0, 120);
}

const SCREENSHOT_DIR = path.join(__dirname, "..", "reports", "screenshots");

// A appeler depuis un afterEach(function () {...}) de chaque spec, avec
// `this` (le contexte Mocha) et le driver courant — capture une image
// seulement si le test qui vient de s'executer a echoue.
async function captureOnFailure(mochaContext, driver) {
  const test = mochaContext.currentTest;
  if (!test || test.state !== "failed") return;
  try {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const data = await driver.takeScreenshot();
    const filename = `${sanitizeFilename(test.fullTitle())}-${Date.now()}.png`;
    fs.writeFileSync(path.join(SCREENSHOT_DIR, filename), data, "base64");
    // eslint-disable-next-line no-console
    console.log(`  [capture] ${path.join("tests", "e2e", "reports", "screenshots", filename)}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`  [capture] echec de la capture d'ecran : ${err.message}`);
  }
}

module.exports = {
  fullUrl,
  goto,
  labelInputXPath,
  findByLabel,
  waitVisible,
  waitClickable,
  clickWhenReady,
  clearControlledInput,
  typeInto,
  setNativeInputValue,
  clearSession,
  assertNoAppError,
  captureOnFailure,
  By,
  until,
  Key,
  DEFAULT_TIMEOUT
};
