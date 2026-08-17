import zlib from "zlib";
import QRCode from "qrcode";
import { fixObjectText, fixText } from "./text";
import { isoWeekInfo } from "./worker-portal";
import { computeSurchargeBreakdown } from "./quote-calculations";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_TOP = 74;
const CONTENT_BOTTOM = 54;
const NAVY = "#06132d";
const GOLD = "#e6d7c4";
const BLUE = "#2450a7";
const LINE = "#dfe6f0";
const SOFT = "#f4f6fa";

function money(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function sanitizeFilename(value) {
  return fixText(value || "document")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function companyFromDb(db, userId) {
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

function companyFromQuote(quote, db) {
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

function hexToRgb(hex) {
  const cleaned = hex.replace("#", "");
  return [
    parseInt(cleaned.slice(0, 2), 16) / 255,
    parseInt(cleaned.slice(2, 4), 16) / 255,
    parseInt(cleaned.slice(4, 6), 16) / 255
  ];
}

function color(hex, op) {
  return `${hexToRgb(hex).map((n) => n.toFixed(3)).join(" ")} ${op}`;
}

function pdfText(value) {
  return fixText(String(value ?? ""))
    .replaceAll("?", "\x80")
    .replaceAll("?", "\x9c")
    .replaceAll("?", "\x8c")
    .replaceAll("?", "-")
    .replaceAll("?", "-")
    .replaceAll("?", "'")
    .replaceAll("?", "\"")
    .replaceAll("?", "\"")
    .replaceAll("?", "...")
    .replace(/[^\x00-\xff]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(value, maxChars) {
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

function parseDataUrl(dataUrl) {
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

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function unfilterPng(raw, width, height, bytesPerPixel) {
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

function decodePng(buffer) {
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

function readJpegDimensions(buffer) {
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

function buildImageXObject(dataUrl) {
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

class PdfCanvas {
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

function createPdf(pages, images = [], { width = PAGE_WIDTH, height = PAGE_HEIGHT } = {}) {
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

function pdfTextOp(x, y, value, { size = 8, bold = false, fill = "#687386" } = {}) {
  const font = bold ? "F2" : "F1";
  return `BT ${color(fill, "rg")} /${font} ${size} Tf ${x} ${PAGE_HEIGHT - y} Td (${pdfText(value)}) Tj ET`;
}

function cityFromAddress(value) {
  const text = fixText(value || "");
  const match = text.match(/\b\d{5}\s+([\p{L}'\s-]+)/u);
  if (match?.[1]) return match[1].trim();
  const parts = text.split(/\n|,/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1].replace(/^\d{5}\s*/, "") : "";
}

function quoteDateValue(quote) {
  return quote.quoteDate || quote.createdAt || quote.createdAtIso || new Date();
}

function quoteCityDate(quote, project, company) {
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

function vatRateFromQuote(quote) {
  const explicit = Number(quote.vatRate ?? quote.tvaRate ?? quote.tva ?? 0);
  if (explicit > 0) return explicit > 1 ? explicit / 100 : explicit;
  const totalHt = Number(quote.totalHt || 0);
  const totalTtc = Number(quote.totalTtc || 0);
  if (totalHt > 0 && totalTtc > totalHt) return (totalTtc - totalHt) / totalHt;
  return 0.2;
}

function itemMaterialsTotal(item) {
  return (item.materialLines || []).reduce((sum, material) => {
    const quantity = Number(material.unitsToBuy || material.quantityNeeded || material.quantity || 0);
    const unitPrice = Number(material.unitPrice || material.priceHt || material.salePriceHt || 0);
    return sum + Number(material.total || material.totalHt || quantity * unitPrice || 0);
  }, 0);
}

function itemTotalHt(item) {
  const fixed = Number(item.fixedAmountHt || item.forfaitHt || item.fixedHt || 0);
  const labor = Number(item.laborCost || item.laborCostHt || item.mainOeuvreHt || 0);
  const materials = itemMaterialsTotal(item);
  if (Number(item.totalHt || 0)) return Number(item.totalHt);
  if (item.billingMode === "fixed" && fixed) return fixed + materials;
  if (fixed) return fixed + materials;
  return labor + materials;
}

function itemQuantity(item) {
  const quantity = Number(item.quantity ?? item.qty ?? 1);
  return quantity > 0 ? quantity : 1;
}

function itemUnit(item) {
  return fixText(item.unit || item.unite || "u");
}

function itemUnitPriceHt(item) {
  return itemTotalHt(item) / itemQuantity(item);
}

function roomLabel(value) {
  return fixText(value || "G\u00e9n\u00e9ral");
}

function groupedItemsByRoom(items) {
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

function quoteAddress(quote, project) {
  return fixText(
    quote.chantierAddress
    || quote.projectAddress
    || project?.fullAddress
    || project?.address
    || [project?.street, project?.zip, project?.city].filter(Boolean).join(" ")
  );
}

function companyLines(company) {
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

function companyContactLines(company) {
  return [
    company.name,
    company.addressLine1,
    company.addressLine2,
    company.email,
    company.phone
  ].filter(Boolean).map(fixText);
}

function companyFooterLegal(company) {
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

function companyFooterCenterLines(company) {
  const legal = companyFooterLegal(company);
  return [
    [company.name || "Koji", legal.legalForm, legal.capital ? `Capital social : ${legal.capital}` : "Capital social : -"].filter(Boolean).join(" - "),
    legal.tva ? `TVA : ${legal.tva}` : "TVA : -",
    legal.siret ? `SIRET : ${legal.siret}` : "SIRET : -"
  ].map((line) => fixText(line));
}

function cleanQuoteNumber(value) {
  const raw = fixText(value || "");
  const cleaned = raw
    .replace(/^devis\s*n[?o]\s*:?\s*/i, "")
    .replace(/^devis[-_\s]*/i, "")
    .replace(/^dev[-_\s]*/i, "");
  return cleaned || raw;
}

function displayQuoteNumber(value, label = "Devis") {
  const cleaned = cleanQuoteNumber(value);
  return cleaned ? `${label} N\u00b0: ${cleaned}` : `${label} N\u00b0`;
}

function quoteVersionNumber(quote = {}) {
  const raw = quote.version ?? quote.quoteVersion ?? quote.versionNumber ?? quote.revision ?? 1;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return String(Math.trunc(numeric)).padStart(2, "0");
  }
  const cleaned = fixText(raw || "01").replace(/^v(?:ersion)?\s*/i, "").replace(/\D/g, "");
  return (cleaned || "1").padStart(2, "0");
}

function displayQuoteVersion(quote = {}) {
  return `Version N\u00b0: ${quoteVersionNumber(quote)}`;
}

function clientLines(quote, project) {
  return [
    quote.client || project?.client || "Client",
    quote.clientEmail,
    quote.clientPhone,
    quote.clientAddress || project?.clientAddress || ""
  ].filter(Boolean).map(fixText);
}

function paymentInfoFromQuote(quote, company) {
  const payment = fixObjectText(quote.payment || quote.bank || {});
  return {
    iban: fixText(payment.iban || quote.iban || company.iban || ""),
    holder: fixText(payment.holder || payment.bankHolder || quote.bankHolder || company.bankHolder || company.name || ""),
    bic: fixText(payment.bic || payment.swift || quote.bic || company.bic || "")
  };
}

function paymentConditions(quote, company) {
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

function addPdfFooters(pages, { company, quoteNumber, generatedAt, quote = {}, project = {}, documentLabel = "Devis", showVersion = true }) {
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

function drawHeader(canvas, quote, company, title) {
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

function quoteTotals(quote, vatRate) {
  const itemHt = (quote.items || []).reduce((sum, item) => sum + itemTotalHt(item), 0);
  const totalHt = Number(quote.totalHt || 0) || itemHt;
  const totalTtc = Number(quote.totalTtc || 0) || totalHt * (1 + vatRate);
  return {
    totalHt,
    vat: Math.max(totalTtc - totalHt, 0),
    totalTtc
  };
}

function drawInfoColumns(canvas, quote, project, company) {
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

function drawChantierSections(canvas, quote, project) {
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

const TABLE = {
  x: MARGIN,
  width: PAGE_WIDTH - MARGIN * 2,
  designation: 238,
  quantity: 48,
  unit: 44,
  unitPrice: 86,
  total: 95
};

function drawTableHeader(canvas) {
  const y = canvas.y;
  canvas.rect(TABLE.x, y, TABLE.width, 24, { fill: NAVY, stroke: NAVY });
  canvas.text(TABLE.x + 10, y + 16, "DESIGNATION", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.designation + 8, y + 16, "QTE", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.designation + TABLE.quantity + 8, y + 16, "UNITE", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.designation + TABLE.quantity + TABLE.unit + 8, y + 16, "P.UNIT HT", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.text(TABLE.x + TABLE.width - TABLE.total + 8, y + 16, "TOTAL HT", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.y += 24;
}

function materialSummary(item) {
  if (item.showMaterialsToClient === false || !item.materialLines?.length) return [];
  return item.materialLines
    .map((material) => fixText(material.productName || material.name || material.category || "Fourniture"))
    .filter(Boolean);
}

function drawQuoteMainTable(canvas, quote) {
  const items = fixObjectText(quote.items || []);
  if (!items.length) {
    canvas.text(MARGIN, canvas.y, "Aucune désignation pour ce devis.");
    canvas.y += 20;
    return;
  }

  drawTableHeader(canvas);
  groupedItemsByRoom(items).forEach((group) => {
    const subtotal = group.items.reduce((sum, item) => sum + itemTotalHt(item), 0);
    if (canvas.ensure(32)) drawTableHeader(canvas);
    canvas.rect(TABLE.x, canvas.y, TABLE.width, 28, { fill: "#f7eadf", stroke: "#f0ddcb" });
    canvas.text(TABLE.x + 10, canvas.y + 19, group.room, { size: 10, bold: true, fill: "#9a5a16" });
    canvas.y += 28;

    group.items.forEach((item) => {
      const labelLines = wrapText(fixText(item.label || "Ouvrage"), 42);
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

function drawTotalsAndPayment(canvas, quote, company, vatRate) {
  const totals = quoteTotals(quote, vatRate);
  const vatLabel = `TVA ${(vatRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`;
  const itemsHt = (quote.items || []).reduce((sum, item) => sum + itemTotalHt(item), 0);
  const clientSurcharges = computeSurchargeBreakdown(itemsHt, quote.surcharges || [])
    .lines.filter((s) => s.mode === "client" || (!s.mode && s.showToClient));
  const hasSurcharges = clientSurcharges.length > 0;
  const surchargeRowH = 22;
  const extraH = hasSurcharges ? clientSurcharges.length * surchargeRowH : 0;
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
  canvas.text(totalsX + 14, canvas.y + rowY, vatLabel, { size: 9, fill: "#687386" });
  canvas.text(totalsX + 152, canvas.y + rowY, money(totals.vat), { size: 9.5, bold: true });
  rowY += 16;
  canvas.rect(totalsX, canvas.y + rowY, 236, 30, { fill: NAVY, stroke: NAVY });
  canvas.text(totalsX + 14, canvas.y + rowY + 20, "Total TTC", { size: 10, bold: true, fill: "#ffffff" });
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
}

export function buildQuotePdf({ quote, project, db, documentType = "devis" }) {
  const isFacture = documentType === "facture";
  const canvas = new PdfCanvas();
  const company = companyFromQuote(quote, db);
  const vatRate = vatRateFromQuote(quote);
  drawInfoColumns(canvas, quote, project, company);
  drawChantierSections(canvas, quote, project);
  drawQuoteMainTable(canvas, quote);
  drawTotalsAndPayment(canvas, quote, company, vatRate);
  if (!isFacture) {
    canvas.ensure(84);
    const signatureX = PAGE_WIDTH - MARGIN - 250;
    if (quote.signaturePlace || quote.signedAt) {
      canvas.text(signatureX, canvas.y + 12, `Fait a ${fixText(quote.signaturePlace || "__________")}, le ${formatDate(quote.signedAt || new Date())}.`, { size: 9.5, fill: "#687386" });
      canvas.y += 18;
    }
    canvas.text(signatureX, canvas.y + 12, "Bon pour accord", { size: 10, fill: "#687386" });
    canvas.text(signatureX, canvas.y + 28, "Date et signature du client :", { size: 9, fill: "#687386" });
    canvas.line(signatureX, canvas.y + 58, PAGE_WIDTH - MARGIN, canvas.y + 58, LINE);
    canvas.line(signatureX, canvas.y + 76, PAGE_WIDTH - MARGIN, canvas.y + 76, LINE);
  }
  return createPdf(addPdfFooters(canvas.pages, {
    company,
    quoteNumber: quote.quoteNumber,
    generatedAt: new Date(),
    quote,
    project,
    documentLabel: isFacture ? "Facture" : "Devis",
    showVersion: !isFacture
  }), canvas.images);
}

function supplyLinesFromQuote(quote, db) {
  const supplies = db.supplies || [];
  const lines = [];
  (quote.items || []).forEach((item) => {
    (item.materialLines || []).forEach((material) => {
      const supply = supplies.find((candidate) => candidate.id === material.productId) || {};
      lines.push({
        ouvrage: fixText(item.label || ""),
        name: fixText(material.productName || supply.name || material.category || "Fourniture"),
        category: fixText(material.category || supply.category || "Divers"),
        supplier: fixText(supply.supplier || supply.supplierName || ""),
        quantity: Number(material.unitsToBuy || material.quantityNeeded || 0),
        unitPrice: Number(material.unitPrice || supply.priceHt || supply.salePriceHt || 0),
        total: Number(material.total || 0)
      });
    });
  });
  return lines;
}

export function buildSuppliesPdf({ quote, db }) {
  const canvas = new PdfCanvas();
  const company = companyFromQuote(quote, db);
  drawHeader(canvas, quote, company, "FOURNITURES");
  canvas.text(MARGIN, canvas.y, "LISTE FOURNISSEURS / FOURNITURES", { size: 15, bold: true });
  canvas.y += 30;
  const lines = supplyLinesFromQuote(quote, db);
  if (!lines.length) {
    canvas.text(MARGIN, canvas.y, "Aucune fourniture liée à ce devis.");
    return createPdf(addPdfFooters(canvas.pages, { company, quoteNumber: quote.quoteNumber, generatedAt: new Date() }));
  }
  lines.forEach((line) => {
    canvas.ensure(54);
    canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 46, { fill: "#ffffff", stroke: LINE });
    canvas.text(MARGIN + 12, canvas.y + 18, line.name, { size: 11, bold: true });
    canvas.text(MARGIN + 12, canvas.y + 34, `${line.category}${line.supplier ? ` - ${line.supplier}` : ""}`, { size: 9, fill: "#687386" });
    canvas.text(PAGE_WIDTH - MARGIN - 170, canvas.y + 18, `Qté ${line.quantity.toLocaleString("fr-FR")}`, { size: 9, fill: "#687386" });
    canvas.text(PAGE_WIDTH - MARGIN - 92, canvas.y + 18, money(line.total), { size: 11, bold: true });
    canvas.y += 54;
  });
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  canvas.ensure(42);
  canvas.rect(PAGE_WIDTH - MARGIN - 210, canvas.y, 210, 38, { fill: NAVY, stroke: NAVY });
  canvas.text(PAGE_WIDTH - MARGIN - 194, canvas.y + 24, "TOTAL FOURNITURES", { size: 11, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 82, canvas.y + 24, money(total), { size: 11, bold: true, fill: GOLD });
  return createPdf(addPdfFooters(canvas.pages, { company, quoteNumber: quote.quoteNumber, generatedAt: new Date() }));
}

function htmlEscape(value) {
  return fixText(String(value ?? ""))
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function cssContentEscape(value) {
  return htmlEscape(value)
    .replaceAll("\\", "\\\\")
    .replace(/\r?\n/g, "\\A ");
}

export function buildQuoteWordHtml({ quote, project, db }) {
  const company = companyFromQuote(quote, db);
  const docVatRate = vatRateFromQuote(quote);
  const docTotals = quoteTotals(quote, docVatRate);
  const docVatLabel = `TVA ${(docVatRate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`;
  const docCityDate = htmlEscape(quoteCityDate(quote, project, company));
  const docNumber = htmlEscape(displayQuoteNumber(quote.quoteNumber));
  const docVersion = htmlEscape(displayQuoteVersion(quote));
  const docCompanyLines = companyContactLines(company).map((line) => `<p>${htmlEscape(line)}</p>`).join("");
  const docClientLines = clientLines(quote, project).map((line) => `<p>${htmlEscape(line)}</p>`).join("");
  const docFooterCenter = cssContentEscape(companyFooterCenterLines(company).join("\n"));
  const docCompanyLogo = company.logoDataUrl
    ? `<div class="logo"><img src="${htmlEscape(company.logoDataUrl)}" alt="Logo entreprise"></div>`
    : "";
  const docAddress = htmlEscape(quoteAddress(quote, project) || "Adresse à compléter");
  const docStart = htmlEscape(formatDate(quote.startDate));
  const docDuration = htmlEscape(fixText(quote.expectedDuration || ""));
  const docDateGrid = docStart || docDuration
    ? `<section class="section grid date-grid"><div><p class="eyebrow">Date de d\u00e9but</p><p>${docStart}</p></div><div><p class="eyebrow">Dur\u00e9e des travaux</p><p>${docDuration}</p></div></section>`
    : "";
  const docDescription = htmlEscape(fixText(
    quote.workDescription
    || quote.descriptionGenerale
    || quote.description
    || project?.description
    || ""
  ));
  const docPayment = paymentInfoFromQuote(quote, company);
  const docPaymentLines = paymentConditions(quote, company).map((line) => `<p>${htmlEscape(line)}</p>`).join("");
  const docRows = groupedItemsByRoom(fixObjectText(quote.items || [])).map((group) => {
    const groupSubtotal = group.items.reduce((sum, item) => sum + itemTotalHt(item), 0);
    const itemRows = group.items.map((item) => {
      const descRow = item.description ? `
        <tr class="description-row">
          <td class="designation" colspan="5">${htmlEscape(item.description)}</td>
        </tr>
      ` : "";
      const subRows = (item.subWorks || item.children || [])
        .map((subWork) => `
          <tr class="child-row">
            <td class="designation">- ${htmlEscape(subWork.label || subWork.name || subWork.designation || "Sous-ouvrage")}</td>
            <td>${Number(subWork.quantity || 1).toLocaleString("fr-FR")}</td>
            <td>${htmlEscape(subWork.unit || itemUnit(item))}</td>
            <td>${money(Number(subWork.unitPriceHt || 0))}</td>
            <td>${money(Number(subWork.totalTtc || subWork.totalHt || 0))}</td>
          </tr>
        `).join("");
      const supplyRows = materialSummary(item).map((supplyName) => `
        <tr class="supply-row">
          <td class="designation">Fourniture associée : ${htmlEscape(supplyName)}</td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `).join("");
      return `
        <tr>
          <td class="designation">${htmlEscape(item.label || "Ouvrage")}</td>
          <td>${itemQuantity(item).toLocaleString("fr-FR")}</td>
          <td>${htmlEscape(itemUnit(item))}</td>
          <td>${money(itemUnitPriceHt(item))}</td>
          <td>${money(itemTotalHt(item))}</td>
        </tr>
        ${descRow}
        ${subRows}
        ${supplyRows}
      `;
    }).join("");
    return `
      <tr class="room-row"><td colspan="5">${htmlEscape(group.room)}</td></tr>
      ${itemRows}
      <tr class="subtotal-row"><td colspan="4">Sous-total ${htmlEscape(group.room)}</td><td>${money(groupSubtotal)}</td></tr>
    `;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:22mm 15mm 24mm;@top-left{content:"${docCityDate}";font-size:8pt;color:#687386;}@top-right{content:"${docNumber}\\A ${docVersion}";white-space:pre-line;font-size:8pt;color:#06132d;font-weight:700;}@bottom-left{content:"KJ  Edited by Koji";font-size:8pt;color:#687386;}@bottom-center{content:"${docFooterCenter}";white-space:pre-line;font-size:7pt;color:#687386;}@bottom-right{content:counter(page) "/" counter(pages);font-size:8pt;color:#687386;font-weight:700;}}
    body{font-family:Arial,sans-serif;color:#06132d;margin:0;font-size:11px;line-height:1.35}
    .section{margin:14px 0}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .date-grid{grid-template-columns:210px 210px;gap:12px}
    .date-grid>div{border:1px solid #dfe6f0;border-radius:8px;padding:7px 10px;background:#fff}
    .payment,.totals{border:1px solid #dfe6f0;border-radius:10px;padding:14px;background:#fff}
    .payment-row{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin:3px 0}
    .payment-row h2{margin:0}
    .eyebrow{font-size:10px;text-transform:uppercase;color:#9a8b7d;font-weight:700;margin:0 0 8px}
    .identity p,.payment p,.conditions p{margin:3px 0;color:#3b4659}
    .company-card{display:flex;gap:12px;align-items:flex-start}
    .logo{width:54px;height:54px;border-radius:8px;background:#06132d;color:#e6d7c4;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;flex:0 0 auto;overflow:hidden}
    .logo img{width:100%;height:100%;object-fit:cover}
    h1{font-size:22px;margin:0 0 12px} h2{font-size:14px;margin:0 0 8px;color:#06132d}
    table{width:100%;border-collapse:collapse;margin-top:14px;page-break-inside:auto}
    th,td{border-bottom:1px solid #dfe6f0;padding:8px;text-align:left;vertical-align:top}
    th{background:#06132d;color:white;font-size:9px;text-transform:uppercase}
    .designation{width:46%}
    .room-row td{background:#f7eadf;color:#9a5a16;font-weight:700;border-bottom:1px solid #f0ddcb}
    .child-row td,.supply-row td{color:#687386;font-size:10px}
    .description-row td{color:#687386;font-size:10px;padding-top:0}
    .subtotal-row td{background:#f5f7fb;font-weight:700}
    .totals{margin-left:auto;width:280px}
    .totals div{display:flex;justify-content:space-between;padding:8px 10px;border-bottom:1px solid #dfe6f0}
    .totals .ttc{background:#06132d;color:#e6d7c4;font-size:15px;font-weight:700;border-radius:8px;margin-top:8px}
  </style></head><body>
    <h1>Devis</h1>
    <section class="section grid identity">
      <div class="company-card">${docCompanyLogo}<div>${docCompanyLines}</div></div>
      <div><p class="eyebrow">Client</p>${docClientLines}</div>
    </section>
    <section class="section"><p class="eyebrow">Adresse du chantier</p><p>${docAddress}</p></section>
    ${docDateGrid}
    <section class="section"><h2>Description des travaux</h2>${docDescription ? `<p>${docDescription}</p>` : ""}</section>
    <table>
      <thead><tr><th>Désignation</th><th>Quantité</th><th>Unité</th><th>Prix unitaire HT</th><th>Total HT</th></tr></thead>
      <tbody>${docRows || `<tr><td colspan="5">Aucune désignation pour ce devis.</td></tr>`}</tbody>
    </table>
    <section class="section totals">
      ${(() => {
        const iHt = (quote.items || []).reduce((sum, item) => sum + itemTotalHt(item), 0);
        const cs = computeSurchargeBreakdown(iHt, quote.surcharges || [])
          .lines.filter((s) => s.mode === "client" || (!s.mode && s.showToClient));
        if (!cs.length) return "";
        return cs.map((s) => `<div><span>${htmlEscape(s.label || "")} ${Number(s.percent)}%</span><strong>${money(s.amount)}</strong></div>`).join("");
      })()}
      <div><span>Total HT</span><strong>${money(docTotals.totalHt)}</strong></div>
      <div><span>${htmlEscape(docVatLabel)}</span><strong>${money(docTotals.vat)}</strong></div>
      <div class="ttc"><span>Total TTC</span><strong>${money(docTotals.totalTtc)}</strong></div>
    </section>
    <section class="section payment"><div class="payment-row"><h2>Informations de paiement</h2><p>Titulaire : ${htmlEscape(docPayment.holder || "À compléter")}</p></div><div class="payment-row"><p>IBAN : ${htmlEscape(docPayment.iban || "À compléter")}</p><p>BIC/SWIFT : ${htmlEscape(docPayment.bic || "À compléter")}</p></div></section>
    <section class="section conditions"><h2>Conditions de règlement</h2>${docPaymentLines}</section>
    <section class="section signature" style="margin-left:auto;width:280px;text-align:left">
      <p>Bon pour accord</p>
      <p>Date et signature du client :</p>
      <div style="border-bottom:1px solid #dfe6f0;height:34px"></div>
      <div style="border-bottom:1px solid #dfe6f0;height:22px"></div>
    </section>
  </body></html>`;
}

export function buildSuppliesWordHtml({ quote, db }) {
  const company = companyFromQuote(quote, db);
  const footerCenter = cssContentEscape(companyFooterCenterLines(company).join("\n"));
  const lines = supplyLinesFromQuote(quote, db);
  const rows = lines.map((line) => `
    <tr><td>${htmlEscape(line.name)}</td><td>${htmlEscape(line.category)}</td><td>${htmlEscape(line.supplier)}</td><td>${line.quantity.toLocaleString("fr-FR")}</td><td>${money(line.total)}</td></tr>
  `).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:18mm 15mm 22mm;@bottom-left{content:"KJ  Edited by Koji";font-size:8pt;color:#687386;}@bottom-center{content:"${footerCenter}";white-space:pre-line;font-size:7pt;color:#687386;}@bottom-right{content:counter(page) "/" counter(pages);font-size:8pt;color:#687386;font-weight:700;}}
    body{font-family:Arial,sans-serif;color:#06132d} h1{font-size:24px}
    table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #dfe6f0;padding:10px;text-align:left}
    th{background:#06132d;color:white;text-transform:uppercase;font-size:12px}
    .footer-note{border-top:1px solid #dfe6f0;color:#687386;font-size:11px;margin-top:28px;padding-top:10px;text-align:center}
  </style></head><body><h1>Liste fournisseurs / fournitures - ${htmlEscape(quote.quoteNumber)}</h1>
    <table><thead><tr><th>Fourniture</th><th>Catégorie</th><th>Fournisseur</th><th>Qté</th><th>Total HT</th></tr></thead><tbody>${rows || "<tr><td colspan=\"5\">Aucune fourniture liée.</td></tr>"}</tbody></table>
    <div class="footer-note">Edited by Koji</div>
  </body></html>`;
}

export function quoteDocumentFilename(quote, type, format) {
  const base = type === "supplies" ? "Fournitures" : type === "facture" ? "Facture" : "Devis_Final";
  const ext = format === "word" ? "docx" : "pdf";
  return `${base}_${sanitizeFilename(quote.quoteNumber || quote.id)}.${ext}`;
}

function invoiceDateValue(invoice) {
  return invoice.issuedAt || invoice.createdAt || new Date();
}

function invoiceCityDate(invoice, project, company) {
  const city = fixText(project?.city || company?.city || cityFromAddress(project?.address || project?.fullAddress || company?.addressLine2));
  const date = formatDate(invoiceDateValue(invoice));
  return city ? `${city}, le ${date}` : `Le ${date}`;
}

function displayInvoiceNumber(value) {
  const cleaned = fixText(value || "");
  return cleaned ? `Facture N°: ${cleaned}` : "Facture N°";
}

function addInvoicePdfFooters(pages, { company, invoice, project }) {
  const total = pages.length;
  const cityDate = invoiceCityDate(invoice, project, company);
  const number = displayInvoiceNumber(invoice.invoiceNumber);
  const footerCenterLines = companyFooterCenterLines(company);

  return pages.map((pageOps, index) => {
    const ops = [];
    ops.push(pdfTextOp(MARGIN, 28, cityDate, { size: 8.5, fill: "#687386" }));
    ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 160, 28, number, { size: 8.8, bold: true, fill: NAVY }));
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

function invoiceTypeLabel(invoice) {
  return fixText(invoice.type || "Facture");
}

function invoiceStatusLabel(invoice) {
  const map = { Brouillon: "Brouillon", Emise: "Emise", Payee: "Payee", Annulee: "Annulee" };
  return map[invoice.status] || fixText(invoice.status || "Brouillon");
}

function drawInvoiceDetails(canvas, invoice, quote, project) {
  const rows = [
    ["Devis lie", fixText(invoice.quoteNumber || quote?.quoteNumber || "-")],
    ["Chantier", fixText(invoice.projectTitle || project?.title || "-")],
    ["Reference chantier", fixText(project?.reference || "-")],
    ["Type de facture", invoiceTypeLabel(invoice)],
    ["Statut", invoiceStatusLabel(invoice)],
    ["Date d'emission", formatDate(invoice.issuedAt) || "-"],
    ["Date d'echeance", formatDate(invoice.dueDate) || "-"]
  ];
  if (invoice.status === "Payee") rows.push(["Date de paiement", formatDate(invoice.paidAt) || "-"]);

  const rowHeight = 22;
  const boxHeight = rows.length * rowHeight + 30;
  canvas.ensure(boxHeight + 14);
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, boxHeight, { fill: "#ffffff", stroke: LINE });
  canvas.text(MARGIN + 14, canvas.y + 22, "DETAILS DE LA FACTURE", { size: 10, bold: true, fill: "#a58c6f" });
  rows.forEach((row, index) => {
    const y = canvas.y + 44 + index * rowHeight;
    canvas.text(MARGIN + 16, y, row[0], { size: 9.5, fill: "#687386" });
    canvas.text(MARGIN + 220, y, row[1], { size: 9.5, bold: true });
  });
  canvas.y += boxHeight + 16;
}

function drawInvoiceTotals(canvas, invoice, company) {
  canvas.ensure(220);
  const width = 248;
  const x = PAGE_WIDTH - MARGIN - width;
  canvas.rect(x, canvas.y, width, 88, { fill: "#ffffff", stroke: LINE });
  canvas.text(x + 14, canvas.y + 22, "Total devis TTC", { size: 9, fill: "#687386" });
  canvas.text(x + 150, canvas.y + 22, money(invoice.totalQuoteTtc), { size: 9.5, bold: true });
  canvas.text(x + 14, canvas.y + 44, "Deja facture avant", { size: 9, fill: "#687386" });
  canvas.text(x + 150, canvas.y + 44, money(invoice.alreadyInvoicedBefore), { size: 9.5, bold: true });
  canvas.text(x + 14, canvas.y + 66, "Reste apres facture", { size: 9, fill: "#687386" });
  canvas.text(x + 150, canvas.y + 66, money(invoice.remainingAfter), { size: 9.5, bold: true });
  canvas.y += 96;
  canvas.rect(x, canvas.y, width, 42, { fill: NAVY, stroke: NAVY });
  canvas.text(x + 15, canvas.y + 27, "MONTANT FACTURE TTC", { size: 10.5, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 92, canvas.y + 27, money(invoice.amountTtc), { size: 12, bold: true, fill: GOLD });
  canvas.y += 58;

  const payment = { iban: company.iban, holder: company.bankHolder || company.name, bic: company.bic };
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 60, { fill: "#ffffff", stroke: LINE });
  canvas.text(MARGIN + 14, canvas.y + 22, "Informations de paiement", { size: 10, bold: true });
  canvas.text(MARGIN + 310, canvas.y + 22, `Titulaire : ${payment.holder || "A completer"}`, { size: 8.6, fill: "#687386" });
  canvas.text(MARGIN + 14, canvas.y + 42, `IBAN : ${payment.iban || "A completer"}`, { size: 8.6, fill: "#687386" });
  canvas.text(MARGIN + 310, canvas.y + 42, `BIC/SWIFT : ${payment.bic || "A completer"}`, { size: 8.6, fill: "#687386" });
  canvas.y += 76;

  if (invoice.notes) {
    const lines = wrapText(invoice.notes, 92);
    const height = Math.max(30, 30 + lines.length * 12);
    canvas.ensure(height + 10);
    canvas.text(MARGIN, canvas.y + 16, "Notes", { size: 10, bold: true });
    lines.forEach((line, index) => canvas.text(MARGIN, canvas.y + 32 + index * 12, line, { size: 9, fill: "#687386" }));
    canvas.y += height + 10;
  }
}

export function buildInvoicePdf({ invoice, quote, project, db }) {
  const canvas = new PdfCanvas();
  const company = quote ? companyFromQuote(quote, db) : companyFromDb(db, invoice.userId);
  drawHeader(canvas, { quoteNumber: invoice.invoiceNumber }, company, "FACTURE");
  drawInfoColumns(
    canvas,
    {
      client: invoice.client,
      clientEmail: invoice.clientEmail,
      clientPhone: quote?.clientPhone || "",
      clientAddress: quote?.clientAddress || project?.address || ""
    },
    project,
    company
  );
  drawInvoiceDetails(canvas, invoice, quote, project);
  drawInvoiceTotals(canvas, invoice, company);
  return createPdf(addInvoicePdfFooters(canvas.pages, { company, invoice, project }), canvas.images);
}

export function invoiceDocumentFilename(invoice) {
  return `Facture_${sanitizeFilename(invoice.invoiceNumber || invoice.id)}.pdf`;
}

function monthLabel(month) {
  const [year, monthNum] = String(month || "").split("-").map(Number);
  if (!year || !monthNum) return fixText(month || "");
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(year, monthNum - 1, 1));
}

function drawAttendanceInfo(canvas, worker, month) {
  const rows = [
    ["Ouvrier / Sous-traitant", fixText(worker.name || "-")],
    ["Fonction", fixText(worker.profession || worker.role || "-")],
    ["Periode", monthLabel(month)],
    ["Heures contractuelles / semaine", `${Number(worker.weeklyContractHours || 35).toLocaleString("fr-FR")} h`]
  ];
  const rowHeight = 22;
  const boxHeight = rows.length * rowHeight + 30;
  canvas.ensure(boxHeight + 14);
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, boxHeight, { fill: "#ffffff", stroke: LINE });
  canvas.text(MARGIN + 14, canvas.y + 22, "RELEVÉ D'HEURES", { size: 10, bold: true, fill: "#a58c6f" });
  rows.forEach((row, index) => {
    const y = canvas.y + 44 + index * rowHeight;
    canvas.text(MARGIN + 16, y, row[0], { size: 9.5, fill: "#687386" });
    canvas.text(MARGIN + 260, y, row[1], { size: 9.5, bold: true });
  });
  canvas.y += boxHeight + 16;
}

const ATTENDANCE_TYPE_LABELS = {
  heures: "Heures",
  jour: "Jour",
  forfait: "Forfait",
  ouvrage: "Ouvrage",
  passage: "Passage",
  deplacement: "Déplacement"
};

function drawAttendanceRows(canvas, entries, contractMinutes) {
  canvas.text(MARGIN, canvas.y, "DÉTAIL DES JOURNÉES", { size: 13, bold: true });
  canvas.y += 22;

  if (!entries.length) {
    canvas.text(MARGIN, canvas.y, "Aucun pointage enregistré pour cette période.");
    canvas.y += 20;
    return;
  }

  canvas.ensure(28);
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 24, { fill: NAVY, stroke: NAVY });
  canvas.text(MARGIN + 12, canvas.y + 16, "DATE", { size: 9, bold: true, fill: "#ffffff" });
  canvas.text(MARGIN + 100, canvas.y + 16, "TYPE", { size: 9, bold: true, fill: "#ffffff" });
  canvas.text(MARGIN + 190, canvas.y + 16, "DÉTAIL", { size: 9, bold: true, fill: "#ffffff" });
  canvas.text(MARGIN + 360, canvas.y + 16, "MONTANT", { size: 9, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 90, canvas.y + 16, "SOURCE", { size: 9, bold: true, fill: "#ffffff" });
  canvas.y += 24;

  let weekKey = "";
  let weekMinutes = 0;

  const flushWeek = () => {
    if (!weekKey) return;
    canvas.ensure(24);
    canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 22, { fill: SOFT, stroke: LINE });
    canvas.text(MARGIN + 12, canvas.y + 15, `Total heures semaine ${weekKey.replace("-W", " - S")}`, { size: 9, bold: true, fill: "#687386" });
    canvas.text(PAGE_WIDTH - MARGIN - 110, canvas.y + 15, formatMinutesFr(weekMinutes), { size: 9.5, bold: true });
    canvas.y += 28;
  };

  entries.forEach((entry) => {
    const key = isoWeekInfo(entry.date).key;
    if (key !== weekKey) {
      flushWeek();
      weekKey = key;
      weekMinutes = 0;
    }
    weekMinutes += Number(entry.durationMinutes || 0);
    const type = entry.type || "heures";

    const rowHeight = 24;
    canvas.ensure(rowHeight + 4);
    canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, rowHeight, { fill: "#ffffff", stroke: LINE });
    canvas.text(MARGIN + 12, canvas.y + 16, formatDate(entry.date), { size: 9.5 });
    canvas.text(MARGIN + 100, canvas.y + 16, ATTENDANCE_TYPE_LABELS[type] || type, { size: 9 });
    canvas.text(MARGIN + 190, canvas.y + 16, type === "heures" ? `${entry.startTime || "-"} → ${entry.endTime || "-"} (${formatMinutesFr(entry.durationMinutes)})` : fixText(entry.label || "-"), { size: 8.8 });
    canvas.text(MARGIN + 360, canvas.y + 16, Number(entry.amount || 0) > 0 ? money(entry.amount) : "-", { size: 9.5, bold: true });
    canvas.text(PAGE_WIDTH - MARGIN - 90, canvas.y + 16, entry.source === "worker" ? "Ouvrier" : "Entreprise", { size: 8.5, fill: "#687386" });
    canvas.y += rowHeight + 4;
  });
  flushWeek();

  const totalMinutes = entries.reduce((sum, entry) => sum + Number(entry.durationMinutes || 0), 0);
  const totalAmount = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  canvas.ensure(58);
  canvas.rect(PAGE_WIDTH - MARGIN - 248, canvas.y, 248, 42, { fill: NAVY, stroke: NAVY });
  canvas.text(PAGE_WIDTH - MARGIN - 233, canvas.y + 18, "TOTAL HEURES", { size: 8.5, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 92, canvas.y + 18, formatMinutesFr(totalMinutes), { size: 10, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 233, canvas.y + 34, "TOTAL MONTANT", { size: 8.5, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 92, canvas.y + 34, money(totalAmount), { size: 11, bold: true, fill: GOLD });
  canvas.y += 58;

  if (contractMinutes > 0) {
    const weeksInMonth = new Set(entries.filter((entry) => entry.durationMinutes).map((entry) => isoWeekInfo(entry.date).key)).size || 1;
    const expected = contractMinutes * weeksInMonth;
    const diff = totalMinutes - expected;
    canvas.text(MARGIN, canvas.y, `Reference contractuelle sur la periode: ${formatMinutesFr(expected)} (${diff >= 0 ? "+" : "-"}${formatMinutesFr(Math.abs(diff))})`, { size: 9, fill: "#687386" });
    canvas.y += 20;
  }
}

function formatMinutesFr(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function addWorkerHoursPdfFooters(pages, { company, worker, month }) {
  const total = pages.length;
  const cityDate = `Le ${formatDate(new Date())}`;
  const number = fixText(worker.loginId || worker.name || "");
  const footerCenterLines = companyFooterCenterLines(company);

  return pages.map((pageOps, index) => {
    const ops = [];
    ops.push(pdfTextOp(MARGIN, 28, cityDate, { size: 8.5, fill: "#687386" }));
    ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 132, 28, number, { size: 8.8, bold: true, fill: NAVY }));
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

export function buildWorkerHoursPdf({ worker, entries, month, db }) {
  const canvas = new PdfCanvas();
  const company = companyFromDb(db, worker.userId);
  const monthEntries = (entries || [])
    .filter((entry) => String(entry.date || "").startsWith(month))
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const contractMinutes = Math.round(Number(worker.weeklyContractHours || 35) * 60);

  drawHeader(canvas, { quoteNumber: worker.loginId || "" }, company, "RELEVÉ D'HEURES");
  drawAttendanceInfo(canvas, worker, month);
  drawAttendanceRows(canvas, monthEntries, contractMinutes);
  return createPdf(addWorkerHoursPdfFooters(canvas.pages, { company, worker, month }), canvas.images);
}

export function workerHoursDocumentFilename(worker, month) {
  return `Releve_heures_${sanitizeFilename(worker.name || worker.id)}_${sanitizeFilename(month || "")}.pdf`;
}

// Interventions carry their own editable company snapshot (name/address/
// contact/logo/SIRET), separate from the live business profile, so a report
// stays accurate even if the profile changes later — same idea as the
// `quote.company` snapshot used by companyFromQuote().
function companyFromIntervention(intervention, db) {
  const fallback = companyFromDb(db, intervention.userId);
  return {
    ...fallback,
    name: fixText(intervention.companyName || fallback.name),
    addressLine1: fixText(intervention.companyAddressLine1 || fallback.addressLine1),
    postalCode: fixText(intervention.companyPostalCode || ""),
    city: fixText(intervention.companyCity || fallback.city),
    email: fixText(intervention.companyEmail || fallback.email),
    phone: fixText(intervention.companyPhone || fallback.phone),
    siret: fixText(intervention.companySiret || fallback.siret),
    logoDataUrl: fixText(intervention.companyLogoDataUrl || fallback.logoDataUrl)
  };
}

function drawInterventionHeader(canvas, intervention, company) {
  const hasLogo = Boolean(company.logoDataUrl);
  const headerHeight = 84;
  const addressLine = [company.addressLine1, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).join(" ");
  const contactLine = [company.email, company.phone].filter(Boolean).join(" · ");
  const textX = hasLogo ? MARGIN + 166 : MARGIN;

  if (hasLogo) canvas.image(MARGIN, canvas.y, 150, headerHeight, company.logoDataUrl);

  canvas.text(textX, canvas.y + (hasLogo ? 16 : 22), company.name || "Entreprise", { size: hasLogo ? 13 : 17, bold: true });
  if (addressLine) canvas.text(textX, canvas.y + (hasLogo ? 34 : 44), addressLine, { size: 9, fill: "#687386" });
  if (contactLine) canvas.text(textX, canvas.y + (hasLogo ? 50 : 60), contactLine, { size: 9, fill: "#687386" });
  if (company.siret) canvas.text(textX, canvas.y + (hasLogo ? 66 : 76), `SIRET : ${company.siret}`, { size: 9, fill: "#687386" });

  // "RAPPORT D'INTERVENTION" now leads, top-right, alongside the auto-generated
  // reference number and creation date — same footprint as the devis/facture
  // tan reference box (drawHeader), sized for the longer French caption.
  const boxW = 190;
  const boxH = 78;
  const boxX = PAGE_WIDTH - MARGIN - boxW;
  canvas.rect(boxX, canvas.y, boxW, boxH, { fill: "#f7eadf", stroke: "#f0ddcb" });
  canvas.text(boxX + 14, canvas.y + 20, "RAPPORT D'INTERVENTION", { size: 8.2, bold: true, fill: "#9a7c5c" });
  canvas.text(boxX + 14, canvas.y + 42, `N° ${intervention.reference || "-"}`, { size: 12.5, bold: true, fill: NAVY });
  canvas.text(boxX + 14, canvas.y + 62, `Créé le ${formatDate(intervention.createdAt)}`, { size: 8.2, fill: "#687386" });

  canvas.y += Math.max(headerHeight, boxH) + 14;
  canvas.line(MARGIN, canvas.y, PAGE_WIDTH - MARGIN, canvas.y, LINE, 1);
  canvas.y += 30;
}

function drawInterventionInfo(canvas, intervention, company) {
  const rows = [
    ["Client", fixText(intervention.client || "-")],
    ["Site", fixText(intervention.site || "-")],
    ["Date", formatDate(intervention.date) || "-"],
    ["Entreprise", fixText(intervention.entreprise || company.name || "-")]
  ];
  rows.forEach(([label, value]) => {
    canvas.ensure(20);
    canvas.text(MARGIN, canvas.y, `${label} :`, { size: 10.5, bold: true });
    canvas.text(MARGIN + 100, canvas.y, value, { size: 10.5 });
    canvas.y += 19;
  });
  if (intervention.equipement) {
    canvas.ensure(20);
    canvas.text(MARGIN, canvas.y, "Équipement :", { size: 10.5, bold: true });
    canvas.text(MARGIN + 100, canvas.y, fixText(intervention.equipement), { size: 10.5 });
    canvas.y += 19;
  }
  canvas.y += 16;
}

function drawInterventionSection(canvas, title, text) {
  if (!String(text || "").trim()) return;
  canvas.ensure(28);
  canvas.text(MARGIN, canvas.y, title, { size: 12, bold: true, fill: NAVY });
  canvas.y += 20;

  String(text).split("\n").forEach((paragraph) => {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      canvas.y += 8;
      return;
    }
    wrapText(trimmed, 96).forEach((line) => {
      canvas.ensure(16);
      canvas.text(MARGIN, canvas.y, line, { size: 10 });
      canvas.y += 15;
    });
  });
  canvas.y += 14;
}

function drawInterventionSignature(canvas, intervention, company) {
  const hasImage = Boolean(intervention.signatureImageDataUrl);
  const boxW = 220;
  const x = PAGE_WIDTH - MARGIN - boxW;
  canvas.ensure(hasImage ? 90 : 50);
  canvas.y += 14;
  canvas.text(x, canvas.y, "Signature", { size: 9, bold: true, fill: "#687386" });
  canvas.y += 16;
  if (hasImage) {
    canvas.image(x, canvas.y, boxW, 64, intervention.signatureImageDataUrl);
    canvas.y += 70;
  } else {
    canvas.text(x, canvas.y, fixText(intervention.signature || company.name || "-"), { size: 11, bold: true });
    canvas.y += 30;
  }
}

function addInterventionPdfFooters(pages, { company, intervention }) {
  const total = pages.length;
  const cityDate = `Le ${formatDate(intervention.date || new Date())}`;
  const footerCenterLines = companyFooterCenterLines(company);

  return pages.map((pageOps, index) => {
    const ops = [];
    ops.push(pdfTextOp(MARGIN, 28, cityDate, { size: 8.5, fill: "#687386" }));
    ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 132, 28, fixText(intervention.client || ""), { size: 8.8, bold: true, fill: NAVY }));
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

export function buildInterventionPdf({ intervention, db }) {
  const canvas = new PdfCanvas();
  const company = companyFromIntervention(intervention, db);

  drawInterventionHeader(canvas, intervention, company);
  drawInterventionInfo(canvas, intervention, company);
  drawInterventionSection(canvas, "Constat :", intervention.constat);
  drawInterventionSection(canvas, "Analyse :", intervention.analyse);
  drawInterventionSection(canvas, "Préconisations :", intervention.preconisations);
  drawInterventionSignature(canvas, intervention, company);

  return createPdf(addInterventionPdfFooters(canvas.pages, { company, intervention }), canvas.images);
}

export function interventionDocumentFilename(intervention) {
  return `Rapport_intervention_${sanitizeFilename(intervention.client || intervention.id)}_${sanitizeFilename(intervention.date || "")}.pdf`;
}

// Standard EU business card, 85 x 55mm, converted to PDF points (1mm = 2.83465pt).
const CARD_WIDTH = 240.9;
const CARD_HEIGHT = 155.9;
const CARD_MUTED = "#a9b6cc";
const CARD_INK = "#0d1b33";
const CARD_LINE = "#e3e7ee";

// The real Koji mark (public/koji-logo.svg), drawn from its own path data so
// it can be filled at any size/color on the card — this PDF engine has no
// SVG support, only rect/line/text/image, so the path is walked by hand.
const KOJI_MARK_PATH = "M75.5188 0.0462758C75.4602 0.0288482 75.3146 -0.0014607 75.0001 5.47421e-05C66.5238 0.0621879 57.7947 0.0750692 49.0555 0.0386986C48.1338 0.0364254 47.5751 0.289505 46.9077 1.01237C37.1745 11.5477 27.2524 22.2346 17.6563 32.57L14.4296 36.0449C14.1814 36.3124 13.9171 36.5533 13.5827 36.8594C13.4008 37.0254 13.1942 37.2141 12.9515 37.4421L11.5928 38.7181L11.3932 36.8814C11.3563 36.5435 11.3185 36.2548 11.2854 36.0002C11.2206 35.5054 11.169 35.1144 11.169 34.6992V34.4703C11.169 23.4175 11.169 11.988 11.2129 0.746411C11.2145 0.368308 11.1767 0.212217 11.1567 0.156145C11.1043 0.139476 10.9655 0.109924 10.6611 0.12129C8.77227 0.189485 6.85953 0.18115 5.00844 0.173573C4.28094 0.170542 3.52802 0.167511 2.78974 0.169027C1.94126 0.170542 1.09201 0.170542 0.239671 0.169784H0V68.0359C7.0468 60.4951 13.4231 53.671 19.9027 46.725L23.9209 42.4181C32.919 32.7738 42.223 22.8007 51.3444 12.9662C52.4317 11.794 53.5785 11.2992 55.0604 11.3613C57.2321 11.453 59.3367 11.4614 61.3158 11.3871C61.9554 11.3629 62.7638 11.406 63.3464 11.9599C63.9352 12.5191 64.0076 13.3291 64.0053 13.9724C63.9745 22.1786 63.9822 30.5234 63.9899 38.5931C63.993 41.7513 63.9953 44.9087 63.9961 48.0669C63.9961 48.2829 63.9968 48.4988 63.9976 48.7148C64.0015 49.7824 64.0053 50.8864 63.9244 51.9836C63.7387 54.5151 62.9334 56.6716 61.5308 58.3916C60.1721 60.0586 58.2447 61.3248 55.8018 62.1552C53.5076 62.9357 51.134 63.019 48.9376 62.3977C46.7713 61.7839 44.7584 60.4784 43.1154 58.6212C42.2715 57.668 41.4184 56.6958 40.5923 55.7563C39.5142 54.5288 38.399 53.2596 37.2955 52.0184C35.8621 50.406 34.4456 48.8299 32.9459 47.1614C32.5136 46.6803 32.079 46.1961 31.6405 45.7081L23.7452 54.2636C24.9358 55.5661 26.135 56.8959 27.2963 58.1833C30.103 61.2952 33.0053 64.5133 35.9761 67.5563C39.9742 71.6502 45.0605 73.856 51.0939 74.1106C57.6074 74.3856 63.7341 72.1503 68.3479 67.8169C72.9602 63.4843 75.5103 57.571 75.528 51.1667C75.5527 42.1824 75.5527 33.0473 75.5519 24.2131C75.5519 16.4782 75.5512 8.47972 75.5673 0.613052C75.5673 0.260711 75.5373 0.107651 75.518 0.0462758H75.5188Z";
const KOJI_MARK_SIZE = 76;

// Standard SVG elliptical-arc-to-cubic-bezier conversion (SVG spec F.6.5),
// split into <=90deg segments. Verified numerically against the known
// quarter-circle case before use.
function arcToBeziers(x1, y1, rx, ry, angleDeg, largeArcFlag, sweepFlag, x2, y2) {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const angle = ((angleDeg % 360) * Math.PI) / 180;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cosA * dx2 + sinA * dy2;
  const y1p = -sinA * dx2 + cosA * dy2;
  let rxSq = rx * rx;
  let rySq = ry * ry;
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  const radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    const s = Math.sqrt(radiiCheck);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }
  const sign = largeArcFlag !== sweepFlag ? 1 : -1;
  let sq = (rxSq * rySq - rxSq * y1pSq - rySq * x1pSq) / (rxSq * y1pSq + rySq * x1pSq);
  sq = sq < 0 ? 0 : sq;
  const coef = sign * Math.sqrt(sq);
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * (-(ry * x1p) / rx);
  const cx = cosA * cxp - sinA * cyp + (x1 + x2) / 2;
  const cy = sinA * cxp + cosA * cyp + (y1 + y2) / 2;

  function angleBetween(ux, uy, vx, vy) {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    let ang = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  }

  const ux = (x1p - cxp) / rx;
  const uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx;
  const vy = (-y1p - cyp) / ry;
  const theta1 = angleBetween(1, 0, ux, uy);
  let dTheta = angleBetween(ux, uy, vx, vy);
  if (!sweepFlag && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweepFlag && dTheta < 0) dTheta += 2 * Math.PI;

  const segments = Math.ceil(Math.abs(dTheta) / (Math.PI / 2));
  const delta = dTheta / segments;
  const t = (8 / 3) * Math.sin(delta / 4) * Math.sin(delta / 4) / Math.sin(delta / 2);
  const result = [];
  let theta = theta1;
  for (let i = 0; i < segments; i += 1) {
    const theta2 = theta + delta;
    const cosT1 = Math.cos(theta);
    const sinT1 = Math.sin(theta);
    const cosT2 = Math.cos(theta2);
    const sinT2 = Math.sin(theta2);
    const startX = cx + (rx * cosT1 * cosA - ry * sinT1 * sinA);
    const startY = cy + (rx * cosT1 * sinA + ry * sinT1 * cosA);
    const endX = cx + (rx * cosT2 * cosA - ry * sinT2 * sinA);
    const endY = cy + (rx * cosT2 * sinA + ry * sinT2 * cosA);
    const dxStart = -rx * sinT1 * cosA - ry * cosT1 * sinA;
    const dyStart = -rx * sinT1 * sinA + ry * cosT1 * cosA;
    const dxEnd = -rx * sinT2 * cosA - ry * cosT2 * sinA;
    const dyEnd = -rx * sinT2 * sinA + ry * cosT2 * cosA;
    result.push({
      cp1x: startX + t * dxStart, cp1y: startY + t * dyStart,
      cp2x: endX - t * dxEnd, cp2y: endY - t * dyEnd,
      x: endX, y: endY
    });
    theta = theta2;
  }
  return result;
}

// Parses M/L/C/H/V/A/Z, absolute or lowercase-relative, into a flat list of
// absolute M/L/C/Z segments (arcs pre-converted to cubic beziers) — general
// enough for real-world icon paths (e.g. Feather icons), not just the one
// Koji mark this was first written for.
function parseSvgPathD(d) {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
  const segments = [];
  let i = 0;
  let cmd = "";
  const argCounts = { M: 2, L: 2, C: 6, H: 1, V: 1, Z: 0, A: 7 };
  let cur = [0, 0];
  let start = [0, 0];
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i];
      i += 1;
    }
    const upper = cmd.toUpperCase();
    const relative = cmd !== upper;
    if (upper === "Z") {
      segments.push({ cmd: "Z", args: [] });
      cur = start;
      continue;
    }
    const count = argCounts[upper] ?? 0;
    let args = tokens.slice(i, i + count).map(Number);
    i += count;
    if (relative) {
      if (upper === "H") args = [args[0] + cur[0]];
      else if (upper === "V") args = [args[0] + cur[1]];
      else if (upper === "A") args = [args[0], args[1], args[2], args[3], args[4], args[5] + cur[0], args[6] + cur[1]];
      else {
        const next = [];
        for (let k = 0; k < args.length; k += 2) next.push(args[k] + cur[0], args[k + 1] + cur[1]);
        args = next;
      }
    }
    if (upper === "M") { cur = [args[0], args[1]]; start = cur; segments.push({ cmd: "M", args }); }
    else if (upper === "L") { cur = [args[0], args[1]]; segments.push({ cmd: "L", args }); }
    else if (upper === "H") { cur = [args[0], cur[1]]; segments.push({ cmd: "L", args: [cur[0], cur[1]] }); }
    else if (upper === "V") { cur = [cur[0], args[0]]; segments.push({ cmd: "L", args: [cur[0], cur[1]] }); }
    else if (upper === "C") { cur = [args[4], args[5]]; segments.push({ cmd: "C", args }); }
    else if (upper === "A") {
      const [rx, ry, rot, large, sweep, ex, ey] = args;
      arcToBeziers(cur[0], cur[1], rx, ry, rot, large, sweep, ex, ey)
        .forEach((b) => segments.push({ cmd: "C", args: [b.cp1x, b.cp1y, b.cp2x, b.cp2y, b.x, b.y] }));
      cur = [ex, ey];
    }
  }
  return segments;
}

// Draws an SVG path (any mix of M/L/C/H/V/A/Z, absolute or relative) into the
// card canvas, placed at (x, y) and scaled from its native size down to
// `size` points — filled, stroked, or both.
function drawSvgPath(canvas, d, sourceSize, { x, y, size, fill, stroke, strokeWidth = 1.6, lineCap = true }) {
  const scale = size / sourceSize;
  const px = (v) => x + v * scale;
  const py = (v) => canvas.pageHeight - (y + v * scale);
  const segments = parseSvgPathD(d);
  const ops = ["q"];
  if (stroke) ops.push(`${color(stroke, "RG")} ${(strokeWidth).toFixed(2)} w${lineCap ? " 1 J 1 j" : ""}`);
  if (fill) ops.push(color(fill, "rg"));
  segments.forEach(({ cmd, args }) => {
    if (cmd === "M" || cmd === "L") {
      ops.push(`${px(args[0]).toFixed(2)} ${py(args[1]).toFixed(2)} ${cmd === "M" ? "m" : "l"}`);
    } else if (cmd === "C") {
      ops.push(`${px(args[0]).toFixed(2)} ${py(args[1]).toFixed(2)} ${px(args[2]).toFixed(2)} ${py(args[3]).toFixed(2)} ${px(args[4]).toFixed(2)} ${py(args[5]).toFixed(2)} c`);
    } else if (cmd === "Z") {
      ops.push("h");
    }
  });
  const paint = fill && stroke ? "B" : fill ? "f" : "S";
  ops.push(`${paint} Q`);
  canvas.ops.push(...ops);
}

// French mobile/landline written as 06 52 24 26 86 (or +33 already dialed) ->
// "+33 6 52 24 26 86". Falls back to the value as typed if it doesn't look
// like a French number, rather than mangling something already correct.
function formatPhoneIntl(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  let national = "";
  if (digits.startsWith("33")) national = digits.slice(2);
  else if (digits.startsWith("0")) national = digits.slice(1);
  if (national.length !== 9) return fixText(raw || "");
  const groups = [national[0], national.slice(1, 3), national.slice(3, 5), national.slice(5, 7), national.slice(7, 9)];
  return `+33 ${groups.join(" ")}`;
}

// Small vector glyphs drawn from rect/line primitives — the Type1/WinAnsi
// fonts this PDF engine uses have no emoji glyphs to fall back on.
function drawEnvelopeIcon(canvas, x, y, fill) {
  canvas.rect(x, y, 10, 7, { fill: null, stroke: fill, width: 0.9 });
  canvas.line(x, y, x + 5, y + 4.2, fill, 0.9);
  canvas.line(x + 10, y, x + 5, y + 4.2, fill, 0.9);
}

// The standard "phone receiver" outline glyph (Feather Icons' `phone.svg`,
// MIT-licensed, viewBox 24x24) — the two earlier hand-drawn attempts didn't
// read as a phone, so this uses the real, recognizable icon shape instead.
const PHONE_ICON_PATH = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z";
const PHONE_ICON_SIZE = 24;

function drawPhoneIcon(canvas, x, y, size, fill) {
  drawSvgPath(canvas, PHONE_ICON_PATH, PHONE_ICON_SIZE, { x, y, size, stroke: fill, strokeWidth: size * 0.09 });
}

// Same icon paths as components/AuthBrandPanel.jsx (the login page's store
// badges), viewBox 24x24 — reused here instead of hand-approximated shapes.
const APPLE_ICON_PATH = "M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83ZM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z";
const GOOGLE_PLAY_ICON_PATH = "M3.18 23.76c.37.2.8.2 1.18 0l10.94-6.32-2.38-2.37-9.74 8.69ZM.5 1.56A1.5 1.5 0 0 0 0 2.73v18.54c0 .48.19.92.5 1.17l.07.06 10.38-10.37v-.24L.57 1.5.5 1.56ZM22.28 10.5l-2.91-1.68-2.67 2.67 2.67 2.67 2.93-1.69a1.33 1.33 0 0 0 0-1.97ZM4.36.24 15.3 6.56l-2.38 2.38L3.18.25A1.38 1.38 0 0 1 4.36.24Z";
const STORE_ICON_SIZE = 24;

function drawAppleIcon(canvas, x, y, size, fill) {
  drawSvgPath(canvas, APPLE_ICON_PATH, STORE_ICON_SIZE, { x, y, size, fill });
}

function drawPlayIcon(canvas, x, y, size, fill) {
  drawSvgPath(canvas, GOOGLE_PLAY_ICON_PATH, STORE_ICON_SIZE, { x, y, size, fill });
}

// Koji's own links for the back of the card. The app store links are empty
// until Amira confirms the real listings exist — an empty entry just skips
// that QR code instead of printing a dead link.
const KOJI_WEBSITE_URL = "https://web-app-koji.vercel.app";
const KOJI_APP_STORE_URL = "";
const KOJI_PLAY_STORE_URL = "";

async function qrDataUrl(targetUrl, { dark = "#0d1b33" } = {}) {
  if (!targetUrl) return "";
  try {
    return await QRCode.toDataURL(targetUrl, { margin: 0, color: { dark, light: "#ffffff" } });
  } catch {
    return "";
  }
}

function withProtocol(url) {
  const trimmed = fixText(url || "");
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// One fixed 2-page template for every Koji account (front + back), filled
// with the company's own data. Front: the company's own identity on a plain
// white card, its own website as a QR code bottom-right. Back: the Koji
// brand on navy, with QR codes to Koji's own site and app store listings
// once those links are filled in above. Gated to admin accounts for now
// (see app/api/business-card/route.js).
export async function buildBusinessCardPdf({ company = {}, professions = [] }) {
  const canvas = new PdfCanvas(CARD_WIDTH, CARD_HEIGHT);
  const left = 20;

  // --- Front (white) -------------------------------------------------------
  canvas.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, { fill: "#ffffff", stroke: "#ffffff" });

  // Logo on the left, name + specialty to its right, side by side.
  const hasLogo = Boolean(company.logoDataUrl);
  const logoSize = 64;
  if (hasLogo) canvas.image(left, 12, logoSize, logoSize, company.logoDataUrl);
  const nameX = hasLogo ? left + logoSize + 12 : left;

  const companyName = fixText(company.raisonSociale || "Entreprise");
  canvas.wrapped(nameX, 38, companyName, hasLogo ? 20 : 30, { size: 13.5, bold: true, fill: CARD_INK });

  const specialty = fixText((professions || []).filter(Boolean).join(" · "));
  if (specialty) canvas.text(nameX, 54, specialty, { size: 8, fill: "#5b6472" });

  let frontY = Math.max(12 + logoSize, 54) + 10;
  canvas.line(left, frontY, CARD_WIDTH - 14, frontY, CARD_LINE, 1);
  frontY += 14;

  const address = [company.addressLine1, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).map(fixText).join(", ");
  if (address) {
    frontY += canvas.wrapped(left, frontY, address, 34, { size: 7.4, fill: "#5b6472" });
    frontY += 3;
  }
  if (company.phone) {
    drawPhoneIcon(canvas, left, frontY - 8, 9, CARD_INK);
    canvas.text(left + 14, frontY, formatPhoneIntl(company.phone), { size: 8, fill: CARD_INK });
    frontY += 13;
  }
  if (company.emailPro) {
    drawEnvelopeIcon(canvas, left, frontY - 7, CARD_INK);
    canvas.text(left + 16, frontY, fixText(company.emailPro), { size: 8, fill: CARD_INK });
    frontY += 13;
  }
  const companyWebsite = fixText(company.website || "");
  if (companyWebsite) {
    canvas.text(left, frontY, companyWebsite, { size: 7.6, fill: "#5b6472" });
  }

  // A QR code the user uploaded themselves (e.g. one pointing somewhere other
  // than their website — a review page, a WhatsApp link...) always wins over
  // the one auto-generated from the website field.
  const customQr = fixText(company.qrCodeDataUrl || "");
  const frontQr = customQr || (companyWebsite ? await qrDataUrl(withProtocol(companyWebsite)) : "");
  if (frontQr) {
    const qrSize = 48;
    const qrX = CARD_WIDTH - 14 - qrSize;
    const qrY = CARD_HEIGHT - 14 - qrSize;
    canvas.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2, { fill: null, stroke: CARD_LINE, width: 1 });
    canvas.image(qrX, qrY, qrSize, qrSize, frontQr);
  }

  // --- Back (Koji navy) ------------------------------------------------------
  canvas.pages.push([]);
  canvas.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, { fill: NAVY, stroke: NAVY });

  const centerX = CARD_WIDTH / 2;
  const markSize = 30;
  drawSvgPath(canvas, KOJI_MARK_PATH, KOJI_MARK_SIZE, { x: centerX - markSize / 2, y: 6, size: markSize, fill: GOLD });
  canvas.text(centerX - 22, 46, "K O J I", { size: 11, bold: true, fill: GOLD });

  // Store badges, same visual language and copy as components/AuthBrandPanel.jsx
  // (the login page): dark rounded box, icon left, two-line label right.
  canvas.text(centerX - 22, 58, "Disponible sur", { size: 6, fill: CARD_MUTED });

  const badgeW = 96;
  const badgeH = 28;
  const badgeGap = 8;
  const badgeY = 64;
  const badge1X = centerX - (badgeW * 2 + badgeGap) / 2;
  const badge2X = badge1X + badgeW + badgeGap;

  function drawBadge(bx, drawIcon, smallLabel, mainLabel) {
    canvas.rect(bx, badgeY, badgeW, badgeH, { fill: "#0f1d38", stroke: "#22314f", width: 0.8 });
    drawIcon(canvas, bx + 9, badgeY + badgeH / 2 - 7.5, 15, "#ffffff");
    canvas.text(bx + 30, badgeY + badgeH / 2 - 3, smallLabel, { size: 5, fill: CARD_MUTED });
    canvas.text(bx + 30, badgeY + badgeH / 2 + 9, mainLabel, { size: 8, bold: true, fill: "#ffffff" });
  }

  drawBadge(badge1X, drawPlayIcon, "Disponible sur", "Google Play");
  drawBadge(badge2X, drawAppleIcon, "Télécharger sur", "App Store");

  const storeLinks = [
    { label: "Site web", url: KOJI_WEBSITE_URL },
    { label: "App Store", url: KOJI_APP_STORE_URL },
    { label: "Google Play", url: KOJI_PLAY_STORE_URL }
  ].filter((entry) => entry.url);

  if (storeLinks.length) {
    const qrSize = 28;
    const gap = 6;
    const rowWidth = storeLinks.length * qrSize + (storeLinks.length - 1) * gap;
    let qrX = centerX - rowWidth / 2;
    const qrY = 100;

    for (const entry of storeLinks) {
      const code = await qrDataUrl(withProtocol(entry.url), { dark: "#06132d" });
      if (code) {
        canvas.rect(qrX, qrY, qrSize, qrSize, { fill: "#ffffff", stroke: "#ffffff" });
        canvas.image(qrX, qrY, qrSize, qrSize, code);
        canvas.text(qrX + qrSize / 2 - entry.label.length * 1.5, qrY + qrSize + 8, entry.label, { size: 5.5, fill: CARD_MUTED });
      }
      qrX += qrSize + gap;
    }
  }

  return createPdf(canvas.pages, canvas.images, { width: CARD_WIDTH, height: CARD_HEIGHT });
}

export function businessCardFilename(company = {}) {
  return `Carte_visite_${sanitizeFilename(company.raisonSociale || "Koji")}.pdf`;
}

