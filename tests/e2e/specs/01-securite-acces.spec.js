const assert = require("assert");
const { getDriver } = require("../support/driver");
const h = require("../support/helpers");

// Toutes ces pages passent par components/Shell.jsx, qui redirige vers
// /login?type=entreprise si localStorage ne contient aucun "koji-user" —
// verifie dans le code (pas de garde-fou serveur ici, c'est intentionnel :
// la vraie protection des donnees est cote API, teste plus bas).
// NOTE : "/" est volontairement absente de cette liste — contrairement a
// toutes les autres, app/page.jsx n'utilise PAS la redirection generique de
// Shell pour un visiteur anonyme : elle affiche directement
// components/PublicLanding (deja couvert par 00-public.spec.js). Premiere
// version de ce test incluait "/" ici par erreur, provoquant un timeout
// (jamais de redirection vers /login) — corrige apres verification du code.
const ENTREPRISE_PAGES = [
  "/chantiers", "/chantier/new", "/devis", "/devis-ia/new", "/avenant",
  "/facturation", "/fournitures", "/fournitures/catalogue", "/bibliotheque-ouvrages",
  "/comptabilite", "/contacts", "/clients", "/equipe", "/calendrier", "/archives",
  "/corbeille", "/interventions", "/marketplace", "/notifications", "/profil",
  "/profil/carte-de-visite", "/profil/site-web", "/parametres", "/parametres/abonnement",
  "/business-info", "/chiffre-affaires", "/planning", "/profession-selection"
];

// Pages admin : le garde-fou pertinent ici n'est pas "pas connecte" (c'est
// le meme Shell que ci-dessus) mais "connecte sans etre admin" — un visiteur
// anonyme satisfait trivialement cette condition, donc redirige vers "/".
const ADMIN_PAGES = ["/admin/clients", "/admin/algo-stats"];

// Cote serveur : chaque GET liste-son-proprietaire doit ignorer un ?userId=
// fourni par le client et ne jamais renvoyer les donnees d'un autre compte —
// voir l'audit de securite du 22 oct (lib/db.js::scopedItems/getUserScope).
// Un appel anonyme doit donc renvoyer soit un refus explicite (401/403) soit
// une liste vide, jamais les vraies donnees.
const API_LIST_ROUTES = [
  { path: "/api/contacts", key: "contacts" },
  { path: "/api/clients", key: "clients" },
  { path: "/api/quotes", key: "quotes" },
  { path: "/api/projects", key: "projects" },
  { path: "/api/invoices", key: "invoices" },
  { path: "/api/expenses", key: "expenses" },
  { path: "/api/supplies", key: "supplies" },
  { path: "/api/suppliers", key: "suppliers" },
  { path: "/api/workers", key: "workers" },
  { path: "/api/calendar-events", key: "calendarEvents" },
  { path: "/api/interventions", key: "interventions" },
  { path: "/api/notifications", key: "notifications" },
  { path: "/api/commandes", key: "commandes" },
  { path: "/api/tasks", key: "tasks" }
];

async function assertAnonymousSafe(path) {
  const response = await fetch(h.fullUrl(path));
  if (response.status === 401 || response.status === 403) return "denied";
  assert.strictEqual(response.status, 200, `${path} : statut inattendu ${response.status}`);
  return response;
}

describe("Securite et acces (non connecte)", function () {
  let driver;

  before(function () {
    driver = getDriver();
  });

  afterEach(async function () {
    await h.captureOnFailure(this, driver);
  });

  describe("Redirection des pages entreprise vers /login", function () {
    for (const pagePath of ENTREPRISE_PAGES) {
      it(`'${pagePath}' redirige vers /login?type=entreprise`, async function () {
        await h.clearSession(driver);
        await h.goto(driver, pagePath);
        await driver.wait(async () => (await driver.getCurrentUrl()).includes("/login?type=entreprise"), 15000);
      });
    }
  });

  describe("Pages admin : redirection vers '/' pour un visiteur anonyme (donc non-admin)", function () {
    for (const pagePath of ADMIN_PAGES) {
      it(`'${pagePath}' redirige vers '/'`, async function () {
        await h.clearSession(driver);
        await h.goto(driver, pagePath);
        await driver.wait(async () => {
          const url = await driver.getCurrentUrl();
          return url === h.fullUrl("/") || url.includes("/login?type=entreprise");
        }, 15000);
      });
    }
  });

  describe("Appels API anonymes", function () {
    for (const { path, key } of API_LIST_ROUTES) {
      it(`GET ${path} (sans session) -> refuse ou liste vide`, async function () {
        const result = await assertAnonymousSafe(path);
        if (result === "denied") return;
        const data = await result.json();
        assert.deepStrictEqual(data[key], [], `${path} ne devrait jamais renvoyer de vraies donnees sans session (cle "${key}")`);
      });

      it(`GET ${path}?userId=xxx-faux (sans session) -> refuse ou liste vide, jamais les donnees de "xxx-faux"`, async function () {
        const result = await assertAnonymousSafe(`${path}?userId=xxx-faux`);
        if (result === "denied") return;
        const data = await result.json();
        assert.deepStrictEqual(data[key], [], `${path}?userId=xxx-faux ne devrait jamais renvoyer de donnees (cle "${key}")`);
      });
    }
  });

  describe("En-tetes de securite", function () {
    it("'/' renvoie une CSP et X-Frame-Options: DENY", async function () {
      const response = await fetch(h.fullUrl("/"));
      const csp = response.headers.get("content-security-policy") || "";
      assert.ok(csp.includes("default-src 'self'"), "CSP absente ou inattendue.");
      assert.ok(csp.includes("frame-ancestors 'none'"), "CSP devrait interdire le framing (frame-ancestors 'none').");
      assert.strictEqual(response.headers.get("x-frame-options"), "DENY");
      assert.strictEqual(response.headers.get("x-content-type-options"), "nosniff");
    });
  });
});
