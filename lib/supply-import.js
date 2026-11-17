import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(String(value).replace(/<[^>]*>/g, " "));
}

function metaContent(html, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return "";
}

function safeJsonParse(value) {
  try {
    return JSON.parse(decodeHtml(value));
  } catch {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}

function scriptContents(html, predicate = () => true) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const attrs = match[1] || "";
    if (predicate(attrs)) scripts.push(match[2].trim());
  }
  return scripts;
}

function typeIncludes(type, expected) {
  const value = Array.isArray(type) ? type.join(" ") : type;
  return String(value || "").toLowerCase().includes(expected);
}

function walk(value, visitor, depth = 0) {
  if (!value || depth > 9) return null;
  const result = visitor(value);
  if (result) return result;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walk(item, visitor, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      const found = walk(item, visitor, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function productFromJson(value) {
  return walk(value, (item) => {
    if (item && typeof item === "object" && typeIncludes(item["@type"], "product")) return item;
    return null;
  });
}

function firstJsonProduct(html) {
  const ldScripts = scriptContents(html, (attrs) => /application\/ld\+json/i.test(attrs));
  for (const content of ldScripts) {
    const parsed = safeJsonParse(content);
    const product = productFromJson(parsed);
    if (product) return product;
  }

  const nextScripts = scriptContents(html, (attrs) => /__NEXT_DATA__|application\/json/i.test(attrs));
  for (const content of nextScripts) {
    const parsed = safeJsonParse(content);
    const product = productFromJson(parsed);
    if (product) return product;
  }

  return null;
}

function offerFromProduct(product) {
  const offer = Array.isArray(product?.offers) ? product.offers[0] : product?.offers;
  if (offer) return offer;
  return walk(product, (item) => {
    if (item && typeof item === "object" && (item.price || item.priceSpecification || item.lowPrice)) return item;
    return null;
  });
}

function numberFromText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (!value) return 0;
  const normalized = String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s/g, "")
    .replace(",", ".");
  const match = normalized.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function priceFromObject(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return numberFromText(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const price = priceFromObject(item);
      if (price) return price;
    }
    return 0;
  }
  if (typeof value === "object") {
    for (const key of ["price", "salePrice", "currentPrice", "unitPrice", "lowPrice", "amount", "value"]) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const price = priceFromObject(value[key]);
        if (price) return price;
      }
    }
    if (value.priceSpecification) return priceFromObject(value.priceSpecification);
  }
  return 0;
}

function priceFromHtml(html) {
  const metas = [
    metaContent(html, "product:sale_price:amount"),
    metaContent(html, "product:price:amount"),
    metaContent(html, "og:price:amount")
  ];
  for (const meta of metas) {
    const price = numberFromText(meta);
    if (price) return price;
  }

  const euroMatch = html.match(/(?:price|prix|amount|value)["'\s:=]+["']?(\d{1,5}(?:[,.]\d{1,2})?)["']?\s*(?:EUR|€)/i)
    || html.match(/(\d{1,5}(?:[,.]\d{2}))\s*€/i);
  return euroMatch ? numberFromText(euroMatch[1]) : 0;
}

const SUPPLIER_HOSTS = [
  ["leroymerlin", "Leroy Merlin"],
  ["castorama", "Castorama"],
  ["bricodepot", "Brico Depot"],
  ["manomano", "ManoMano"],
  ["pointp", "Point.P"],
  ["chausson", "Chausson Materiaux"],
  ["gedimat", "Gedimat"],
  ["lapeyre", "Lapeyre"],
  ["cegedim", "Cegedim"]
];

function supplierFromHost(hostname = "") {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const mapped = SUPPLIER_HOSTS.find(([needle]) => host.includes(needle));
  if (mapped) return mapped[1];
  return host.split(".")[0].replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function titleFromSlug(parsedUrl) {
  const parts = parsedUrl.pathname.split("/").filter(Boolean);
  const slug = [...parts].reverse().find((part) => /[-_]/.test(part)) || parts.at(-1) || parsedUrl.hostname;
  const cleaned = decodeURIComponent(slug)
    .replace(/\.html?$/i, "")
    .replace(/-?\d{6,}$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.split(" ").filter(Boolean).map((word) => {
    if (/^v?\d+[a-z]*$/i.test(word) || /^\d+[a-z]+$/i.test(word)) return word.toUpperCase();
    if (["m2", "mm", "cm", "l", "kg", "ml", "ht", "ttc"].includes(word.toLowerCase())) return word.toUpperCase();
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

function detectCategory(text = "") {
  const value = text.toLowerCase();
  if (/peinture|acrylique|velours|mat|satin|boiserie|enduit/.test(value)) return "Peinture";
  if (/carrelage|faience|faïence|joint|colle carrelage|mortier/.test(value)) return "Sol";
  if (/isolation|laine de verre|laine de roche|isolant/.test(value)) return "Materiaux";
  if (/robinet|plomberie|siphon|tuyau|raccord/.test(value)) return "Materiaux";
  if (/vis|cheville|outil|accessoire|cartouche|silicone/.test(value)) return "Accessoires";
  return "Divers";
}

const PACKAGING_SIZE_PATTERNS = [
  { regex: /(\d+(?:[.,]\d+)?)\s*m(?:2|²)\b/i, unit: "m2", label: "m2" },
  { regex: /(\d+(?:[.,]\d+)?)\s*ml\b/i, unit: "ml", label: "ml" },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:kgs?|kilos?|kilogrammes?)\b/i, unit: "kg", label: "kg" },
  { regex: /(\d+(?:[.,]\d+)?)\s*(?:l|litres?)\b/i, unit: "L", label: "L" }
];

const PACKAGING_QUANTITY_PATTERNS = [
  /\b(?:lot|pack|set)s?\s+de\s+(\d+)\b/i,
  /\bx\s?(\d+)\b/i,
  /\b(\d+)\s*(?:pieces?|pi[eè]ces?|unites?|unit[eé]s?|pcs)\b/i
];

function extractPackaging(text = "") {
  const result = {};
  for (const { regex, unit, label } of PACKAGING_SIZE_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      result.unit = unit;
      result.packaging = `${match[1].replace(",", ".")} ${label}`;
      break;
    }
  }
  for (const regex of PACKAGING_QUANTITY_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      result.quantity = Number(match[1]);
      break;
    }
  }
  return result;
}

function cleanTitle(value = "", fallback = "") {
  const title = stripTags(value)
    .replace(/\s*[-|]\s*(Leroy Merlin|Castorama|Brico Depot|ManoMano|Point\.?P|Chausson|Gedimat|Lapeyre).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const domainLike = /^(?:www\.)?[\w-]+(?:\.[a-z]{2,})+$/i.test(title);
  const blockedLike = /access denied|just a moment|attention required|captcha|forbidden|blocked|robot|veuillez patienter/i.test(title);
  const supplierOnly = /^(leroy\s*merlin|castorama|brico\s*depot|bricodepot|manomano|point\.?p|chausson|gedimat|lapeyre)$/i.test(title);
  if (!title || /^https?:/i.test(title) || domainLike || blockedLike || supplierOnly) return fallback;
  return title;
}

// ─── Garde-fou SSRF ────────────────────────────────────────────────────────
// Ce serveur va chercher une page pour le compte d'un utilisateur : il ne
// doit jamais appeler sa propre machine, un réseau privé ni les métadonnées
// d'un hébergeur (169.254.169.254). On raisonne sur l'adresse IP, pas sur
// l'écriture du nom : une première version filtrait par motifs de texte et
// laissait passer 127.0.0.1, 10.x et 192.168.x.

function ipv4Octets(value) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((n) => n <= 255) ? octets : null;
}

function isPrivateIpv4([a, b]) {
  return a === 0 ||                          // « ce réseau », dont 0.0.0.0
    a === 10 ||                              // privé
    a === 127 ||                             // boucle locale
    (a === 100 && b >= 64 && b <= 127) ||    // CGNAT
    (a === 169 && b === 254) ||              // lien local, métadonnées cloud
    (a === 172 && b >= 16 && b <= 31) ||     // privé
    (a === 192 && b === 168) ||              // privé
    (a === 198 && (b === 18 || b === 19)) || // bancs d'essai
    a >= 224;                                // multicast, réservé, diffusion
}

// Vrai pour toute adresse IP (v4 ou v6) que le serveur ne doit pas appeler.
// Une valeur qui n'est pas une adresse IP est refusée aussi : on ne passe
// ici que des adresses, littérales ou résolues par le DNS.
export function isBlockedAddress(address) {
  const value = String(address || "").trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const v4 = ipv4Octets(value);
  if (v4) return isPrivateIpv4(v4);
  if (isIP(value) !== 6) return true;
  // IPv6 : seul l'unicast global (2000::/3) est joignable sur Internet. Tout
  // le reste est refusé d'un bloc — ::, ::1, les adresses IPv4 déguisées
  // (::ffff:127.0.0.1), fc00::/7, fe80::/10, ff00::/8, NAT64.
  if (value.startsWith("::")) return true;
  const first = parseInt(value.split(":")[0], 16);
  if (!(first >= 0x2000 && first <= 0x3fff)) return true;
  // Dans 2000::/3, deux tunnels embarquent une adresse IPv4 : 6to4 et Teredo.
  if (first === 0x2002) return true;
  if (first === 0x2001 && parseInt(value.split(":")[1] || "0", 16) === 0) return true;
  return false;
}

async function resolveHost(hostname) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

// Lève une erreur si l'URL ne mène pas à une adresse publique en http(s).
// Un nom de domaine est résolu : « mon-site.fr » qui pointe sur 127.0.0.1
// est refusé comme 127.0.0.1 lui-même. `resolve` est injectable pour les tests.
export async function assertPublicUrl(url, resolve = resolveHost) {
  const target = url instanceof URL ? url : new URL(String(url));
  if (target.protocol !== "http:" && target.protocol !== "https:") throw new Error("Adresse non autorisée.");
  const host = target.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost")) throw new Error("Adresse non autorisée.");
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new Error("Adresse non autorisée.");
    return;
  }
  const addresses = await resolve(host);
  if (!addresses.length || addresses.some(isBlockedAddress)) throw new Error("Adresse non autorisée.");
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;
// Les fiches produit des grandes enseignes dépassent souvent 1 Mo de HTML :
// 5 Mo borne la mémoire sans faire échouer un import légitime.
const MAX_HTML_BYTES = 5_000_000;

async function readCapped(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Réponse trop volumineuse.");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error("Réponse trop volumineuse.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Télécharge le HTML d'une page publique. Chaque redirection est suivie à la
// main et revérifiée (une page publique peut rediriger vers une adresse
// interne) ; un seul délai couvre tout l'échange, corps compris ; la lecture
// s'arrête dès que la taille maximale est dépassée.
// Limite connue : le DNS est interrogé ici puis de nouveau par fetch ; un
// domaine qui change de réponse entre les deux n'est pas couvert.
async function fetchPublicHtml(urlString) {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let current = new URL(urlString);
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    await assertPublicUrl(current);
    const response = await fetch(current.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.7"
      },
      cache: "no-store",
      redirect: "manual",
      signal
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) throw new Error("Redirection invalide.");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return readCapped(response, MAX_HTML_BYTES);
  }
  throw new Error("Trop de redirections.");
}

export async function importSupplyFromUrl(url) {
  const sourceUrl = String(url || "").trim();
  if (!sourceUrl) return {};

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return { sourceUrl };
  }

  const slugTitle = titleFromSlug(parsedUrl);
  const supplierName = supplierFromHost(parsedUrl.hostname);

  try {
    const html = await fetchPublicHtml(parsedUrl.toString());
    const product = firstJsonProduct(html);
    const offer = offerFromProduct(product);

    const rawTitle = product?.name
      || metaContent(html, "og:title")
      || metaContent(html, "twitter:title")
      || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      || slugTitle;
    const title = cleanTitle(rawTitle, slugTitle);
    const description = product?.description || metaContent(html, "og:description") || metaContent(html, "description") || "";
    const image = Array.isArray(product?.image) ? product.image[0] : product?.image || metaContent(html, "og:image") || "";
    const brand = typeof product?.brand === "string" ? product.brand : product?.brand?.name;

    const regularPrice = numberFromText(metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount"));
    const salePrice = numberFromText(metaContent(html, "product:sale_price:amount"));
    const offerPrice = priceFromObject(offer);
    const htmlPrice = priceFromHtml(html);
    const price = salePrice || offerPrice || regularPrice || htmlPrice || 0;
    const originalPriceHt = salePrice && regularPrice && salePrice < regularPrice ? regularPrice : 0;
    const packaging = extractPackaging(`${title} ${description}`);

    const result = {
      sourceUrl,
      name: title || slugTitle,
      category: detectCategory(`${title} ${description} ${parsedUrl.pathname}`),
      imageUrl: image,
      supplierName: supplierName || brand || "",
      purchasePriceHt: price,
      salePriceHt: price,
      priceHt: price
    };

    if (brand && !result.supplierName) result.supplierName = brand;
    if (packaging.unit) result.unit = packaging.unit;
    if (packaging.packaging) result.packaging = packaging.packaging;
    if (packaging.quantity) result.quantity = packaging.quantity;
    if (originalPriceHt) {
      result.promo = true;
      result.originalPriceHt = originalPriceHt;
    }

    return result;
  } catch {
    const packaging = extractPackaging(slugTitle);
    return {
      sourceUrl,
      name: slugTitle,
      category: detectCategory(`${slugTitle} ${parsedUrl.pathname}`),
      supplierName,
      ...packaging
    };
  }
}
