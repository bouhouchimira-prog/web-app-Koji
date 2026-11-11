// SIREN à l'inscription (maquette PRO-00 « SIREN · facultatif maintenant,
// Koji remplit votre fiche entreprise ») : vérification du numéro, numéro de
// TVA intracommunautaire calculé, et fiche remplie depuis l'annuaire public
// des entreprises (recherche-entreprises.api.gouv.fr : gratuit, sans clé,
// données INSEE/RNE). Best effort : si l'annuaire ne répond pas, le compte
// est créé quand même avec le SIREN seul.

const ANNUAIRE = "https://recherche-entreprises.api.gouv.fr/search";

// Formes juridiques les plus courantes dans le bâtiment (catégories INSEE).
const FORMES = {
  "1000": "Entrepreneur individuel",
  "5410": "SARL",
  "5422": "SARL",
  "5426": "SARL",
  "5430": "SARL",
  "5498": "EURL",
  "5499": "SARL",
  "5505": "SA",
  "5599": "SA",
  "5710": "SAS",
  "5720": "SASU",
  "6533": "SCOP",
  "5458": "SCOP SARL",
  "5785": "SCOP SAS"
};

function luhn(digits) {
  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

// « 992 204 651 » → « 992204651 » ; null si ce n'est pas un SIREN valide
// (9 chiffres, clé de Luhn). Un SIRET (14 chiffres) donne son SIREN.
export function normaliserSiren(valeur) {
  const digits = String(valeur || "").replace(/[\s.-]/g, "");
  if (!/^\d+$/.test(digits)) return null;
  if (digits.length === 14) return luhn(digits) ? digits.slice(0, 9) : null;
  if (digits.length !== 9) return null;
  return luhn(digits) ? digits : null;
}

// Numéro de TVA intracommunautaire français : FR + clé (2 chiffres) + SIREN.
export function tvaDepuisSiren(siren) {
  const s = normaliserSiren(siren);
  if (!s) return "";
  const cle = (12 + 3 * (Number(s) % 97)) % 97;
  return `FR${String(cle).padStart(2, "0")}${s}`;
}

// « RUE DE L'AQUEDUC » → « Rue de l'Aqueduc », « SAINT-DENIS » → « Saint-Denis ».
const PETITS_MOTS = new Set(["de", "du", "des", "la", "le", "les", "et", "en", "au", "aux", "sur", "sous"]);

function majuscule(mot) {
  return mot.replace(/^\p{L}/u, (lettre) => lettre.toUpperCase());
}

function titre(texte) {
  return String(texte || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((mot, i) => {
      const apostrophe = mot.match(/^([ld])['’](.+)$/u);
      if (apostrophe) return `${i === 0 ? apostrophe[1].toUpperCase() : apostrophe[1]}'${majuscule(apostrophe[2])}`;
      if (i > 0 && PETITS_MOTS.has(mot)) return mot;
      return mot.split("-").map(majuscule).join("-");
    })
    .join(" ");
}

// Résultat de l'annuaire → champs de la fiche entreprise (business_info).
export function ficheDepuisAnnuaire(resultat, siren) {
  if (!resultat || resultat.siren !== siren) return null;
  const siege = resultat.siege || {};
  const voie = [siege.numero_voie, siege.indice_repetition, siege.type_voie, siege.libelle_voie]
    .filter(Boolean)
    .join(" ");
  const fiche = {
    raisonSociale: resultat.nom_raison_sociale || resultat.nom_complet || "",
    siren,
    siret: siege.siret || "",
    addressLine1: titre(voie),
    addressLine2: titre(siege.complement_adresse || ""),
    postalCode: siege.code_postal || "",
    city: titre(siege.libelle_commune || ""),
    tva: tvaDepuisSiren(siren),
    formeJuridique: FORMES[resultat.nature_juridique] || ""
  };
  return Object.fromEntries(Object.entries(fiche).filter(([, valeur]) => valeur));
}

export async function chercherEntreprise(siren, { timeoutMs = 4000, fetchImpl = fetch } = {}) {
  const s = normaliserSiren(siren);
  if (!s) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${ANNUAIRE}?q=${s}&per_page=1`, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return ficheDepuisAnnuaire(data?.results?.[0], s);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
