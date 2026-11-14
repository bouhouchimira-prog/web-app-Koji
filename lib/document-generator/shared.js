import zlib from "zlib";
import QRCode from "qrcode";
import { fixObjectText, fixText } from "../text";
import { isoWeekInfo } from "../worker-portal";
import { computeSurchargeBreakdown } from "../quote-calculations";
import { MENTION_AUTOLIQUIDATION, MENTION_TAUX_REDUIT, estTauxReduit, ventilerTva } from "../tva";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 42;
export const CONTENT_TOP = 74;
export const CONTENT_BOTTOM = 54;
export const NAVY = "#06132d";
export const GOLD = "#e6d7c4";
export const BLUE = "#2450a7";
export const LINE = "#dfe6f0";
export const SOFT = "#f4f6fa";

export function money(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function sanitizeFilename(value) {
  return fixText(value || "document")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function companyFromDb(db, userId) {
  const user = db.users.find((item) => userId && item.id === userId && item.businessInfoComplete)
    || db.users.find((item) => item.businessInfoComplete)
    || db.users[0]
    || {};
  const business = user.business || {};
  return {
    name: fixText(business.raisonSociale || user.name || "Koji"),
    addressLine1: fixText(business.addressLine1 || ""),
    addressLine2: fixText(business.addressLine2 || ""),
    email: fixText(business.emailPro || user.email || ""),
    phone: fixText(business.phone || ""),
    siret: fixText(business.siret || ""),
    rcs: fixText(business.rcs || business.siren || ""),
    siren: fixText(business.siren || ""),
    tva: fixText(business.tva || ""),
    legalForm: fixText(business.legalForm || business.formeJuridique || business.legalStatus || ""),
    capital: fixText(business.capital || business.capitalSocial || ""),
    logoDataUrl: fixText(business.logoDataUrl || ""),
    city: fixText(business.city || ""),
    iban: fixText(business.iban || ""),
    bankHolder: fixText(business.bankHolder || business.raisonSociale || user.name || ""),
    bic: fixText(business.bic || business.swift || ""),
    legalMentions: fixText(business.legalMentions || ""),
    paymentTerms: fixText(business.paymentTerms || "")
  };
}

export function companyFromQuote(quote, db) {
  const fallback = companyFromDb(db, quote.userId);
  const snapshot = fixObjectText(quote.company || {});
  const addressParts = fixText(snapshot.address || "")
    .split(/\n| - |, /)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    ...fallback,
    name: fixText(snapshot.name || fallback.name),
    addressLine1: fixText(snapshot.addressLine1 || addressParts[0] || fallback.addressLine1),
    addressLine2: fixText(snapshot.addressLine2 || addressParts.slice(1).join(" ") || fallback.addressLine2),
    email: fixText(snapshot.email || fallback.email),
    phone: fixText(snapshot.phone || fallback.phone),
    siret: fixText(snapshot.siret || fallback.siret),
    rcs: fixText(snapshot.rcs || snapshot.siren || fallback.rcs),
    siren: fixText(snapshot.siren || fallback.siren),
    tva: fixText(snapshot.tva || fallback.tva),
    legalForm: fixText(snapshot.legalForm || snapshot.formeJuridique || snapshot.legalStatus || fallback.legalForm),
    capital: fixText(snapshot.capital || snapshot.capitalSocial || fallback.capital),
    logoDataUrl: fixText(snapshot.logoDataUrl || snapshot.logo || fallback.logoDataUrl),
    city: fixText(snapshot.city || fallback.city),
    iban: fixText(snapshot.iban || fallback.iban),
    bankHolder: fixText(snapshot.bankHolder || fallback.bankHolder),
    bic: fixText(snapshot.bic || snapshot.swift || fallback.bic),
    legalMentions: fixText(snapshot.legalMentions || fallback.legalMentions),
    paymentTerms: fixText(snapshot.paymentTerms || fallback.paymentTerms)
  };
}

export function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  return [
    parseInt(cleaned.slice(0, 2), 16) / 255,
    parseInt(cleaned.slice(2, 4), 16) / 255,
    parseInt(cleaned.slice(4, 6), 16) / 255
  ];
}

export function color(hex, op) {
  return `${hexToRgb(hex).map((n) => n.toFixed(3)).join(" ")} ${op}`;
}

// Polices PDF en WinAnsi : « € » (0x80), « œ » (0x9c), « Œ » (0x8c) ; les
// tirets, apostrophes et guillemets typographiques passent en ASCII ; les
// espaces fines de Intl (milliers, « € ») deviennent des espaces. Les
// caractères avaient été remplacés par « ? » (encodage), ce qui changeait
// chaque « ? » en « € » et effaçait les vrais « € ».
export function pdfText(value) {
  return fixText(String(value ?? ""))
    .replaceAll("€", "\x80")
    .replaceAll("œ", "\x9c")
    .replaceAll("Œ", "\x8c")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", "\"")
    .replaceAll("”", "\"")
    .replaceAll("…", "...")
    .replace(/[   ]/g, " ")
    .replace(/[^\x00-\xff]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function wrapText(value, maxChars) {
  const words = fixText(value || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export function parseDataUrl(dataUrl) {
  const match = /^data:([^;,]+)(;[^,]*)?,(.*)$/s.exec(dataUrl || "");
  if (!match) return null;
  const isBase64 = /;base64/i.test(match[2] || "");
  if (!isBase64) return null;
  try {
    return { mime: match[1], buffer: Buffer.from(match[3], "base64") };
  } catch {
    return null;
  }
}

export function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function unfilterPng(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const out = Buffer.alloc(stride * height);
  let rawOffset = 0;
  let prevRowStart = -1;
  for (let row = 0; row < height; row += 1) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const rowStart = row * stride;
    for (let i = 0; i < stride; i += 1) {
      const x = raw[rawOffset + i];
      const a = i >= bytesPerPixel ? out[rowStart + i - bytesPerPixel] : 0;
      const b = prevRowStart >= 0 ? out[prevRowStart + i] : 0;
      const c = (prevRowStart >= 0 && i >= bytesPerPixel) ? out[prevRowStart + i - bytesPerPixel] : 0;
      let value;
      switch (filterType) {
        case 1: value = (x + a) & 0xff; break;
        case 2: value = (x + b) & 0xff; break;
        case 3: value = (x + Math.floor((a + b) / 2)) & 0xff; break;
        case 4: value = (x + paethPredictor(a, b, c)) & 0xff; break;
        default: value = x;
      }
      out[rowStart + i] = value;
    }
    rawOffset += stride;
    prevRowStart = rowStart;
  }
  return out;
}

export function decodePng(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(signature)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  let palette = null;
  let paletteAlpha = null;
  const idatChunks = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const data = buffer.subarray(dataStart, dataStart + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      paletteAlpha = data;
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset = dataStart + length + 4;
  }
  if (!width || !height || interlace !== 0 || bitDepth !== 8) return null;
  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colorType];
  if (!channels) return null;

  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idatChunks));
  } catch {
    return null;
  }
  const pixels = unfilterPng(raw, width, height, channels);

  const rgba = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    let r;
    let g;
    let b;
    let a = 255;
    if (colorType === 0) {
      r = g = b = pixels[p];
    } else if (colorType === 2) {
      r = pixels[p * 3]; g = pixels[p * 3 + 1]; b = pixels[p * 3 + 2];
    } else if (colorType === 3) {
      if (!palette) return null;
      const idx = pixels[p];
      r = palette[idx * 3]; g = palette[idx * 3 + 1]; b = palette[idx * 3 + 2];
      a = paletteAlpha && paletteAlpha[idx] != null ? paletteAlpha[idx] : 255;
    } else if (colorType === 4) {
      r = g = b = pixels[p * 2];
      a = pixels[p * 2 + 1];
    } else if (colorType === 6) {
      r = pixels[p * 4]; g = pixels[p * 4 + 1]; b = pixels[p * 4 + 2]; a = pixels[p * 4 + 3];
    }
    rgba[p * 4] = r; rgba[p * 4 + 1] = g; rgba[p * 4 + 2] = b; rgba[p * 4 + 3] = a;
  }
  return { width, height, rgba };
}

export function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

export function buildImageXObject(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  if (/png/i.test(parsed.mime)) {
    const decoded = decodePng(parsed.buffer);
    if (!decoded) return null;
    const { width, height, rgba } = decoded;
    const rgb = Buffer.alloc(width * height * 3);
    const alpha = Buffer.alloc(width * height);
    let hasAlpha = false;
    for (let p = 0; p < width * height; p += 1) {
      rgb[p * 3] = rgba[p * 4];
      rgb[p * 3 + 1] = rgba[p * 4 + 1];
      rgb[p * 3 + 2] = rgba[p * 4 + 2];
      const a = rgba[p * 4 + 3];
      alpha[p] = a;
      if (a !== 255) hasAlpha = true;
    }
    return {
      width,
      height,
      main: { stream: zlib.deflateSync(rgb), filter: "FlateDecode", colorSpace: "DeviceRGB", bpc: 8 },
      smask: hasAlpha ? { stream: zlib.deflateSync(alpha), filter: "FlateDecode", colorSpace: "DeviceGray", bpc: 8 } : null
    };
  }
  if (/jpe?g/i.test(parsed.mime)) {
    const dims = readJpegDimensions(parsed.buffer);
    if (!dims) return null;
    return {
      width: dims.width,
      height: dims.height,
      main: { stream: parsed.buffer, filter: "DCTDecode", colorSpace: "DeviceRGB", bpc: 8 },
      smask: null
    };
  }
  return null;
}

export class PdfCanvas {
  // width/height let a caller opt into a non-A4 page (e.g. a business card);
  // every method below flips the Y axis against this.pageHeight instead of
  // the module-level A4 constant, so the default (no args) behaves exactly
  // as before for every existing document type.
  constructor(width = PAGE_WIDTH, height = PAGE_HEIGHT) {
    this.pageWidth = width;
    this.pageHeight = height;
    this.pages = [[]];
    this.y = CONTENT_TOP;
    this.images = [];
  }

  get ops() {
    return this.pages[this.pages.length - 1];
  }

  ensure(height) {
    if (this.y + height <= this.pageHeight - CONTENT_BOTTOM) return false;
    this.pages.push([]);
    this.y = CONTENT_TOP;
    return true;
  }

  image(x, y, w, h, dataUrl) {
    const xobject = buildImageXObject(dataUrl);
    if (!xobject) return false;
    const scale = Math.min(w / xobject.width, h / xobject.height);
    const drawW = xobject.width * scale;
    const drawH = xobject.height * scale;
    const drawX = x + (w - drawW) / 2;
    const drawY = y + (h - drawH) / 2;
    const name = `Im${this.images.length}`;
    this.images.push({ pageIndex: this.pages.length - 1, name, xobject });
    this.ops.push(`q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${drawX.toFixed(2)} ${(this.pageHeight - drawY - drawH).toFixed(2)} cm /${name} Do Q`);
    return true;
  }

  rect(x, y, w, h, { fill = null, stroke = LINE, width = 1 } = {}) {
    const pdfY = this.pageHeight - y - h;
    const paint = fill && stroke ? "B" : fill ? "f" : "S";
    const fillCmd = fill ? color(fill, "rg") : "";
    const strokeCmd = stroke ? color(stroke, "RG") : "";
    this.ops.push(`q ${fillCmd} ${strokeCmd} ${width} w ${x} ${pdfY} ${w} ${h} re ${paint} Q`);
  }

  line(x1, y1, x2, y2, stroke = LINE, width = 1) {
    this.ops.push(`q ${color(stroke, "RG")} ${width} w ${x1} ${this.pageHeight - y1} m ${x2} ${this.pageHeight - y2} l S Q`);
  }

  circle(cx, cy, r, { fill = null, stroke = null, width = 1 } = {}) {
    const k = r * 0.5523; // bezier control-point offset for a circular arc
    const y0 = this.pageHeight - cy;
    const paint = fill && stroke ? "B" : fill ? "f" : "S";
    const fillCmd = fill ? color(fill, "rg") : "";
    const strokeCmd = stroke ? color(stroke, "RG") : "";
    this.ops.push(
      `q ${fillCmd} ${strokeCmd} ${width} w ` +
      `${cx} ${y0 - r} m ` +
      `${cx + k} ${y0 - r} ${cx + r} ${y0 - k} ${cx + r} ${y0} c ` +
      `${cx + r} ${y0 + k} ${cx + k} ${y0 + r} ${cx} ${y0 + r} c ` +
      `${cx - k} ${y0 + r} ${cx - r} ${y0 + k} ${cx - r} ${y0} c ` +
      `${cx - r} ${y0 - k} ${cx - k} ${y0 - r} ${cx} ${y0 - r} c ` +
      `${paint} Q`
    );
  }

  text(x, y, value, { size = 10, bold = false, fill = NAVY } = {}) {
    const font = bold ? "F2" : "F1";
    this.ops.push(`BT ${color(fill, "rg")} /${font} ${size} Tf ${x} ${this.pageHeight - y} Td (${pdfText(value)}) Tj ET`);
  }

  wrapped(x, y, value, maxChars, options = {}) {
    const lines = wrapText(value, maxChars);
    lines.forEach((line, index) => this.text(x, y + index * ((options.size || 10) + 4), line, options));
    return lines.length * ((options.size || 10) + 4);
  }
}

export function createPdf(pages, images = [], { width = PAGE_WIDTH, height = PAGE_HEIGHT } = {}) {
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const kids = [];
  let nextObject = 5;

  const imagesByPage = new Map();
  images.forEach((img) => {
    let smaskRef = "";
    if (img.xobject.smask) {
      const smaskObj = nextObject++;
      const smaskStream = img.xobject.smask.stream;
      objects[smaskObj] = `<< /Type /XObject /Subtype /Image /Width ${img.xobject.width} /Height ${img.xobject.height} /ColorSpace /${img.xobject.smask.colorSpace} /BitsPerComponent ${img.xobject.smask.bpc} /Filter /${img.xobject.smask.filter} /Length ${smaskStream.length} >>\nstream\n${smaskStream.toString("latin1")}\nendstream`;
      smaskRef = ` /SMask ${smaskObj} 0 R`;
    }
    const imgObj = nextObject++;
    const mainStream = img.xobject.main.stream;
    objects[imgObj] = `<< /Type /XObject /Subtype /Image /Width ${img.xobject.width} /Height ${img.xobject.height} /ColorSpace /${img.xobject.main.colorSpace} /BitsPerComponent ${img.xobject.main.bpc} /Filter /${img.xobject.main.filter}${smaskRef} /Length ${mainStream.length} >>\nstream\n${mainStream.toString("latin1")}\nendstream`;
    img.objNum = imgObj;
    if (!imagesByPage.has(img.pageIndex)) imagesByPage.set(img.pageIndex, []);
    imagesByPage.get(img.pageIndex).push(img);
  });

  pages.forEach((ops, pageIdx) => {
    const pageObject = nextObject++;
    const contentObject = nextObject++;
    kids.push(`${pageObject} 0 R`);
    const stream = `${ops.join("\n")}\n`;
    objects[contentObject] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`;
    const pageImages = imagesByPage.get(pageIdx) || [];
    const xobjectDict = pageImages.length ? ` /XObject << ${pageImages.map((img) => `/${img.name} ${img.objNum} 0 R`).join(" ")} >>` : "";
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjectDict} >> /Contents ${contentObject} 0 R >>`;
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(pdf, "latin1");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

export function pdfTextOp(x, y, value, { size = 8, bold = false, fill = "#687386" } = {}) {
  const font = bold ? "F2" : "F1";
  return `BT ${color(fill, "rg")} /${font} ${size} Tf ${x} ${PAGE_HEIGHT - y} Td (${pdfText(value)}) Tj ET`;
}

export function cityFromAddress(value) {
  const text = fixText(value || "");
  const match = text.match(/\b\d{5}\s+([\p{L}'\s-]+)/u);
  if (match?.[1]) return match[1].trim();
  const parts = text.split(/\n|,/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].replace(/^\d{5}\s*/, "") : "";
}

export function quoteDateValue(quote) {
  return quote.quoteDate || quote.createdAt || quote.createdAtIso || new Date();
}

export function quoteCityDate(quote, project, company) {
  const city = fixText(
    quote.city
    || quote.chantierCity
    || quote.projectCity
    || project?.city
    || company?.city
    || cityFromAddress(quote.chantierAddress || project?.address || project?.fullAddress || company?.addressLine2)
  );
  const date = formatDate(quoteDateValue(quote));
  return city ? `${city}, le ${date}` : `Le ${date}`;
}

export function vatRateFromQuote(quote) {
  const explicit = Number(quote.vatRate ?? quote.tvaRate ?? quote.tva ?? 0);
  if (explicit > 0) return explicit > 1 ? explicit / 100 : explicit;
  const totalHt = Number(quote.totalHt || 0);
  const totalTtc = Number(quote.totalTtc || 0);
  if (totalHt > 0 && totalTtc > totalHt) return (totalTtc - totalHt) / totalHt;
  return 0.2;
}

export function itemMaterialsTotal(item) {
  return (item.materialLines || []).reduce((sum, material) => {
    const quantity = Number(material.unitsToBuy || material.quantityNeeded || material.quantity || 0);
    const unitPrice = Number(material.unitPrice || material.priceHt || material.salePriceHt || 0);
    return sum + Number(material.total || material.totalHt || quantity * unitPrice || 0);
  }, 0);
}

export function itemTotalHt(item) {
  const fixed = Number(item.fixedAmountHt || item.forfaitHt || item.fixedHt || 0);
  const labor = Number(item.laborCost || item.laborCostHt || item.mainOeuvreHt || 0);
  const materials = itemMaterialsTotal(item);
  if (Number(item.totalHt || 0)) return Number(item.totalHt);
  if (item.billingMode === "fixed" && fixed) return fixed + materials;
  if (fixed) return fixed + materials;
  return labor + materials;
}

export function itemQuantity(item) {
  const quantity = Number(item.quantity ?? item.qty ?? 1);
  return quantity > 0 ? quantity : 1;
}

export function itemUnit(item) {
  return fixText(item.unit || item.unite || "u");
}

export function itemUnitPriceHt(item) {
  return itemTotalHt(item) / itemQuantity(item);
}

export function roomLabel(value) {
  return fixText(value || "G\u00e9n\u00e9ral");
}

export function groupedItemsByRoom(items) {
  const groups = [];
  const map = new Map();
  fixObjectText(items || []).forEach((item) => {
    const room = roomLabel(item.room || item.piece || item.roomName);
    if (!map.has(room)) {
      const group = { room, items: [] };
      map.set(room, group);
      groups.push(group);
    }
    map.get(room).items.push(item);
  });
  return groups;
}

export function quoteAddress(quote, project) {
  return fixText(
    quote.chantierAddress
    || quote.projectAddress
    || project?.fullAddress
    || project?.address
    || [project?.street, project?.zip, project?.city].filter(Boolean).join(" ")
  );
}

export function companyLines(company) {
  return [
    company.name,
    company.addressLine1,
    company.addressLine2,
    company.email,
    company.phone,
    company.siret ? `SIRET : ${company.siret}` : "",
    company.tva ? `TVA : ${company.tva}` : ""
  ].filter(Boolean).map(fixText);
}

export function companyContactLines(company) {
  return [
    company.name,
    company.addressLine1,
    company.addressLine2,
    company.email,
    company.phone
  ].filter(Boolean).map(fixText);
}

export function companyFooterLegal(company) {
  const siret = fixText(company.siret || "");
  const rcs = fixText(company.rcs || company.siren || "");
  return {
    siret,
    rcs: rcs && rcs !== siret ? rcs : "",
    tva: fixText(company.tva || ""),
    legalForm: fixText(company.legalForm || "SAS"),
    capital: fixText(company.capital || "")
  };
}

export function companyFooterCenterLines(company) {
  const legal = companyFooterLegal(company);
  return [
    [company.name || "Koji", legal.legalForm, legal.capital ? `Capital social : ${legal.capital}` : "Capital social : -"].filter(Boolean).join(" - "),
    legal.tva ? `TVA : ${legal.tva}` : "TVA : -",
    legal.siret ? `SIRET : ${legal.siret}` : "SIRET : -"
  ].map((line) => fixText(line));
}

export function cleanQuoteNumber(value) {
  const raw = fixText(value || "");
  const cleaned = raw
    .replace(/^devis\s*n[?o]\s*:?\s*/i, "")
    .replace(/^devis[-_\s]*/i, "")
    .replace(/^dev[-_\s]*/i, "");
  return cleaned || raw;
}

export function displayQuoteNumber(value, label = "Devis") {
  const cleaned = cleanQuoteNumber(value);
  return cleaned ? `${label} N\u00b0: ${cleaned}` : `${label} N\u00b0`;
}

export function quoteVersionNumber(quote = {}) {
  const raw = quote.version ?? quote.quoteVersion ?? quote.versionNumber ?? quote.revision ?? 1;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return String(Math.trunc(numeric)).padStart(2, "0");
  }
  const cleaned = fixText(raw || "01").replace(/^v(?:ersion)?\s*/i, "").replace(/\D/g, "");
  return (cleaned || "1").padStart(2, "0");
}

export function displayQuoteVersion(quote = {}) {
  return `Version N\u00b0: ${quoteVersionNumber(quote)}`;
}

export function clientLines(quote, project) {
  return [
    quote.client || project?.client || "Client",
    quote.clientEmail,
    quote.clientPhone,
    quote.clientAddress || project?.clientAddress || ""
  ].filter(Boolean).map(fixText);
}

export function paymentInfoFromQuote(quote, company) {
  const payment = fixObjectText(quote.payment || quote.bank || {});
  return {
    iban: fixText(payment.iban || quote.iban || company.iban || ""),
    holder: fixText(payment.holder || payment.bankHolder || quote.bankHolder || company.bankHolder || company.name || ""),
    bic: fixText(payment.bic || payment.swift || quote.bic || company.bic || "")
  };
}

export function paymentConditions(quote, company) {
  const custom = fixText(quote.paymentConditions || quote.conditionsReglement || company.paymentTerms || "");
  const deposit = Number(quote.depositPercent || quote.acomptePercent || 0);
  const delay = fixText(quote.paymentDelay || quote.delaiPaiement || "30 jours");
  const validity = fixText(quote.validityDays || quote.validite || "30 jours");
  const lines = [];
  if (deposit) lines.push(`Acompte a la signature : ${deposit.toLocaleString("fr-FR")}%`);
  lines.push(`Delai de paiement : ${delay}`);
  lines.push(`Validite du devis : ${validity}`);
  if (custom) custom.split(/\r?\n/).forEach((line) => lines.push(line));
  if (quote.legalMentions) fixText(quote.legalMentions).split(/\r?\n/).forEach((line) => lines.push(line));
  return lines;
}

export function addPdfFooters(pages, { company, quoteNumber, generatedAt, quote = {}, project = {}, documentLabel = "Devis", showVersion = true }) {
  const total = pages.length;
  const cityDate = quoteCityDate(quote, project, company);
  const number = displayQuoteNumber(quoteNumber || quote.quoteNumber, documentLabel);
  const version = showVersion ? displayQuoteVersion(quote) : "";
  const footerCenterLines = companyFooterCenterLines(company);

  return pages.map((pageOps, index) => {
    const ops = [];
    ops.push(pdfTextOp(MARGIN, 28, cityDate, { size: 8.5, fill: "#687386" }));
    ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 132, 28, number, { size: 8.8, bold: true, fill: NAVY }));
    if (version) ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 132, 41, version, { size: 7.8, fill: "#687386" }));
    ops.push(`q ${color(LINE, "RG")} 0.8 w ${MARGIN} ${PAGE_HEIGHT - 44} m ${PAGE_WIDTH - MARGIN} ${PAGE_HEIGHT - 44} l S Q`);
    ops.push(...pageOps);
    const logoX = MARGIN;
    const logoY = PAGE_HEIGHT - 31;
    const lineY = PAGE_HEIGHT - 36;
    ops.push(`q ${color(LINE, "RG")} 0.8 w ${MARGIN} ${PAGE_HEIGHT - lineY} m ${PAGE_WIDTH - MARGIN} ${PAGE_HEIGHT - lineY} l S Q`);
    ops.push(`q ${color(NAVY, "rg")} ${logoX} ${PAGE_HEIGHT - logoY - 16} 16 16 re f Q`);
    ops.push(pdfTextOp(logoX + 3.2, logoY + 8.6, "KJ", { size: 5.8, bold: true, fill: "#ffffff" }));
    ops.push(pdfTextOp(logoX + 3.4, logoY + 14, "KOJI", { size: 2.6, bold: true, fill: "#ffffff" }));
    ops.push(pdfTextOp(logoX + 22, logoY + 10.8, "Edited by Koji", { size: 7.2, fill: "#687386" }));
    footerCenterLines.forEach((line, lineIndex) => {
      ops.push(pdfTextOp(PAGE_WIDTH / 2 - 104, PAGE_HEIGHT - 31 + lineIndex * 7, line, { size: lineIndex === 0 ? 6.5 : 6.1, bold: lineIndex === 0, fill: "#687386" }));
    });
    ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 20, PAGE_HEIGHT - 19, `${index + 1}/${total}`, { size: 8.5, bold: true, fill: "#687386" }));
    return ops;
  });
}

export function drawHeader(canvas, quote, company, title) {
  canvas.rect(MARGIN, canvas.y, 84, 84, { fill: NAVY, stroke: NAVY });
  canvas.text(MARGIN + 13, canvas.y + 35, "KOJI", { size: 18, bold: true, fill: GOLD });
  canvas.text(MARGIN + 110, canvas.y + 22, company.name, { size: 19, bold: true });
  canvas.text(MARGIN + 110, canvas.y + 41, company.addressLine1 || "Adresse entreprise");
  canvas.text(MARGIN + 110, canvas.y + 58, company.addressLine2 || company.email || "");
  canvas.rect(PAGE_WIDTH - MARGIN - 150, canvas.y + 4, 150, 58, { fill: "#f7eadf", stroke: "#f0ddcb" });
  canvas.text(PAGE_WIDTH - MARGIN - 128, canvas.y + 24, title, { size: 10, bold: true, fill: "#9a7c5c" });
  canvas.text(PAGE_WIDTH - MARGIN - 135, canvas.y + 43, quote.quoteNumber || "DEVIS", { size: 14, bold: true });
  canvas.y += 112;
}

export function quoteTotals(quote, vatRate) {
  const itemHt = (quote.items || []).reduce((sum, item) => sum + itemTotalHt(item), 0);
  const totalHt = Number(quote.totalHt || 0) || itemHt;
  const totalTtc = Number(quote.totalTtc || 0) || totalHt * (1 + vatRate);
  return {
    totalHt,
    vat: Math.max(totalTtc - totalHt, 0),
    totalTtc
  };
}

export function drawInfoColumns(canvas, quote, project, company) {
  const gap = 18;
  const width = (PAGE_WIDTH - MARGIN * 2 - gap) / 2;
  const top = canvas.y;
  const height = 96;
  canvas.ensure(height + 14);
  const hasLogo = Boolean(company.logoDataUrl);
  const companyTextX = hasLogo ? MARGIN + 62 : MARGIN;
  if (hasLogo) {
    const drawn = canvas.image(MARGIN, top + 12, 46, 46, company.logoDataUrl);
    if (!drawn) {
      canvas.rect(MARGIN, top + 12, 46, 46, { fill: NAVY, stroke: NAVY });
      canvas.text(MARGIN + 12, top + 39, "KJ", { size: 15, bold: true, fill: GOLD });
    }
  }
  companyContactLines(company).slice(0, 5).forEach((line, index) => {
    canvas.text(companyTextX, top + 18 + index * 14, line, { size: index === 0 ? 11 : 8.8, bold: index === 0 });
  });

  const clientX = MARGIN + width + gap;
  canvas.text(clientX, top + 18, "Client", { size: 9, fill: "#687386" });
  clientLines(quote, project).slice(0, 6).forEach((line, index) => {
    canvas.text(clientX, top + 38 + index * 15, line, { size: index === 0 ? 11 : 9, bold: index === 0 });
  });
  canvas.y = top + height + 12;
}

export function drawChantierSections(canvas, quote, project) {
  const address = quoteAddress(quote, project);
  const startDate = formatDate(quote.startDate);
  const duration = fixText(quote.expectedDuration || "");
  const description = fixText(
    quote.workDescription
    || quote.descriptionGenerale
    || quote.description
    || project?.description
    || ""
  );
  const width = PAGE_WIDTH - MARGIN * 2;

  canvas.ensure(174);
  canvas.text(MARGIN, canvas.y + 16, "Adresse du chantier", { size: 9, fill: "#687386" });
  canvas.text(MARGIN, canvas.y + 34, address || "Adresse à compléter", { size: 10.5 });
  canvas.y += 50;

  if (startDate || duration) {
    const dateBoxWidth = 186;
    const dateBoxHeight = 38;
    const secondBoxX = MARGIN + dateBoxWidth + 18;
    canvas.rect(MARGIN, canvas.y, dateBoxWidth, dateBoxHeight, { fill: "#ffffff", stroke: LINE });
    canvas.rect(secondBoxX, canvas.y, dateBoxWidth, dateBoxHeight, { fill: "#ffffff", stroke: LINE });
    canvas.text(MARGIN + 10, canvas.y + 15, "Date de d\u00e9but", { size: 8.2, fill: "#687386" });
    canvas.text(MARGIN + 10, canvas.y + 30, startDate, { size: 9.6 });
    canvas.text(secondBoxX + 10, canvas.y + 15, "Dur\u00e9e des travaux", { size: 8.2, fill: "#687386" });
    canvas.text(secondBoxX + 10, canvas.y + 30, duration, { size: 9.6 });
    canvas.y += 52;
  }

  const descLines = description ? wrapText(description, 92) : [];
  const descHeight = Math.max(28, 28 + descLines.length * 12);
  canvas.ensure(descHeight + 8);
  canvas.text(MARGIN, canvas.y + 16, "Description des travaux", { size: 10.5, bold: true });
  descLines.forEach((line, index) => canvas.text(MARGIN, canvas.y + 34 + index * 12, line, { size: 9.5 }));
  canvas.y += descHeight + 10;
}

export const TABLE = {
  x: MARGIN,
  width: PAGE_WIDTH - MARGIN * 2,
  designation: 238,
  quantity: 48,
  unit: 44,
  unitPrice: 86,
  total: 95
};

export function drawTableHeader(canvas) {
  const y = canvas.y;
  canvas.rect(TABLE.x, y, TABLE.width, 24, { fill: NAVY, stroke: NAVY });
  canvas.text(TABLE.x + 10, y + 16, "DESIGNATION", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.designation + 8, y + 16, "QTE", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.designation + TABLE.quantity + 8, y + 16, "UNITE", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.designation + TABLE.quantity + TABLE.unit + 8, y + 16, "P.UNIT HT", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.width - TABLE.total + 8, y + 16, "TOTAL HT", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.y += 24;
}

export function materialSummary(item) {
  if (item.showMaterialsToClient === false || !item.materialLines?.length) return [];
  return item.materialLines
    .map((material) => fixText(material.productName || material.name || material.category || "Fourniture"))
    .filter(Boolean);
}

export function drawQuoteMainTable(canvas, quote) {
  const items = fixObjectText(quote.items || []);
  if (!items.length) {
    canvas.text(MARGIN, canvas.y, "Aucune désignation pour ce devis.");
    canvas.y += 20;
    return;
  }

  drawTableHeader(canvas);
  groupedItemsByRoom(items).forEach((group) => {
    // Variante (PRO-03.1) : montrée au client, hors du sous-total et du total.
    const subtotal = group.items.filter((item) => !item.variante).reduce((sum, item) => sum + itemTotalHt(item), 0);
    if (canvas.ensure(32)) drawTableHeader(canvas);
    canvas.rect(TABLE.x, canvas.y, TABLE.width, 28, { fill: "#f7eadf", stroke: "#f0ddcb" });
    canvas.text(TABLE.x + 10, canvas.y + 19, group.room, { size: 10, bold: true, fill: "#9a5a16" });
    canvas.y += 28;

    group.items.forEach((item) => {
      const labelLines = wrapText(`${item.variante ? "Variante, non comprise dans le total : " : ""}${fixText(item.label || "Ouvrage")}`, 42);
      const descriptionLines = item.description ? wrapText(fixText(item.description), 46) : [];
      const subLines = (item.subWorks || item.children || [])
        .map((subWork) => `- ${fixText(subWork.label || subWork.name || subWork.designation || "")}`)
        .filter((line) => line.length > 2);
      const supplies = materialSummary(item);
      const supplyLines = supplies.length ? wrapText(`Fournitures associées : ${supplies.join(", ")}`, 46) : [];
      const detailLines = [...descriptionLines, ...subLines, ...supplyLines];
      const rowHeight = Math.max(48, 26 + labelLines.length * 12 + detailLines.length * 10);
      if (canvas.ensure(rowHeight)) drawTableHeader(canvas);
      canvas.rect(TABLE.x, canvas.y, TABLE.width, rowHeight, { fill: "#ffffff", stroke: LINE });
      labelLines.forEach((line, lineIndex) => {
        canvas.text(TABLE.x + 10, canvas.y + 18 + lineIndex * 12, line, { size: 8.6, bold: lineIndex === 0 });
      });
      detailLines.forEach((line, lineIndex) => {
        canvas.text(TABLE.x + 18, canvas.y + 20 + labelLines.length * 12 + lineIndex * 10, line, { size: 7.6, fill: "#687386" });
      });

      const qteX = TABLE.x + TABLE.designation + 8;
      const unitX = qteX + TABLE.quantity;
      const unitPriceX = unitX + TABLE.unit;
      const totalX = TABLE.x + TABLE.width - TABLE.total + 8;
      canvas.text(qteX, canvas.y + 20, itemQuantity(item).toLocaleString("fr-FR"), { size: 8.2 });
      canvas.text(unitX, canvas.y + 20, itemUnit(item), { size: 8.2 });
      canvas.text(unitPriceX, canvas.y + 20, money(itemUnitPriceHt(item)), { size: 8.2 });
      canvas.text(totalX, canvas.y + 20, money(itemTotalHt(item)), { size: 8.2, bold: true });
      canvas.y += rowHeight;
    });

    if (canvas.ensure(24)) drawTableHeader(canvas);
    canvas.rect(TABLE.x, canvas.y, TABLE.width, 24, { fill: SOFT, stroke: LINE });
    canvas.text(TABLE.x + 10, canvas.y + 16, `Sous-total ${group.room}`, { size: 8.2, bold: true, fill: "#687386" });
    canvas.text(TABLE.x + TABLE.width - 88, canvas.y + 16, money(subtotal), { size: 8.2, bold: true });
    canvas.y += 30;
  });
}

// TVA du devis par taux (PRO-03.5) : une ligne par taux quand des lignes
// ont un taux propre ; autoliquidation sans TVA.
export function lignesTvaDocument(quote, vatRate) {
  if (quote.autoliquidation) return [{ label: "TVA autoliquidation", montant: 0 }];
  const items = (quote.items || []).filter((item) => !item.variante);
  const itemsHt = items.reduce((sum, item) => sum + itemTotalHt(item), 0);
  if (!items.some((item) => item.tauxTva != null)) {
    const totals = quoteTotals(quote, vatRate);
    return [{ label: `TVA ${(vatRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`, montant: totals.vat }];
  }
  const majorations = computeSurchargeBreakdown(itemsHt, quote.surcharges || []).total;
  const ventilation = ventilerTva(items.map((item) => ({ ht: itemTotalHt(item), taux: item.tauxTva })), majorations, Math.round(vatRate * 10000) / 100);
  return ventilation.parTaux.map((t) => ({ label: `TVA ${t.taux.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`, montant: t.tva }));
}

// Mentions TVA du document (PRO-03.5) : attestation du client pour le taux
// réduit, autoliquidation, numéro de commande du client.
export function mentionsTvaDocument(quote, vatRate) {
  const lignes = [];
  const commande = fixText(quote.tva?.commande || "");
  if (commande) lignes.push({ titre: "", texte: `Numéro de commande du client : ${commande}` });
  if (quote.autoliquidation) {
    lignes.push({ titre: "", texte: MENTION_AUTOLIQUIDATION });
  } else if (estTauxReduit(vatRate * 100) || (quote.items || []).some((item) => estTauxReduit(item.tauxTva))) {
    const signe = quote.mentionTva
      ? `Certifiée par ${fixText(quote.signerName || quote.client || "le client")} le ${formatDate(quote.mentionTvaLe || quote.signedAt)}.`
      : "À certifier par le client à la signature du devis.";
    lignes.push({ titre: "Attestation du client (TVA à taux réduit)", texte: `${MENTION_TAUX_REDUIT} ${signe}` });
  }
  return lignes;
}

export function drawMentionsTva(canvas, quote, vatRate) {
  const mentions = mentionsTvaDocument(quote, vatRate);
  if (!mentions.length) return;
  const lignes = mentions.flatMap((m) => [...(m.titre ? [{ texte: m.titre, gras: true }] : []), ...wrapText(m.texte, 96).map((t) => ({ texte: t, gras: false }))]);
  const height = 16 + lignes.length * 12;
  canvas.ensure(height + 10);
  lignes.forEach((l, index) => {
    canvas.text(MARGIN, canvas.y + 14 + index * 12, l.texte, { size: 8.5, bold: l.gras, fill: l.gras ? "#171B1E" : "#687386" });
  });
  canvas.y += height + 8;
}

export function drawTotalsAndPayment(canvas, quote, company, vatRate) {
  const totals = quoteTotals(quote, vatRate);
  const lignesTva = lignesTvaDocument(quote, vatRate);
  const itemsHt = (quote.items || []).reduce((sum, item) => sum + itemTotalHt(item), 0);
  const clientSurcharges = computeSurchargeBreakdown(itemsHt, quote.surcharges || [])
    .lines.filter((s) => s.mode === "client" || (!s.mode && s.showToClient));
  const hasSurcharges = clientSurcharges.length > 0;
  const surchargeRowH = 22;
  const extraH = (hasSurcharges ? clientSurcharges.length * surchargeRowH : 0) + (lignesTva.length - 1) * 22;
  const boxH = 92 + extraH;
  canvas.ensure(boxH + 152);
  const width = PAGE_WIDTH - MARGIN * 2;
  const totalsX = PAGE_WIDTH - MARGIN - 236;
  canvas.rect(totalsX, canvas.y, 236, boxH, { fill: "#ffffff", stroke: LINE });
  let rowY = 24;
  if (hasSurcharges) {
    clientSurcharges.forEach((s) => {
      canvas.text(totalsX + 14, canvas.y + rowY, `${fixText(s.label || "")} ${Number(s.percent)}%`, { size: 8.5, fill: "#687386" });
      canvas.text(totalsX + 152, canvas.y + rowY, money(s.amount), { size: 9, bold: true });
      rowY += surchargeRowH;
    });
  }
  canvas.text(totalsX + 14, canvas.y + rowY, "Total HT", { size: 9, fill: "#687386" });
  canvas.text(totalsX + 152, canvas.y + rowY, money(totals.totalHt), { size: 9.5, bold: true });
  rowY += 22;
  lignesTva.forEach((l, index) => {
    canvas.text(totalsX + 14, canvas.y + rowY, l.label, { size: 9, fill: "#687386" });
    canvas.text(totalsX + 152, canvas.y + rowY, money(l.montant), { size: 9.5, bold: true });
    rowY += index === lignesTva.length - 1 ? 16 : 22;
  });
  canvas.rect(totalsX, canvas.y + rowY, 236, 30, { fill: NAVY, stroke: NAVY });
  canvas.text(totalsX + 14, canvas.y + rowY + 20, quote.autoliquidation ? "Net à payer" : "Total TTC", { size: 10, bold: true, fill: "#ffffff" });
  canvas.text(totalsX + 146, canvas.y + rowY + 20, money(totals.totalTtc), { size: 10.5, bold: true, fill: GOLD });
  canvas.y += boxH + 20;

  const payment = paymentInfoFromQuote(quote, company);
  canvas.rect(MARGIN, canvas.y, width, 60, { fill: "#ffffff", stroke: LINE });
  canvas.text(MARGIN + 14, canvas.y + 22, "Informations de paiement", { size: 10, bold: true });
  canvas.text(MARGIN + 310, canvas.y + 22, `Titulaire : ${payment.holder || "À compléter"}`, { size: 8.6, fill: "#687386" });
  canvas.text(MARGIN + 14, canvas.y + 42, `IBAN : ${payment.iban || "À compléter"}`, { size: 8.6, fill: "#687386" });
  canvas.text(MARGIN + 310, canvas.y + 42, `BIC/SWIFT : ${payment.bic || "À compléter"}`, { size: 8.6, fill: "#687386" });
  canvas.y += 76;

  const conditionLines = paymentConditions(quote, company).flatMap((line) => wrapText(line, 88));
  const height = Math.max(58, 30 + conditionLines.length * 12);
  canvas.ensure(height + 20);
  canvas.text(MARGIN, canvas.y + 18, "Conditions de règlement", { size: 10, bold: true });
  conditionLines.forEach((line, index) => {
    canvas.text(MARGIN, canvas.y + 36 + index * 12, line, { size: 8.5, fill: "#687386" });
  });
  canvas.y += height + 14;
  drawMentionsTva(canvas, quote, vatRate);
}

