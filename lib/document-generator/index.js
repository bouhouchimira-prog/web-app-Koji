import * as shared from './shared.js';
// Imports perdus au découpage du 3 nov. (#36) : sans eux, chaque PDF
// échouait (« PdfCanvas is not defined »).
import QRCode from "qrcode";
import { fixObjectText, fixText } from "../text";
import { isoWeekInfo } from "../worker-portal";
import { computeSurchargeBreakdown } from "../quote-calculations";
const { PdfCanvas, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_TOP, CONTENT_BOTTOM, NAVY, GOLD, BLUE, LINE, SOFT, money, formatDate, sanitizeFilename, companyFromDb, companyFromQuote, hexToRgb, color, pdfText, wrapText, parseDataUrl, paethPredictor, unfilterPng, decodePng, readJpegDimensions, buildImageXObject, createPdf, pdfTextOp, cityFromAddress, quoteDateValue, quoteCityDate, vatRateFromQuote, itemMaterialsTotal, itemTotalHt, itemQuantity, itemUnit, itemUnitPriceHt, roomLabel, groupedItemsByRoom, quoteAddress, companyLines, companyContactLines, companyFooterLegal, companyFooterCenterLines, cleanQuoteNumber, displayQuoteNumber, quoteVersionNumber, displayQuoteVersion, clientLines, paymentInfoFromQuote, paymentConditions, addPdfFooters, drawHeader, quoteTotals, drawInfoColumns, drawChantierSections, TABLE, drawTableHeader, materialSummary, drawQuoteMainTable, drawTotalsAndPayment } = shared;

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
  const base = type === "supplies" ? "Fournitures" : type === "facture" ? "Facture" : "Devis";
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

function displayInvoiceNumber(invoice) {
  const label = invoice.kind === "avoir" ? "Avoir" : "Facture";
  const cleaned = fixText(invoice.invoiceNumber || "");
  return cleaned ? `${label} N°: ${cleaned}` : `${label} N°`;
}

function addInvoicePdfFooters(pages, { company, invoice, project }) {
  const total = pages.length;
  const cityDate = invoiceCityDate(invoice, project, company);
  const number = displayInvoiceNumber(invoice);
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

const CREDIT_REASON_LABELS = {
  erreur: "Erreur sur la facture",
  retractation: "Retractation du client",
  geste: "Geste commercial",
  annulation: "Annulation"
};

// PRO-06.1 : l'avoir reprend le numéro et la date de la facture d'origine.
function drawCreditNoteDetails(canvas, invoice, project) {
  const rows = [
    ["Facture d'origine", `${fixText(invoice.refInvoiceNumber || "-")} du ${formatDate(invoice.refInvoiceDate) || "-"}`],
    ["Motif", CREDIT_REASON_LABELS[invoice.reason] || fixText(invoice.reason || "-")],
    ["Devis lie", fixText(invoice.quoteNumber || "-")],
    ["Chantier", fixText(invoice.projectTitle || project?.title || "-")],
    ["Date d'emission", formatDate(invoice.issuedAt) || "-"]
  ];
  const rowHeight = 22;
  const boxHeight = rows.length * rowHeight + 30;
  canvas.ensure(boxHeight + 14);
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, boxHeight, { fill: "#ffffff", stroke: LINE });
  canvas.text(MARGIN + 14, canvas.y + 22, "DETAILS DE L'AVOIR", { size: 10, bold: true, fill: "#a58c6f" });
  rows.forEach((row, index) => {
    const y = canvas.y + 44 + index * rowHeight;
    canvas.text(MARGIN + 16, y, row[0], { size: 9.5, fill: "#687386" });
    canvas.text(MARGIN + 220, y, row[1], { size: 9.5, bold: true });
  });
  canvas.y += boxHeight + 16;
}

function drawCreditNoteTotals(canvas, invoice) {
  canvas.ensure(120);
  const width = 248;
  const x = PAGE_WIDTH - MARGIN - width;
  canvas.rect(x, canvas.y, width, 42, { fill: NAVY, stroke: NAVY });
  canvas.text(x + 15, canvas.y + 27, "TOTAL AVOIR TTC", { size: 10.5, bold: true, fill: "#ffffff" });
  canvas.text(PAGE_WIDTH - MARGIN - 92, canvas.y + 27, money(invoice.amountTtc), { size: 12, bold: true, fill: GOLD });
  canvas.y += 58;
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
  const isCreditNote = invoice.kind === "avoir";
  drawHeader(canvas, { quoteNumber: invoice.invoiceNumber }, company, isCreditNote ? "AVOIR" : "FACTURE");
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
  if (isCreditNote) {
    drawCreditNoteDetails(canvas, invoice, project);
    drawCreditNoteTotals(canvas, invoice);
  } else {
    drawInvoiceDetails(canvas, invoice, quote, project);
    drawInvoiceTotals(canvas, invoice, company);
  }
  return createPdf(addInvoicePdfFooters(canvas.pages, { company, invoice, project }), canvas.images);
}

export function invoiceDocumentFilename(invoice) {
  return `${invoice.kind === "avoir" ? "Avoir" : "Facture"}_${sanitizeFilename(invoice.invoiceNumber || invoice.id)}.pdf`;
}

const AVENANT_LEGAL_TEXT = [
  "Le présent avenant modifie le devis référencé ci-dessus par accord mutuel des parties, conformément aux articles 1103 et 1193 du Code civil (force obligatoire du contrat, modification par consentement mutuel uniquement).",
  "Conformément à l'article 1793 du Code civil, toute augmentation du prix convenu à forfait ne peut résulter que d'un accord écrit du maître d'ouvrage, tel que formalisé par le présent document."
];

function avenantTypeLabel(type) {
  return type === "suppression" ? "Suppression" : type === "modification" ? "Modification" : "Ajout";
}

function groupAvenantLignesByRoom(lignes) {
  const order = [];
  const byRoom = new Map();
  lignes.forEach((ligne) => {
    const room = fixText(ligne.room || "Travaux") || "Travaux";
    if (!byRoom.has(room)) {
      byRoom.set(room, []);
      order.push(room);
    }
    byRoom.get(room).push(ligne);
  });
  return order.map((room) => ({ room, lignes: byRoom.get(room) }));
}

function drawAvenantLignesTable(canvas, avenant) {
  const lignes = fixObjectText(avenant.lignes || []);
  if (!lignes.length) {
    canvas.text(MARGIN, canvas.y, "Aucune ligne pour cet avenant.");
    canvas.y += 20;
    return;
  }

  drawTableHeader(canvas);
  groupAvenantLignesByRoom(lignes).forEach((group) => {
    const subtotal = group.lignes.reduce((sum, ligne) => sum + Number(ligne.totalHt || 0), 0);
    if (canvas.ensure(32)) drawTableHeader(canvas);
    canvas.rect(TABLE.x, canvas.y, TABLE.width, 28, { fill: "#f7eadf", stroke: "#f0ddcb" });
    canvas.text(TABLE.x + 10, canvas.y + 19, group.room, { size: 10, bold: true, fill: "#9a5a16" });
    canvas.y += 28;

    group.lignes.forEach((ligne) => {
      const labelLines = wrapText(`[${avenantTypeLabel(ligne.type)}] ${fixText(ligne.label || "Ligne")}`, 42);
      const noteLines = ligne.note ? wrapText(fixText(ligne.note), 46) : [];
      const rowHeight = Math.max(40, 26 + labelLines.length * 12 + noteLines.length * 10);
      if (canvas.ensure(rowHeight)) drawTableHeader(canvas);
      canvas.rect(TABLE.x, canvas.y, TABLE.width, rowHeight, { fill: "#ffffff", stroke: LINE });
      labelLines.forEach((line, index) => {
        canvas.text(TABLE.x + 10, canvas.y + 18 + index * 12, line, { size: 8.6, bold: index === 0 });
      });
      noteLines.forEach((line, index) => {
        canvas.text(TABLE.x + 18, canvas.y + 20 + labelLines.length * 12 + index * 10, line, { size: 7.6, fill: "#687386" });
      });

      const qteX = TABLE.x + TABLE.designation + 8;
      const unitX = qteX + TABLE.quantity;
      const unitPriceX = unitX + TABLE.unit;
      const totalX = TABLE.x + TABLE.width - TABLE.total + 8;
      canvas.text(qteX, canvas.y + 20, Number(ligne.quantity || 0).toLocaleString("fr-FR"), { size: 8.2 });
      canvas.text(unitX, canvas.y + 20, fixText(ligne.unit || "u"), { size: 8.2 });
      canvas.text(unitPriceX, canvas.y + 20, money(Number(ligne.unitPriceHt || 0)), { size: 8.2 });
      canvas.text(totalX, canvas.y + 20, money(Number(ligne.totalHt || 0)), { size: 8.2, bold: true });
      canvas.y += rowHeight;
    });

    if (canvas.ensure(24)) drawTableHeader(canvas);
    canvas.rect(TABLE.x, canvas.y, TABLE.width, 24, { fill: SOFT, stroke: LINE });
    canvas.text(TABLE.x + 10, canvas.y + 16, `Sous-total ${group.room}`, { size: 8.2, bold: true, fill: "#687386" });
    canvas.text(TABLE.x + TABLE.width - 88, canvas.y + 16, money(subtotal), { size: 8.2, bold: true });
    canvas.y += 30;
  });
}

function drawAvenantTotals(canvas, avenant, quote) {
  const width = 236;
  const totalsX = PAGE_WIDTH - MARGIN - width;
  canvas.ensure(160);
  canvas.rect(totalsX, canvas.y, width, 92, { fill: "#ffffff", stroke: LINE });
  canvas.text(totalsX + 14, canvas.y + 24, "Total HT (delta)", { size: 9, fill: "#687386" });
  canvas.text(totalsX + 150, canvas.y + 24, money(avenant.totalHtDelta), { size: 9.5, bold: true });
  const vatAmount = Number(avenant.totalTtcDelta || 0) - Number(avenant.totalHtDelta || 0);
  canvas.text(totalsX + 14, canvas.y + 46, `TVA ${Number(avenant.vatRate || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`, { size: 9, fill: "#687386" });
  canvas.text(totalsX + 150, canvas.y + 46, money(vatAmount), { size: 9.5, bold: true });
  canvas.rect(totalsX, canvas.y + 62, width, 30, { fill: NAVY, stroke: NAVY });
  canvas.text(totalsX + 14, canvas.y + 82, "Total TTC (delta)", { size: 10, bold: true, fill: "#ffffff" });
  canvas.text(totalsX + 134, canvas.y + 82, money(avenant.totalTtcDelta), { size: 10.5, bold: true, fill: GOLD });
  canvas.y += 108;

  const newMarketTotal = Number(quote?.totalTtc || 0) + Number(avenant.totalTtcDelta || 0);
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 46, { fill: "#f7eadf", stroke: "#f0ddcb" });
  canvas.text(MARGIN + 14, canvas.y + 18, "Nouveau total du marché (devis + cet avenant)", { size: 9.5, fill: "#9a5a16" });
  canvas.text(MARGIN + 14, canvas.y + 34, money(newMarketTotal), { size: 12, bold: true, fill: "#9a5a16" });
  canvas.y += 62;
}

function drawAvenantLegalMentions(canvas) {
  const lines = AVENANT_LEGAL_TEXT.flatMap((paragraph) => [...wrapText(paragraph, 100), ""]);
  const height = Math.max(30, 20 + lines.length * 11);
  canvas.ensure(height + 10);
  canvas.text(MARGIN, canvas.y + 14, "Mentions légales", { size: 9.5, bold: true, fill: "#687386" });
  lines.forEach((line, index) => {
    if (line) canvas.text(MARGIN, canvas.y + 30 + index * 11, line, { size: 7.6, fill: "#687386" });
  });
  canvas.y += height + 16;
}

function drawAvenantSignature(canvas, avenant) {
  canvas.ensure(84);
  const signatureX = PAGE_WIDTH - MARGIN - 250;
  if (avenant.status === "Signe") {
    canvas.text(signatureX, canvas.y + 12, `Accepté manuellement le ${formatDate(avenant.signedAt)} par ${fixText(avenant.signerName || avenant.client || "le client")}.`, { size: 9.5, fill: "#687386" });
    canvas.y += 18;
  } else {
    canvas.text(signatureX, canvas.y + 12, "Bon pour accord", { size: 10, fill: "#687386" });
    canvas.text(signatureX, canvas.y + 28, "Date et signature du client :", { size: 9, fill: "#687386" });
    canvas.line(signatureX, canvas.y + 58, PAGE_WIDTH - MARGIN, canvas.y + 58, LINE);
    canvas.line(signatureX, canvas.y + 76, PAGE_WIDTH - MARGIN, canvas.y + 76, LINE);
  }
}

export function buildAvenantPdf({ avenant, quote, db }) {
  const canvas = new PdfCanvas();
  const company = quote ? companyFromQuote(quote, db) : companyFromDb(db, avenant.userId);
  drawHeader(canvas, { quoteNumber: avenant.numero }, company, "AVENANT");
  drawInfoColumns(
    canvas,
    {
      client: avenant.client,
      clientEmail: avenant.clientEmail,
      clientPhone: quote?.clientPhone || "",
      clientAddress: avenant.chantierAddress || quote?.chantierAddress || ""
    },
    null,
    company
  );

  canvas.ensure(50);
  canvas.text(MARGIN, canvas.y + 14, `Avenant ${avenant.numero} au devis N° ${cleanQuoteNumber(avenant.quoteNumber)}`, { size: 11, bold: true });
  canvas.y += 26;

  if (avenant.motif) {
    const motifLines = wrapText(fixText(avenant.motif), 92);
    canvas.ensure(30 + motifLines.length * 12 + 10);
    canvas.text(MARGIN, canvas.y + 14, "Motif de l'avenant", { size: 9.5, fill: "#687386" });
    motifLines.forEach((line, index) => canvas.text(MARGIN, canvas.y + 30 + index * 12, line, { size: 9 }));
    canvas.y += 30 + motifLines.length * 12 + 10;
  }

  drawAvenantLignesTable(canvas, avenant);
  drawAvenantTotals(canvas, avenant, quote);
  drawAvenantLegalMentions(canvas);
  drawAvenantSignature(canvas, avenant);

  return createPdf(addPdfFooters(canvas.pages, {
    company,
    quoteNumber: avenant.numero,
    generatedAt: new Date(),
    quote: { ...(quote || {}), quoteDate: avenant.createdAt, chantierAddress: avenant.chantierAddress || quote?.chantierAddress },
    project: {},
    documentLabel: "Avenant",
    showVersion: false
  }), canvas.images);
}

export function avenantDocumentFilename(avenant) {
  return `Avenant_${sanitizeFilename(avenant.numero || avenant.id)}.pdf`;
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
  return `Intervention_${sanitizeFilename(intervention.reference || intervention.id)}.pdf`;
}

// Procès-verbal de réception (maquette PRO-25 / PRO-02.4) : signé sur place
// par le client et l'entreprise ; réserves non levées en tableau, retenue
// de garantie, point de départ des garanties. Le contenu est figé à la
// signature (app/api/cloture/route.js).
function pvDate(iso, withTime = false) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" }).format(d);
  return withTime ? `${day} à ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(d)}` : day;
}

function pvShortDate(day) {
  const d = new Date(`${String(day).slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(d.getTime()) ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(d) : "—";
}

function pvParagraph(canvas, text, { size = 9.6, fill = "#1f2937", chars = 98, gap = 10 } = {}) {
  wrapText(fixText(text), chars).forEach((line) => {
    canvas.ensure(15);
    canvas.text(MARGIN, canvas.y, line, { size, fill });
    canvas.y += 14;
  });
  canvas.y += gap;
}

function drawPvReservesTable(canvas, reserves) {
  const width = PAGE_WIDTH - MARGIN * 2;
  const cols = [{ label: "N°", w: 44 }, { label: "Réserve", w: 250 }, { label: "Par", w: 140 }, { label: "Avant le", w: width - 434 }];
  const header = () => {
    canvas.rect(MARGIN, canvas.y, width, 24, { fill: SOFT, stroke: LINE });
    let x = MARGIN;
    cols.forEach((c) => { canvas.text(x + 8, canvas.y + 16, c.label, { size: 8.4, bold: true, fill: "#687386" }); x += c.w; });
    canvas.y += 24;
  };
  canvas.ensure(60);
  header();
  reserves.forEach((r) => {
    const lines = wrapText(fixText([r.titre, r.lieu].filter(Boolean).join(" · ")), 46);
    const par = wrapText(fixText(r.attribueeNom || "à attribuer"), 26);
    const h = Math.max(26, 12 + Math.max(lines.length, par.length) * 12);
    if (canvas.ensure(h)) header();
    canvas.rect(MARGIN, canvas.y, width, h, { fill: "#ffffff", stroke: LINE });
    canvas.text(MARGIN + 8, canvas.y + 17, fixText(r.numero), { size: 9, bold: true });
    lines.forEach((l, i) => canvas.text(MARGIN + 52, canvas.y + 17 + i * 12, l, { size: 9 }));
    par.forEach((l, i) => canvas.text(MARGIN + 302, canvas.y + 17 + i * 12, l, { size: 9 }));
    canvas.text(MARGIN + 442, canvas.y + 17, r.pourLe ? pvShortDate(r.pourLe) : "—", { size: 9 });
    canvas.y += h;
  });
  canvas.y += 14;
}

function drawPvSignatures(canvas, pv, company) {
  const width = (PAGE_WIDTH - MARGIN * 2 - 24) / 2;
  canvas.ensure(118);
  const top = canvas.y;
  [
    { x: MARGIN, title: "L'entreprise", name: fixText(pv.entreprise || company.name || "Entreprise"), image: pv.signaturePro, when: `Le ${pvDate(pv.signeLe)}` },
    { x: MARGIN + width + 24, title: "Le client", name: fixText(pv.signataire || "Client"), image: pv.signatureClient, when: `Signé sur place le ${pvDate(pv.signeLe, true)}` }
  ].forEach((s) => {
    canvas.rect(s.x, top, width, 108, { fill: "#ffffff", stroke: LINE });
    canvas.text(s.x + 12, top + 18, s.title, { size: 8.4, bold: true, fill: "#687386" });
    canvas.text(s.x + 12, top + 34, s.name, { size: 10, bold: true });
    canvas.text(s.x + 12, top + 48, s.when, { size: 8.4, fill: "#687386" });
    if (s.image) canvas.image(s.x + 12, top + 54, width - 24, 48, s.image);
  });
  canvas.y = top + 118;
}

export function buildPvReceptionPdf({ pv, chantier = {}, quote = null, db, userId }) {
  const canvas = new PdfCanvas();
  const company = quote ? companyFromQuote(quote, db) : companyFromDb(db, userId);
  drawHeader(canvas, { quoteNumber: pv.numero }, company, "PV DE RÉCEPTION");
  drawInfoColumns(canvas, { client: pv.signataire, clientEmail: quote?.clientEmail || "", clientPhone: quote?.clientPhone || "", clientAddress: quote?.clientAddress || chantier.adresse || "" }, null, company);

  canvas.ensure(90);
  canvas.text(MARGIN, canvas.y + 6, "Procès-verbal de réception", { size: 15, bold: true, fill: NAVY });
  canvas.y += 26;
  const avenants = (pv.avenants || []).length ? ` · avenant${pv.avenants.length > 1 ? "s" : ""} ${pv.avenants.join(", ")}` : "";
  [
    `Chantier : ${fixText(chantier.titre || "")}${chantier.adresse ? ` · ${fixText(chantier.adresse)}` : ""}`,
    `Date : ${pvDate(pv.signeLe)}`,
    `Devis ${cleanQuoteNumber(pv.devisNumero || "")}${avenants}`,
    "En présence du client et de l'entreprise"
  ].forEach((line) => { canvas.text(MARGIN, canvas.y, line, { size: 9.6, fill: "#374151" }); canvas.y += 15; });
  canvas.y += 12;

  canvas.ensure(40);
  canvas.text(MARGIN, canvas.y, "Réception des travaux", { size: 11.5, bold: true, fill: NAVY });
  canvas.y += 20;
  const reserves = pv.reserves || [];
  const devis = `au devis ${cleanQuoteNumber(pv.devisNumero || "")}${(pv.avenants || []).length ? " et à ses avenants" : ""}`;
  pvParagraph(canvas, reserves.length
    ? `Le client déclare réceptionner les travaux décrits ${devis}, avec les réserves suivantes :`
    : `Le client déclare réceptionner sans réserve les travaux décrits ${devis}.`);
  if (reserves.length) drawPvReservesTable(canvas, reserves);
  if ((pv.levees || []).length) {
    pvParagraph(canvas, `${reserves.length ? "Les autres réserves" : "Les réserves relevées pendant le chantier"} (${pv.levees.join(", ")}) ont été levées avant ce jour.`);
  }
  if (pv.retenue?.taux) {
    pvParagraph(canvas, `Une retenue de garantie de ${pv.retenue.taux} % (${money(pv.retenue.montantTtc)} TTC) est appliquée. Elle est libérable un an après la date de ce procès-verbal si aucune réserve n'est alors en cours (loi n° 71-584 du 16 juillet 1971).`);
  }
  pvParagraph(canvas, "Le point de départ des garanties légales est la date de ce procès-verbal : parfait achèvement (1 an), bon fonctionnement des équipements (2 ans), garantie décennale (10 ans), selon les articles 1792 à 1792-6 du Code civil.", { gap: 14 });

  drawPvSignatures(canvas, pv, company);

  return createPdf(addPdfFooters(canvas.pages, {
    company,
    quoteNumber: pv.numero,
    generatedAt: new Date(),
    quote: { ...(quote || {}), quoteDate: pv.signeLe, chantierAddress: chantier.adresse || quote?.chantierAddress },
    project: {},
    documentLabel: "PV de réception",
    showVersion: false
  }), canvas.images);
}

export function pvReceptionFilename(pv) {
  return `PV_reception_${sanitizeFilename(pv.numero || pv.id || "chantier")}.pdf`;
}

// Dossier de fin de chantier (maquette PRO-02.5) : couverture avec la
// dernière photo après, avant / après par lot, équipements et entretien,
// garanties et documents. Les photos arrivent en data URL (JPEG ou PNG).
const INK = "#171B1E";
const GREY = "#5B5F66";

function dossierStamp(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const f = (o) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...o }).format(d);
  return `${f({ day: "2-digit", month: "2-digit" })} ${f({ hour: "2-digit", minute: "2-digit" })}`;
}

function dossierSection(canvas, titre, sousTitre = "") {
  canvas.text(MARGIN, canvas.y + 6, titre, { size: 17, bold: true, fill: INK });
  canvas.y += 14;
  canvas.line(MARGIN, canvas.y, PAGE_WIDTH - MARGIN, canvas.y, INK, 1.5);
  canvas.y += 18;
  if (sousTitre) {
    pvParagraph(canvas, sousTitre, { size: 9.4, fill: GREY, gap: 6 });
  }
}

function dossierPhoto(canvas, x, y, w, h, photo, label) {
  canvas.rect(x, y, w, h, { fill: "#F1F1EC", stroke: "#CFCFC9" });
  const drawn = photo?.dataUrl ? canvas.image(x, y, w, h, photo.dataUrl) : false;
  if (!drawn) canvas.text(x + w / 2 - 34, y + h / 2, photo ? "Photo non lisible" : "Pas de photo", { size: 8.5, fill: GREY });
  const legend = [label, photo?.takenAt ? dossierStamp(photo.takenAt) : "", photo?.author || ""].filter(Boolean).join(" · ");
  canvas.text(x, y + h + 12, legend, { size: 8, fill: GREY });
}

function dossierNewPage(canvas) {
  canvas.pages.push([]);
  canvas.y = CONTENT_TOP;
}

export function buildDossierFinPdf({ chantier = {}, client = "", db, userId, pv = null, paires = [], couverture = null, conseils = [], notices = [], plans = [], factures = [], devis = null, avenants = [], decennale = null, garanties = [] }) {
  const canvas = new PdfCanvas();
  const company = devis ? companyFromQuote(devis, db) : companyFromDb(db, userId);
  const width = PAGE_WIDTH - MARGIN * 2;

  // 1. Couverture.
  canvas.rect(MARGIN, canvas.y, width, 96, { fill: INK, stroke: INK });
  canvas.text(MARGIN + 18, canvas.y + 26, "DOSSIER DE FIN DE CHANTIER", { size: 8.5, bold: true, fill: "#FFC400" });
  canvas.text(MARGIN + 18, canvas.y + 54, fixText(chantier.titre || "Votre chantier"), { size: 21, bold: true, fill: "#FFFFFF" });
  if (chantier.adresse) canvas.text(MARGIN + 18, canvas.y + 76, fixText(chantier.adresse), { size: 9.5, fill: "#C4C8CD" });
  canvas.y += 112;
  dossierPhoto(canvas, MARGIN, canvas.y, width, 300, couverture, "Après");
  canvas.y += 332;
  const lignes = [
    client ? `Pour ${fixText(client)}` : "",
    `Travaux réalisés par ${fixText(company.name || "l'entreprise")}`,
    pv?.signeLe ? `Réceptionnés le ${pvDate(pv.signeLe)} (procès-verbal ${pv.numero})` : "",
    devis?.quoteNumber ? `Devis ${cleanQuoteNumber(devis.quoteNumber)}${avenants.length ? ` et avenant${avenants.length > 1 ? "s" : ""} ${avenants.join(", ")}` : ""}` : ""
  ].filter(Boolean);
  lignes.forEach((l, i) => { canvas.text(MARGIN, canvas.y, l, { size: i === 0 ? 12 : 10, bold: i === 0, fill: INK }); canvas.y += i === 0 ? 20 : 16; });
  canvas.y += 14;
  canvas.text(MARGIN, canvas.y, "Dans ce dossier", { size: 9, bold: true, fill: GREY });
  canvas.y += 16;
  ["1. Avant / après", "2. Équipements et entretien", "3. Garanties et documents"].forEach((l) => { canvas.text(MARGIN, canvas.y, l, { size: 9.6, fill: INK }); canvas.y += 14; });

  // 2. Avant / après.
  dossierNewPage(canvas);
  dossierSection(canvas, "Avant / après", "Photos prises sur le chantier dans l'application Koji Pro ; la date et l'heure sont posées au moment de la prise.");
  const colW = (width - 14) / 2;
  if (!paires.length) pvParagraph(canvas, "Aucune photo avant / après n'a été prise pour ce chantier.");
  paires.forEach((p) => {
    canvas.ensure(176);
    canvas.text(MARGIN, canvas.y, fixText(p.lot), { size: 10.5, bold: true, fill: INK });
    canvas.y += 8;
    dossierPhoto(canvas, MARGIN, canvas.y, colW, 132, p.avant, "Avant");
    dossierPhoto(canvas, MARGIN + colW + 14, canvas.y, colW, 132, p.apres, "Après");
    canvas.y += 160;
  });

  // 3. Équipements et entretien.
  dossierNewPage(canvas);
  dossierSection(canvas, "Équipements et entretien", "Conseils rédigés par Koji d'après les travaux de votre devis. Les garanties des fabricants sont celles de leurs notices.");
  if (!conseils.length) pvParagraph(canvas, "Pas d'entretien particulier pour ces travaux.");
  conseils.forEach((c) => {
    canvas.ensure(48);
    canvas.text(MARGIN, canvas.y, fixText(c.titre), { size: 10.5, bold: true, fill: INK });
    canvas.y += 15;
    pvParagraph(canvas, c.texte, { size: 9.4, gap: 0 });
    if (c.lignes?.length) pvParagraph(canvas, `D'après : ${c.lignes.slice(0, 3).join(", ")}`, { size: 8.2, fill: GREY, gap: 8 });
    else canvas.y += 8;
  });
  canvas.ensure(60);
  canvas.y += 6;
  canvas.text(MARGIN, canvas.y, "Notices des fabricants", { size: 10.5, bold: true, fill: INK });
  canvas.y += 16;
  pvParagraph(canvas, notices.length ? `${notices.join(", ")} : jointes à l'e-mail et disponibles dans votre espace Koji Client.` : "Aucune notice jointe.", { size: 9.4 });
  plans.forEach((p) => {
    canvas.ensure(320);
    canvas.text(MARGIN, canvas.y, `Schéma des réseaux : ${fixText(p.titre)}`, { size: 10.5, bold: true, fill: INK });
    canvas.y += 10;
    if (p.dataUrl) {
      dossierPhoto(canvas, MARGIN, canvas.y, width, 280, p, "");
      canvas.y += 300;
    } else {
      canvas.y += 6;
      pvParagraph(canvas, "Joint à l'e-mail (PDF).", { size: 9.4 });
    }
  });

  // 4. Garanties et documents.
  dossierNewPage(canvas);
  dossierSection(canvas, "Garanties et documents", pv?.signeLe ? `Les garanties courent à partir de la réception du ${pvDate(pv.signeLe)}.` : "Les garanties courent à partir de la réception.");
  const boxW = (width - 20) / 3;
  garanties.forEach((g, i) => {
    const x = MARGIN + i * (boxW + 10);
    canvas.rect(x, canvas.y, boxW, 98, { fill: "#FFFFFF", stroke: "#CFCFC9" });
    canvas.text(x + 10, canvas.y + 18, fixText(g.titre), { size: 9, bold: true, fill: INK });
    canvas.text(x + 10, canvas.y + 40, g.duree, { size: 16, bold: true, fill: INK });
    canvas.text(x + 10, canvas.y + 58, fixText(g.jusqua), { size: 7.8, fill: GREY });
    wrapText(fixText(g.objet), 30).slice(0, 3).forEach((l, k) => canvas.text(x + 10, canvas.y + 70 + k * 9, l, { size: 7.4, fill: GREY }));
  });
  canvas.y += 118;
  if (decennale?.insurer) {
    canvas.text(MARGIN, canvas.y, "Assurance décennale", { size: 10.5, bold: true, fill: INK });
    canvas.y += 16;
    pvParagraph(canvas, [fixText(decennale.insurer), decennale.policy ? `contrat ${fixText(decennale.policy)}` : "", decennale.until ? `valable jusqu'au ${pvShortDate(decennale.until)}` : ""].filter(Boolean).join(" · "), { size: 9.4 });
  }
  canvas.text(MARGIN, canvas.y, "Vos documents", { size: 10.5, bold: true, fill: INK });
  canvas.y += 16;
  const docs = [
    pv?.signeLe ? `Procès-verbal de réception ${pv.numero} du ${pvDate(pv.signeLe)}` : "",
    devis?.quoteNumber ? `Devis signé ${cleanQuoteNumber(devis.quoteNumber)}${avenants.length ? ` et avenant${avenants.length > 1 ? "s" : ""} ${avenants.join(", ")}` : ""}` : "",
    ...factures.map((f) => `${fixText(f.type || "Facture")} ${f.invoiceNumber || ""} · ${money(f.amountTtc)} TTC${f.status === "Payee" ? " · payée" : ""}`)
  ].filter(Boolean);
  docs.forEach((d) => { canvas.ensure(16); canvas.text(MARGIN + 10, canvas.y, `- ${d}`, { size: 9.2, fill: INK }); canvas.y += 14; });
  canvas.y += 14;
  canvas.ensure(70);
  canvas.text(MARGIN, canvas.y, "Un souci ? Contactez-nous", { size: 10.5, bold: true, fill: INK });
  canvas.y += 16;
  [company.name, company.phone, company.email].filter(Boolean).forEach((l) => { canvas.text(MARGIN, canvas.y, fixText(l), { size: 9.4, fill: INK }); canvas.y += 14; });
  canvas.y += 6;
  pvParagraph(canvas, "Pour signaler un désordre pendant les garanties, contactez l'entreprise en joignant une photo.", { size: 8.6, fill: GREY });

  return createPdf(addPdfFooters(canvas.pages, {
    company,
    quoteNumber: devis?.quoteNumber || "",
    generatedAt: new Date(),
    quote: { ...(devis || {}), quoteDate: new Date().toISOString(), chantierAddress: chantier.adresse || devis?.chantierAddress },
    project: {},
    documentLabel: "Dossier de fin de chantier",
    showVersion: false
  }), canvas.images);
}

export function dossierFinFilename(chantier = {}) {
  return `Dossier_fin_de_chantier_${sanitizeFilename(chantier.titre || "chantier")}.pdf`;
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
    // Only M/L/C/H/V/A/Z are implemented below (no S/Q/T) — an unsupported
    // command used to fall through with argCounts[upper] ?? 0, which never
    // advances `i` and spins forever instead of failing loudly.
    if (!(upper in argCounts)) {
      throw new Error(`parseSvgPathD: unsupported path command "${cmd}" (only M/L/C/H/V/A/Z are implemented)`);
    }
    const count = argCounts[upper];
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
// fonts this PDF engine uses have no emoji glyphs to fall back on. `size`
// scales a 10x7 reference box (matches drawPhoneIcon/drawPinIcon's
// (canvas, x, y, size, fill) signature, needed since buildBusinessCardPdf's
// contactRow() calls all three interchangeably).
function drawEnvelopeIcon(canvas, x, y, size, fill) {
  const w = size;
  const h = size * 0.7;
  const strokeWidth = Math.max(0.6, size * 0.09);
  canvas.rect(x, y, w, h, { fill: null, stroke: fill, width: strokeWidth });
  canvas.line(x, y, x + w / 2, y + h * 0.6, fill, strokeWidth);
  canvas.line(x + w, y, x + w / 2, y + h * 0.6, fill, strokeWidth);
}

// The standard "phone receiver" outline glyph (Feather Icons' `phone.svg`,
// MIT-licensed, viewBox 24x24) — the two earlier hand-drawn attempts didn't
// read as a phone, so this uses the real, recognizable icon shape instead.
const PHONE_ICON_PATH = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z";
const PHONE_ICON_SIZE = 24;

function drawPhoneIcon(canvas, x, y, size, fill) {
  drawSvgPath(canvas, PHONE_ICON_PATH, PHONE_ICON_SIZE, { x, y, size, stroke: fill, strokeWidth: size * 0.09 });
}

// Pin/location glyph for the address row on the business card front
// (lib/document-generator.js buildBusinessCardPdf) — built from circle/line
// primitives rather than an SVG path: parseSvgPathD above only implements
// M/L/C/H/V/A/Z (no S/Q/T), and Feather's actual map-pin.svg path relies on
// the "S" smooth-curve shorthand, which would silently hang the parser.
function drawPinIcon(canvas, x, y, size, fill) {
  const cx = x + size / 2;
  const r = size * 0.26;
  const strokeWidth = Math.max(0.6, size * 0.12);
  canvas.circle(cx, y + r, r, { stroke: fill, width: strokeWidth });
  canvas.line(cx - r * 0.6, y + r * 1.75, cx, y + size * 0.96, fill, strokeWidth);
  canvas.line(cx + r * 0.6, y + r * 1.75, cx, y + size * 0.96, fill, strokeWidth);
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
export async function buildBusinessCardPdf({ company = {}, professions = [], cardOptions = {} }) {
  const canvas = new PdfCanvas(CARD_WIDTH, CARD_HEIGHT);
  const left = 18;
  // Chaque "information affichee" de /profil/carte-de-visite peut etre
  // masquee individuellement (business.cardOptions, cote true par defaut
  // tant que la cle n'existe pas encore — compte deja cree avant cette
  // fonctionnalite).
  const on = (key) => cardOptions[key] !== false;

  // --- Front (creme, maquette ProfilCarteVisite du 21 oct) -----------------
  canvas.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, { fill: "#FBF9F5", stroke: "#FBF9F5" });
  canvas.rect(0, 0, CARD_WIDTH, 3, { fill: GOLD, stroke: GOLD });

  const hasLogo = on("showLogo") && Boolean(company.logoDataUrl);
  const logoSize = 22;
  if (hasLogo) canvas.image(left, 14, logoSize, logoSize, company.logoDataUrl);

  // Badge "ARTISAN" en haut a droite — identite de compte fixe, independante
  // des bascules "informations affichees".
  const artisanBadgeW = 38;
  const artisanBadgeH = 11;
  const artisanBadgeX = CARD_WIDTH - 14 - artisanBadgeW;
  const artisanBadgeY = 14;
  canvas.rect(artisanBadgeX, artisanBadgeY, artisanBadgeW, artisanBadgeH, { fill: "#F6ECD3", stroke: "#F6ECD3" });
  canvas.text(artisanBadgeX + 5, artisanBadgeY + 8, "ARTISAN", { size: 6, bold: true, fill: "#8F6A12" });

  const companyName = fixText(company.raisonSociale || "Entreprise");
  canvas.wrapped(left, 54, companyName, 26, { size: 15.5, bold: true, fill: CARD_INK });

  const specialty = on("showSpecialty") ? fixText((professions || []).filter(Boolean).join(" · ")).toUpperCase() : "";
  let frontY = 68;
  if (specialty) {
    canvas.text(left, frontY, specialty, { size: 6.5, bold: true, fill: "#8F6A12" });
    frontY += 6;
    canvas.rect(left, frontY, 20, 1.2, { fill: GOLD, stroke: GOLD });
    frontY += 10;
  } else {
    frontY += 8;
  }

  // Lignes de contact, chacune avec un badge rond marine + icone or (meme
  // esprit que la maquette), sautees si leur bascule est eteinte ou le champ
  // absent du profil.
  function contactRow(drawIcon, value) {
    canvas.circle(left + 5, frontY + 5, 5, { fill: CARD_INK });
    drawIcon(canvas, left + 2, frontY + 2, 6, GOLD);
    canvas.text(left + 14, frontY + 7.5, value, { size: 7.6, fill: CARD_INK });
    frontY += 13;
  }
  if (on("showPhone") && company.phone) contactRow(drawPhoneIcon, formatPhoneIntl(company.phone));
  if (on("showEmail") && company.emailPro) contactRow(drawEnvelopeIcon, fixText(company.emailPro));
  if (on("showAddress")) {
    const address = [company.addressLine1, [company.postalCode, company.city].filter(Boolean).join(" ")].filter(Boolean).map(fixText).join(", ");
    if (address) contactRow(drawPinIcon, address);
  }

  // A QR code the user uploaded themselves (e.g. one pointing somewhere other
  // than their website — a review page, a WhatsApp link...) always wins over
  // the one auto-generated from the website field.
  const companyWebsite = fixText(company.website || "");
  const customQr = fixText(company.qrCodeDataUrl || "");
  const frontQr = on("showQr") ? (customQr || (companyWebsite ? await qrDataUrl(withProtocol(companyWebsite)) : "")) : "";
  if (frontQr) {
    const qrSize = 40;
    const qrX = CARD_WIDTH - 14 - qrSize;
    const qrY = CARD_HEIGHT - 20 - qrSize;
    canvas.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, { fill: "#ffffff", stroke: CARD_LINE, width: 1 });
    canvas.image(qrX, qrY, qrSize, qrSize, frontQr);
    canvas.text(qrX - 2, qrY + qrSize + 11, "MON SITE WEB", { size: 5, bold: true, fill: "#8F6A12" });
  } else if (!on("showQr") || (!customQr && !companyWebsite)) {
    // Sans QR (ni site renseigne), le lien passe simplement dans les
    // coordonnees — meme logique que la variante "sans site" du PDF de
    // reference (CarteVisite.dc.html).
    if (companyWebsite) canvas.text(left, frontY, companyWebsite, { size: 7.4, fill: "#5b6472" });
  }

  // --- Back (Koji navy) ------------------------------------------------------
  canvas.pages.push([]);
  canvas.rect(0, 0, CARD_WIDTH, CARD_HEIGHT, { fill: NAVY, stroke: NAVY });

  // Verso fixe (maquette ProfilCarteVisite/CarteVisite du 21 oct) : marque +
  // "KOJI" + accroche, puis "DISPONIBLE SUR" + les deux badges stores. Pas de
  // QR code sur ce cote — la maquette n'en a aucun (seul le recto en a un,
  // vers le site de l'entreprise).
  const centerX = CARD_WIDTH / 2;
  const markSize = 28;
  drawSvgPath(canvas, KOJI_MARK_PATH, KOJI_MARK_SIZE, { x: centerX - markSize / 2, y: 10, size: markSize, fill: GOLD });
  canvas.text(centerX - 20, 48, "K O J I", { size: 11, bold: true, fill: GOLD });
  canvas.wrapped(centerX - 50, 58, "Devis, chantiers et factures, au même endroit.", 40, { size: 6, fill: CARD_MUTED });

  canvas.text(centerX - 24, 76, "DISPONIBLE SUR", { size: 5.5, bold: true, fill: GOLD });

  // Store badges, same visual language and copy as components/AuthBrandPanel.jsx
  // (the login page): dark rounded box, icon left, two-line label right.
  const badgeW = 96;
  const badgeH = 28;
  const badgeGap = 8;
  const badgeY = 84;
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

  return createPdf(canvas.pages, canvas.images, { width: CARD_WIDTH, height: CARD_HEIGHT });
}

export function businessCardFilename(company = {}) {
  return `Carte_visite_${sanitizeFilename(company.raisonSociale || "Koji")}.pdf`;
}

