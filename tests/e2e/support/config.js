const fs = require("fs");
const path = require("path");

// Charge tests/e2e/.env.e2e a la main (pas de dependance dotenv — un seul
// petit parseur suffit) : chaque ligne CLE=valeur devient process.env.CLE,
// sans ecraser une variable deja presente dans l'environnement (utile en CI
// ou les secrets arrivent autrement).
function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env.e2e");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

function flag(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw.toLowerCase() === "true";
}

const entreprise = {
  email: process.env.E2E_ENTREPRISE_EMAIL || "",
  password: process.env.E2E_ENTREPRISE_PASSWORD || ""
};
const particulier = {
  email: process.env.E2E_PARTICULIER_EMAIL || "",
  password: process.env.E2E_PARTICULIER_PASSWORD || ""
};

const config = {
  baseUrl: (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
  headless: flag("E2E_HEADLESS", true),
  write: flag("E2E_WRITE", false),
  ai: flag("E2E_AI", false),
  entreprise,
  particulier,
  hasEntreprise: Boolean(entreprise.email && entreprise.password),
  hasParticulier: Boolean(particulier.email && particulier.password)
};

module.exports = config;
