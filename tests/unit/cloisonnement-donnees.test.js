const assert = require("assert");
const fs = require("fs");
const path = require("path");

const { isBlockedAddress, assertPublicUrl } = require("../../lib/supply-import");
const { hasConfirmedRdv } = require("../../lib/rdv");
const { hasPhotoAccess } = require("../../lib/photo-access");

const ROOT = path.join(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("import de fourniture — adresses que le serveur ne doit pas appeler", () => {
  const INTERNES = [
    "127.0.0.1", "127.8.9.10", "0.0.0.0", "10.0.0.5", "10.255.255.255",
    "172.16.0.1", "172.31.255.254", "192.168.1.10", "169.254.169.254", "169.254.1.1",
    "100.64.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255",
    "::", "::1", "[::1]", "::ffff:127.0.0.1", "::ffff:7f00:1", "fc00::1", "fd12:3456::1",
    "fe80::1", "fe80::1%eth0", "ff02::1", "64:ff9b::7f00:1", "2002:7f00:1::1", "2001:0:4136:e378::1"
  ];
  const PUBLIQUES = ["8.8.8.8", "93.184.216.34", "172.15.0.1", "172.32.0.1", "192.167.1.1", "100.63.0.1", "2606:4700:4700::1111", "2a00:1450:4007:80e::200e"];

  for (const adresse of INTERNES) {
    it(`refuse ${adresse}`, () => assert.strictEqual(isBlockedAddress(adresse), true));
  }
  for (const adresse of PUBLIQUES) {
    it(`laisse passer ${adresse}`, () => assert.strictEqual(isBlockedAddress(adresse), false));
  }
  it("refuse ce qui n'est pas une adresse IP", () => {
    assert.strictEqual(isBlockedAddress(""), true);
    assert.strictEqual(isBlockedAddress("pas-une-ip"), true);
    assert.strictEqual(isBlockedAddress("999.1.1.1"), true);
  });
});

describe("import de fourniture — contrôle de l'URL avant l'appel", () => {
  const publique = async () => ["93.184.216.34"];
  const refusee = (url, resolve = publique) => assert.rejects(() => assertPublicUrl(url, resolve), /non autorisée/);

  it("accepte un site public en http(s)", async () => {
    await assertPublicUrl("https://www.leroymerlin.fr/produits/p.html", publique);
    await assertPublicUrl("http://exemple.fr/", publique);
  });

  it("refuse les adresses internes écrites en clair", async () => {
    for (const url of [
      "http://127.0.0.1/", "http://10.0.0.5:8080/admin", "http://192.168.1.10/", "http://172.16.0.1/",
      "http://169.254.169.254/latest/meta-data/", "http://0.0.0.0/", "http://[::1]:3000/", "http://[::ffff:127.0.0.1]/"
    ]) await refusee(url);
  });

  it("refuse les écritures détournées de 127.0.0.1", async () => {
    // L'analyseur d'URL les ramène toutes à 127.0.0.1.
    for (const url of ["http://2130706433/", "http://0x7f000001/", "http://127.1/", "http://0177.0.0.1/"]) await refusee(url);
  });

  it("refuse localhost sous toutes ses formes", async () => {
    for (const url of ["http://localhost/", "http://LOCALHOST:3000/", "http://api.localhost/", "http://localhost./"]) await refusee(url);
  });

  it("refuse un nom de domaine qui pointe sur une adresse interne", async () => {
    await refusee("https://innocent.exemple.fr/", async () => ["127.0.0.1"]);
    await refusee("https://innocent.exemple.fr/", async () => ["93.184.216.34", "10.0.0.5"]);
    await refusee("https://innocent.exemple.fr/", async () => ["::1"]);
    await refusee("https://innocent.exemple.fr/", async () => []);
  });

  it("refuse tout autre protocole que http et https", async () => {
    for (const url of ["ftp://exemple.fr/", "file:///etc/passwd", "gopher://exemple.fr/"]) await refusee(url);
  });

  it("ne résout pas le DNS pour une adresse IP littérale", async () => {
    let appele = false;
    await assertPublicUrl("http://93.184.216.34/", async () => { appele = true; return []; });
    assert.strictEqual(appele, false);
  });
});

describe("Radar — seul le particulier débloque coordonnées et photos", () => {
  const base = { offerId: "offre-1", entrepriseUserId: "ent-1" };

  it("un rendez-vous n'est confirmé que par une réponse du particulier", () => {
    const acceptee = { ...base, kind: "rdv_response", rdvStatus: "accepted" };
    assert.strictEqual(hasConfirmedRdv([{ ...acceptee, senderType: "particulier" }], "offre-1", "ent-1"), true);
    assert.strictEqual(hasConfirmedRdv([{ ...acceptee, senderType: "entreprise" }], "offre-1", "ent-1"), false);
    assert.strictEqual(hasConfirmedRdv([acceptee], "offre-1", "ent-1"), false);
  });

  it("un refus ou une autre entreprise ne débloque rien", () => {
    const refus = { ...base, senderType: "particulier", kind: "rdv_response", rdvStatus: "declined" };
    const autre = { ...base, entrepriseUserId: "ent-2", senderType: "particulier", kind: "rdv_response", rdvStatus: "accepted" };
    assert.strictEqual(hasConfirmedRdv([refus, autre], "offre-1", "ent-1"), false);
  });

  it("les photos ne s'ouvrent que sur un accord du particulier", () => {
    const accord = { ...base, kind: "photo_grant" };
    assert.strictEqual(hasPhotoAccess([{ ...accord, senderType: "particulier" }], "offre-1", "ent-1"), true);
    assert.strictEqual(hasPhotoAccess([{ ...accord, senderType: "entreprise" }], "offre-1", "ent-1"), false);
    assert.strictEqual(hasPhotoAccess([accord], "offre-1", "ent-1"), false);
  });

  it("la route des messages réserve chaque type de message au bon rôle", () => {
    const source = read("app/api/marketplace/offres/[id]/messages/route.js");
    assert.ok(source.includes("Seul le particulier peut envoyer ce message."));
    assert.ok(source.includes("Seule l'entreprise peut envoyer ce message."));
    // La réponse à un rendez-vous retrouve l'entreprise dans la proposition,
    // pas dans ce que le navigateur envoie.
    assert.ok(/String\(proposal\.entrepriseUserId/.test(source));
  });
});

describe("cloisonnement — garde-fous sur les routes", () => {
  it("l'export des données n'utilise que l'identité vérifiée", () => {
    const source = read("app/api/account/export/route.js");
    assert.strictEqual(/\bgetAuth\s*\(/.test(source), false, "l'export lit encore un jeton simplement décodé");
    assert.ok(/await resolveEntreprise\(request\)/.test(source));
  });

  it("les messages lus par quoteId exigent que le devis soit celui de la session", () => {
    const source = read("app/api/project-messages/route.js");
    assert.ok(/if \(!projectId && !\(await companyOwnsQuote\(request, quoteId\)\)\) return ok\(\{ messages: \[\] \}\);/.test(source));
    const helper = source.slice(source.indexOf("async function companyOwnsQuote"), source.indexOf("export async function GET"));
    assert.ok(/await getVerifiedAuth\(request\)/.test(helper));
    assert.ok(/auth\.supabase\.from\("quotes"\)\.select\("id"\)\.eq\("id", quoteId\)/.test(helper));
  });

  it("le téléphone ne donne plus accès aux devis d'un client", () => {
    for (const file of [
      "lib/portal-acces.js",
      "app/api/client/quotes/route.js",
      "app/api/client/quotes/[id]/pdf/route.js",
      "app/api/client/tasks/route.js",
      "app/api/client/task-notes/route.js",
      "app/api/task-replies/route.js",
      "app/api/urgent-alerts/route.js",
      "app/api/project-messages/route.js"
    ]) {
      const source = read(file);
      assert.strictEqual(
        /normalizePhone\((quote|project)\??\.clientPhone\)|client_phone/.test(source),
        false,
        `${file} compare encore un numéro de téléphone pour donner l'accès`
      );
    }
  });

  it("le lien d'activation direct n'est jamais renvoyé en production", () => {
    for (const file of ["app/api/auth/signup/route.js", "app/api/auth/particulier-signup/route.js"]) {
      const source = read(file);
      assert.ok(
        /directActivationUrl:\s*process\.env\.NODE_ENV === "production"\s*\?\s*undefined/.test(source),
        `${file} peut renvoyer le lien d'activation en production`
      );
    }
  });

  it("la connexion client vérifie le mot de passe avant de dire qu'un compte est inactif", () => {
    const source = read("app/api/auth/client-portal-login/route.js");
    const motDePasse = source.indexOf("verifyHashedPassword(password");
    const inactif = source.indexOf("user.isActive === false");
    assert.ok(motDePasse > -1 && inactif > -1);
    assert.ok(inactif > motDePasse, "l'état du compte est révélé avant le contrôle du mot de passe");
  });

  it("l'estimation du Radar masque les coordonnées avant le rendez-vous", () => {
    const source = read("app/api/estimer-devis/route.js");
    assert.ok(/clientEmail: rdvUnlocked \?/.test(source));
    assert.ok(/clientPhone: rdvUnlocked \?/.test(source));
    assert.ok(/chantierAddress: rdvUnlocked \?/.test(source));
  });
});
