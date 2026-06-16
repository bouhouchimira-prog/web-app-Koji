import { fixObjectText, fixText } from "./text";

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

class PdfCanvas {
  constructor() {
    this.pages = [[]];
    this.y = CONTENT_TOP;
  }

  get ops() {
    return this.pages[this.pages.length - 1];
  }

  ensure(height) {
    if (this.y + height <= PAGE_HEIGHT - CONTENT_BOTTOM) return false;
    this.pages.push([]);
    this.y = CONTENT_TOP;
    return true;
  }

  rect(x, y, w, h, { fill = null, stroke = LINE, width = 1 } = {}) {
    const pdfY = PAGE_HEIGHT - y - h;
    const paint = fill && stroke ? "B" : fill ? "f" : "S";
    const fillCmd = fill ? color(fill, "rg") : "";
    const strokeCmd = stroke ? color(stroke, "RG") : "";
    this.ops.push(`q ${fillCmd} ${strokeCmd} ${width} w ${x} ${pdfY} ${w} ${h} re ${paint} Q`);
  }

  line(x1, y1, x2, y2, stroke = LINE, width = 1) {
    this.ops.push(`q ${color(stroke, "RG")} ${width} w ${x1} ${PAGE_HEIGHT - y1} m ${x2} ${PAGE_HEIGHT - y2} l S Q`);
  }

  text(x, y, value, { size = 10, bold = false, fill = NAVY } = {}) {
    const font = bold ? "F2" : "F1";
    this.ops.push(`BT ${color(fill, "rg")} /${font} ${size} Tf ${x} ${PAGE_HEIGHT - y} Td (${pdfText(value)}) Tj ET`);
  }

  wrapped(x, y, value, maxChars, options = {}) {
    const lines = wrapText(value, maxChars);
    lines.forEach((line, index) => this.text(x, y + index * ((options.size || 10) + 4), line, options));
    return lines.length * ((options.size || 10) + 4);
  }
}

function createPdf(pages) {
  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  const kids = [];
  let nextObject = 5;
  pages.forEach((ops) => {
    const pageObject = nextObject++;
    const contentObject = nextObject++;
    kids.push(`${pageObject} 0 R`);
    const stream = `${ops.join("\n")}\n`;
    objects[contentObject] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`;
    objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObject} 0 R >>`;
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

function itemTotalTtc(item, vatRate) {
  if (Number(item.totalTtc || 0)) return Number(item.totalTtc);
  return itemTotalHt(item) * (1 + vatRate);
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

function displayQuoteNumber(value) {
  const cleaned = cleanQuoteNumber(value);
  return cleaned ? `Devis N\u00b0: ${cleaned}` : "Devis N\u00b0";
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
  if (custom) lines.push(custom);
  if (quote.legalMentions) lines.push(fixText(quote.legalMentions));
  return lines;
}

function addPdfFooters(pages, { company, quoteNumber, generatedAt, quote = {}, project = {} }) {
  const total = pages.length;
  const cityDate = quoteCityDate(quote, project, company);
  const number = displayQuoteNumber(quoteNumber || quote.quoteNumber);
  const version = displayQuoteVersion(quote);
  const footerCenterLines = companyFooterCenterLines(company);

  return pages.map((pageOps, index) => {
    const ops = [];
    ops.push(pdfTextOp(MARGIN, 28, cityDate, { size: 8.5, fill: "#687386" }));
    ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 132, 28, number, { size: 8.8, bold: true, fill: NAVY }));
    ops.push(pdfTextOp(PAGE_WIDTH - MARGIN - 132, 41, version, { size: 7.8, fill: "#687386" }));
    ops.push(`q ${color(LINE, "RG")} 0.8 w ${MARGIN} ${PAGE_HEIGHT - 44} m ${PAGE_WIDTH - MARGIN} ${PAGE_HEIGHT - 44} l S Q`);
    ops.push(...pageOps);
    const logoX = MARGIN;
    const logoY = PAGE_HEIGHT - 31;
    const lineY = PAGE_HEIGHT - 36;
    ops.push(`q ${color(LINE, "RG")} 0.8 w ${MARGIN} ${PAGE_HEIGHT - lineY} m ${PAGE_WIDTH - MARGIN} ${PAGE_HEIGHT - lineY} l S Q`);
    ops.push(`q ${color(NAVY, "rg")} ${logoX} ${PAGE_HEIGHT - logoY - 16} 16 16 re f Q`);
    ops.push(pdfTextOp(logoX + 3.2, logoY + 8.6, "KJ", { size: 5.8, bold: true, fill: "#ffffff" }));
    ops.push(pdfTextOp(logoX + 3.4, logoY + 14, "K\u00d4JI", { size: 2.6, bold: true, fill: "#ffffff" }));
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
  canvas.text(MARGIN + 13, canvas.y + 35, "KÔJI", { size: 18, bold: true, fill: GOLD });
  canvas.text(MARGIN + 110, canvas.y + 22, company.name, { size: 19, bold: true });
  canvas.text(MARGIN + 110, canvas.y + 41, company.addressLine1 || "Adresse entreprise");
  canvas.text(MARGIN + 110, canvas.y + 58, company.addressLine2 || company.email || "");
  canvas.rect(PAGE_WIDTH - MARGIN - 150, canvas.y + 4, 150, 58, { fill: "#f7eadf", stroke: "#f0ddcb" });
  canvas.text(PAGE_WIDTH - MARGIN - 128, canvas.y + 24, title, { size: 10, bold: true, fill: "#9a7c5c" });
  canvas.text(PAGE_WIDTH - MARGIN - 135, canvas.y + 43, quote.quoteNumber || "DEVIS", { size: 14, bold: true });
  canvas.y += 112;
}

function drawLegalBlock(canvas, quote, project) {
  const address = fixText(quote.chantierAddress || project?.address || project?.fullAddress || "");
  const startDate = formatDate(quote.startDate) || "date";
  const duration = fixText(quote.expectedDuration || "") || "dur\u00e9e";
  canvas.ensure(98);
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 90, { fill: "#ffffff", stroke: LINE });
  canvas.text(MARGIN + 16, canvas.y + 24, "MENTIONS LÉGALES DU CHANTIER", { size: 11, bold: true, fill: "#a58c6f" });
  canvas.text(MARGIN + 16, canvas.y + 44, `Lieu d'exécution des travaux : ${address || "____________________"}`, { size: 11 });
  canvas.text(MARGIN + 16, canvas.y + 62, `Date de début des travaux : ${startDate || "____________________"}`, { size: 11 });
  canvas.text(MARGIN + 16, canvas.y + 80, `Durée des travaux : ${duration || "____________________"}`, { size: 11 });
  canvas.y += 108;
}

function drawQuoteRows(canvas, quote) {
  canvas.text(MARGIN, canvas.y, "DÉSIGNATIONS", { size: 15, bold: true });
  canvas.y += 22;
  const items = fixObjectText(quote.items || []);
  if (!items.length) {
    canvas.text(MARGIN, canvas.y, "Aucune désignation pour ce devis.");
    canvas.y += 20;
    return;
  }

  let activeRoom = "";
  items.forEach((item, index) => {
    const room = fixText(item.room || "Général");
    if (room !== activeRoom) {
      canvas.ensure(42);
      activeRoom = room;
      canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 32, { fill: NAVY, stroke: NAVY });
      canvas.text(MARGIN + 14, canvas.y + 21, room, { size: 13, bold: true, fill: "#ffffff" });
      canvas.y += 32;
    }
    const labelLines = wrapText(fixText(item.label || "Ouvrage"), 82);
    const detailLines = [];
    if (item.correctedTimeHours || item.normativeTime) {
      detailLines.push(`Temps: ${Number(item.correctedTimeHours || item.normativeTime || 0).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} h/${fixText(item.unit || "u")}`);
    }
    if (Number(item.adjustmentPercent || 0)) {
      detailLines.push(`Ajustement: +${Number(item.adjustmentPercent || 0).toLocaleString("fr-FR")}%${item.adjustmentReason ? ` (${fixText(item.adjustmentReason)})` : ""}`);
    }
    if (Number(item.discountPercent || 0)) {
      detailLines.push(`Réduction: -${Number(item.discountPercent || 0).toLocaleString("fr-FR")}%`);
    }
    if (item.showMaterialsToClient !== false && item.materialLines?.length) {
      detailLines.push(`Fournitures: ${item.materialLines.map((material) => fixText(material.productName || material.category)).filter(Boolean).join(", ")}`);
    }
    const rowHeight = Math.max(48, 28 + labelLines.length * 13 + detailLines.length * 11);
    canvas.ensure(rowHeight + 8);
    canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, rowHeight, { fill: "#ffffff", stroke: LINE });
    labelLines.forEach((line, lineIndex) => canvas.text(MARGIN + 12, canvas.y + 19 + lineIndex * 13, line, { size: 10.5, bold: lineIndex === 0 }));
    canvas.text(PAGE_WIDTH - MARGIN - 136, canvas.y + 19, `Qté ${Number(item.quantity || 0).toLocaleString("fr-FR")} ${fixText(item.unit || "")}`, { size: 9, fill: "#687386" });
    canvas.text(PAGE_WIDTH - MARGIN - 72, canvas.y + 19, money(item.totalHt || 0), { size: 10.5, bold: true });
    detailLines.forEach((detail, detailIndex) => {
      canvas.text(MARGIN + 12, canvas.y + 22 + labelLines.length * 13 + detailIndex * 11, detail, { size: 8.5, fill: "#687386" });
    });
    canvas.y += rowHeight + 8;
  });
}

function drawTotals(canvas, quote) {
  const totalHt = Number(quote.totalHt || 0);
  const totalTtc = Number(quote.totalTtc || 0);
  const vat = Math.max(totalTtc - totalHt, 0);
  canvas.ensure(112);
  const x = PAGE_WIDTH - MARGIN - 248;
  canvas.line(x, canvas.y, PAGE_WIDTH - MARGIN, canvas.y, NAVY, 1.5);
  canvas.y += 18;
  canvas.text(x, canvas.y, "TOTAL DEVIS HT", { size: 12, bold: true });
  canvas.text(PAGE_WIDTH - MARGIN - 92, canvas.y, money(totalHt), { size: 12, bold: true });
  canvas.y += 24;
  canvas.text(x, canvas.y, "TVA 20%", { size: 10, fill: "#687386" });
  canvas.text(PAGE_WIDTH - MARGIN - 92, canvas.y, money(vat), { size: 10, fill: "#687386" });
  canvas.y += 20;
  canvas.rect(x, canvas.y, 248, 42, { fill: NAVY, stroke: NAVY });
  canvas.text(x + 15, canvas.y + 27, "TOTAL TTC", { size: 14, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 104, canvas.y + 27, money(totalTtc), { size: 14, bold: true, fill: GOLD });
  canvas.y += 58;
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
    canvas.rect(MARGIN, top + 12, 46, 46, { fill: NAVY, stroke: NAVY });
    canvas.text(MARGIN + 12, top + 39, "KJ", { size: 15, bold: true, fill: GOLD });
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
  canvas.text(TABLE.x + TABLE.width - TABLE.total + 8, y + 16, "TOTAL TTC", { size: 7.8, bold: true, fill: "#ffffff" });
  canvas.y += 24;
}

function materialSummary(item) {
  if (item.showMaterialsToClient === false || !item.materialLines?.length) return [];
  return item.materialLines
    .map((material) => fixText(material.productName || material.name || material.category || "Fourniture"))
    .filter(Boolean);
}

function drawQuoteMainTable(canvas, quote, vatRate) {
  const items = fixObjectText(quote.items || []);
  if (!items.length) {
    canvas.text(MARGIN, canvas.y, "Aucune désignation pour ce devis.");
    canvas.y += 20;
    return;
  }

  drawTableHeader(canvas);
  groupedItemsByRoom(items).forEach((group) => {
    const subtotal = group.items.reduce((sum, item) => sum + itemTotalTtc(item, vatRate), 0);
    if (canvas.ensure(32)) drawTableHeader(canvas);
    canvas.rect(TABLE.x, canvas.y, TABLE.width, 28, { fill: "#f7eadf", stroke: "#f0ddcb" });
    canvas.text(TABLE.x + 10, canvas.y + 19, group.room, { size: 10, bold: true, fill: "#9a5a16" });
    canvas.y += 28;

    group.items.forEach((item) => {
      const labelLines = wrapText(fixText(item.label || "Ouvrage"), 42);
      const subLines = (item.subWorks || item.children || [])
        .map((subWork) => `- ${fixText(subWork.label || subWork.name || subWork.designation || "")}`)
        .filter((line) => line.length > 2);
      const supplies = materialSummary(item);
      const supplyLines = supplies.length ? wrapText(`Fournitures associées : ${supplies.join(", ")}`, 46) : [];
      const detailLines = [...subLines, ...supplyLines];
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
      canvas.text(totalX, canvas.y + 20, money(itemTotalTtc(item, vatRate)), { size: 8.2, bold: true });
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
  const clientSurcharges = (quote.surcharges || []).filter((s) => s.mode === "client" || (!s.mode && s.showToClient));
  const itemsHt = (quote.items || []).reduce((sum, item) => sum + itemTotalHt(item), 0);
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
      const amt = Math.round(itemsHt * (Number(s.percent) / 100) * 100) / 100;
      canvas.text(totalsX + 14, canvas.y + rowY, `${fixText(s.label || "")} ${Number(s.percent)}%`, { size: 8.5, fill: "#687386" });
      canvas.text(totalsX + 152, canvas.y + rowY, money(amt), { size: 9, bold: true });
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
  canvas.rect(MARGIN, canvas.y, width, 76, { fill: "#ffffff", stroke: LINE });
  canvas.text(MARGIN + 14, canvas.y + 22, "Informations de paiement", { size: 10, bold: true });
  canvas.text(MARGIN + 14, canvas.y + 42, `IBAN : ${payment.iban || "À compléter"}`, { size: 8.6, fill: "#687386" });
  canvas.text(MARGIN + 14, canvas.y + 58, `Titulaire du compte : ${payment.holder || "À compléter"}`, { size: 8.6, fill: "#687386" });
  canvas.text(MARGIN + 310, canvas.y + 42, `BIC/SWIFT : ${payment.bic || "À compléter"}`, { size: 8.6, fill: "#687386" });
  canvas.y += 92;

  const conditionLines = paymentConditions(quote, company).flatMap((line) => wrapText(line, 88));
  const height = Math.max(58, 30 + conditionLines.length * 12);
  canvas.ensure(height + 20);
  canvas.text(MARGIN, canvas.y + 18, "Conditions de règlement", { size: 10, bold: true });
  conditionLines.forEach((line, index) => {
    canvas.text(MARGIN, canvas.y + 36 + index * 12, line, { size: 8.5, fill: "#687386" });
  });
  canvas.y += height + 14;
}

export function buildQuotePdf({ quote, project, db }) {
  const canvas = new PdfCanvas();
  const company = companyFromQuote(quote, db);
  const vatRate = vatRateFromQuote(quote);
  drawInfoColumns(canvas, quote, project, company);
  drawChantierSections(canvas, quote, project);
  drawQuoteMainTable(canvas, quote, vatRate);
  drawTotalsAndPayment(canvas, quote, company, vatRate);
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
  return createPdf(addPdfFooters(canvas.pages, { company, quoteNumber: quote.quoteNumber, generatedAt: new Date(), quote, project }));
  drawHeader(canvas, quote, company, "DEVIS N?");
  canvas.text(MARGIN, canvas.y, "CLIENT", { size: 9, bold: true, fill: "#9a8b7d" });
  canvas.text(MARGIN, canvas.y + 18, fixText(quote.client || project?.client || "Client"), { size: 13, bold: true });
  canvas.text(PAGE_WIDTH - MARGIN - 140, canvas.y, "DATE", { size: 9, bold: true, fill: "#9a8b7d" });
  canvas.text(PAGE_WIDTH - MARGIN - 140, canvas.y + 18, formatDate(quote.createdAt || quote.createdAtIso) || formatDate(new Date()), { size: 12, bold: true });
  canvas.y += 54;
  drawLegalBlock(canvas, quote, project);
  drawQuoteRows(canvas, quote);
  drawTotals(canvas, quote);
  if (quote.signaturePlace || quote.signedAt) {
    canvas.text(MARGIN, canvas.y + 12, `Fait ? ${fixText(quote.signaturePlace || "__________")}, le ${formatDate(quote.signedAt || new Date())}.`, { size: 10, fill: "#687386" });
    canvas.y += 18;
  }
  canvas.text(MARGIN, canvas.y + 12, "Bon pour accord, date et signature du client :", { size: 10, fill: "#687386" });
  canvas.rect(MARGIN, canvas.y + 24, PAGE_WIDTH - MARGIN * 2, 72, { fill: "#ffffff", stroke: LINE });
  return createPdf(addPdfFooters(canvas.pages, { company, quoteNumber: quote.quoteNumber, generatedAt: new Date() }));
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
  const docStart = htmlEscape(formatDate(quote.startDate) || "date");
  const docDuration = htmlEscape(fixText(quote.expectedDuration || "") || "dur\u00e9e");
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
    const groupSubtotal = group.items.reduce((sum, item) => sum + itemTotalTtc(item, docVatRate), 0);
    const itemRows = group.items.map((item) => {
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
          <td>${money(itemTotalTtc(item, docVatRate))}</td>
        </tr>
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
    <section class="section grid date-grid"><div><p class="eyebrow">Date de d\u00e9but</p><p>${docStart}</p></div><div><p class="eyebrow">Dur\u00e9e des travaux</p><p>${docDuration}</p></div></section>
    <section class="section"><h2>Description des travaux</h2>${docDescription ? `<p>${docDescription}</p>` : ""}</section>
    <table>
      <thead><tr><th>Désignation</th><th>Quantité</th><th>Unité</th><th>Prix unitaire HT</th><th>Total TTC</th></tr></thead>
      <tbody>${docRows || `<tr><td colspan="5">Aucune désignation pour ce devis.</td></tr>`}</tbody>
    </table>
    <section class="section totals">
      ${(() => {
        const cs = (quote.surcharges || []).filter((s) => s.mode === "client" || (!s.mode && s.showToClient));
        if (!cs.length) return "";
        const iHt = (quote.items || []).reduce((sum, item) => sum + itemTotalHt(item), 0);
        return cs.map((s) => `<div><span>${htmlEscape(s.label || "")} ${Number(s.percent)}%</span><strong>${money(Math.round(iHt * Number(s.percent) / 100 * 100) / 100)}</strong></div>`).join("");
      })()}
      <div><span>Total HT</span><strong>${money(docTotals.totalHt)}</strong></div>
      <div><span>${htmlEscape(docVatLabel)}</span><strong>${money(docTotals.vat)}</strong></div>
      <div class="ttc"><span>Total TTC</span><strong>${money(docTotals.totalTtc)}</strong></div>
    </section>
    <section class="section payment"><h2>Informations de paiement</h2><p>IBAN : ${htmlEscape(docPayment.iban || "À compléter")}</p><p>Titulaire du compte : ${htmlEscape(docPayment.holder || "À compléter")}</p><p>BIC/SWIFT : ${htmlEscape(docPayment.bic || "À compléter")}</p></section>
    <section class="section conditions"><h2>Conditions de règlement</h2>${docPaymentLines}</section>
    <section class="section signature" style="margin-left:auto;width:280px;text-align:left">
      <p>Bon pour accord</p>
      <p>Date et signature du client :</p>
      <div style="border-bottom:1px solid #dfe6f0;height:34px"></div>
      <div style="border-bottom:1px solid #dfe6f0;height:22px"></div>
    </section>
  </body></html>`;
  const generatedAt = formatDate(new Date());
  const footerText = htmlEscape([company.name, quote.quoteNumber, generatedAt].filter(Boolean).join(" - "));
  const legalAddress = htmlEscape(quote.chantierAddress || project?.address || project?.fullAddress || "____________________");
  const legalStart = htmlEscape(formatDate(quote.startDate) || "____________________");
  const legalDuration = htmlEscape(quote.expectedDuration || "____________________");
  const rows = (quote.items || []).map((item) => {
    const details = [];
    if (Number(item.adjustmentPercent || 0)) details.push(`Ajustement +${Number(item.adjustmentPercent || 0).toLocaleString("fr-FR")}%${item.adjustmentReason ? ` (${item.adjustmentReason})` : ""}`);
    if (Number(item.discountPercent || 0)) details.push(`Réduction -${Number(item.discountPercent || 0).toLocaleString("fr-FR")}%`);
    if (item.showMaterialsToClient !== false && item.materialLines?.length) {
      details.push(`Fournitures: ${item.materialLines.map((material) => material.productName || material.category).filter(Boolean).join(", ")}`);
    }
    const billingDetail = item.billingMode === "fixed"
      ? `Forfait HT: ${money(item.fixedAmountHt || item.laborCost || 0)}`
      : `Temps: ${Number(item.normativeTime || item.correctedTime || 0).toLocaleString("fr-FR")} h/u`;
    details.unshift(billingDetail);
    return `
      <tr>
        <td>${htmlEscape(item.room || "")}</td>
        <td>${htmlEscape(item.label || "")}${details.length ? `<br><small>${htmlEscape(details.join(" - "))}</small>` : ""}</td>
        <td>${Number(item.quantity || 0).toLocaleString("fr-FR")} ${htmlEscape(item.unit || "")}</td>
        <td>${money(item.totalHt || 0)}</td>
      </tr>
    `;
  }).join("");
  const vat = Math.max(Number(quote.totalTtc || 0) - Number(quote.totalHt || 0), 0);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{margin:18mm 15mm 22mm;@bottom-left{content:"Page " counter(page) " sur " counter(pages);font-size:8pt;color:#687386;}@bottom-center{content:"${footerText}";font-size:8pt;color:#687386;}@bottom-right{content:"Cr?? par Koji";font-size:8pt;color:#687386;}}
    body{font-family:Arial,sans-serif;color:#06132d;margin:0}
    .head{display:flex;justify-content:space-between;border-bottom:2px solid #06132d;padding-bottom:18px;margin-bottom:22px}
    .logo{background:#06132d;color:#e6d7c4;padding:22px;border-radius:8px;font-weight:700;font-size:22px}
    .box{border:1px solid #dfe6f0;border-radius:10px;padding:14px;margin:18px 0;background:#fff}
    h1{font-size:24px} h2{font-size:16px;color:#a58c6f}
    table{width:100%;border-collapse:collapse;margin-top:18px} th,td{border-bottom:1px solid #dfe6f0;padding:10px;text-align:left}
    th{background:#06132d;color:white;font-size:12px;text-transform:uppercase}
    .total{margin-left:auto;width:280px;background:#06132d;color:white;padding:14px;font-size:18px;font-weight:700}
    small,.muted{color:#687386}
    .footer-note{border-top:1px solid #dfe6f0;color:#687386;font-size:11px;margin-top:28px;padding-top:10px;text-align:center}
  </style></head><body>
    <div class="head"><div><div class="logo">KÔJI</div><h1>${htmlEscape(company.name)}</h1><p>${htmlEscape(company.addressLine1)}<br>${htmlEscape(company.addressLine2)}<br>${htmlEscape(company.email)}</p></div><div><h1>${htmlEscape(quote.quoteNumber)}</h1><p>Date: ${formatDate(quote.createdAt || quote.createdAtIso)}</p><p>Client: ${htmlEscape(quote.client)}</p></div></div>
    <div class="box"><h2>MENTIONS LÉGALES DU CHANTIER</h2><p>Lieu d'exécution des travaux : ${legalAddress}</p><p>Date de début des travaux : ${legalStart}</p><p>Durée des travaux : ${legalDuration}</p></div>
    <table><thead><tr><th>Pièce</th><th>Désignation</th><th>Qté</th><th>Total HT</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Total HT: <strong>${money(quote.totalHt || 0)}</strong></p><p>TVA 20%: <strong>${money(vat)}</strong></p><div class="total">TOTAL TTC ${money(quote.totalTtc || 0)}</div>
    <p>Fait ? ${htmlEscape(quote.signaturePlace || "__________")}, le ${formatDate(quote.signedAt || new Date())}.</p>
    <div class="footer-note">Page 1 sur 1 - ${footerText}</div>
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
  const base = type === "supplies" ? "Fournitures" : "Devis_Final";
  const ext = format === "word" ? "docx" : "pdf";
  return `${base}_${sanitizeFilename(quote.quoteNumber || quote.id)}.${ext}`;
}

