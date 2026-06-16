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
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9,en;q=0.7"
      },
      cache: "no-store"
    });
    const html = await response.text();
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
