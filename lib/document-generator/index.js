import * as shared from './shared.js';
// Imports perdus au découpage du 3 nov. (#36) : sans eux, chaque PDF
// échouait (« PdfCanvas is not defined »).
import QRCode from "qrcode";
import { fixObjectText, fixText } from "../text";
import { isoWeekInfo } from "../worker-portal";
import { computeSurchargeBreakdown, libelleMajoration } from "../quote-calculations";
import { INFORMATION_RETRACTATION, formulaireRetractation } from "../signature-lieu";
const { PdfCanvas, PAGE_WIDTH, PAGE_HEIGHT, MARGIN, CONTENT_TOP, CONTENT_BOTTOM, NAVY, GOLD, BLUE, LINE, SOFT, money, formatDate, sanitizeFilename, companyFromDb, companyFromQuote, hexToRgb, color, pdfText, wrapText, parseDataUrl, paethPredictor, unfilterPng, decodePng, readJpegDimensions, buildImageXObject, createPdf, pdfTextOp, cityFromAddress, quoteDateValue, quoteCityDate, vatRateFromQuote, itemMaterialsTotal, itemTotalHt, itemQuantity, itemUnit, itemUnitPriceHt, roomLabel, groupedItemsByRoom, quoteAddress, companyLines, companyContactLines, companyFooterLegal, companyFooterCenterLines, cleanQuoteNumber, displayQuoteNumber, quoteVersionNumber, displayQuoteVersion, clientLines, paymentInfoFromQuote, paymentConditions, quoteTotals, drawChantierSections, TABLE, drawTableHeader, materialSummary, drawQuoteMainTable, drawTotalsAndPayment, drawMentionsTva, lignesTvaDocument, mentionsTvaDocument } = shared;
import { addPdfFooters, blocPartie, dateCourte, dateHeure, dateLongue, drawHeader, drawInfoColumns, enTetePro, mentionsPro, piedsPro, signaturesPro, tableauPro, titreSection, totauxPro } from "./gabarit-pro.js";
import { MENTION_RETARD } from "../compte-pro.js";

// Devis (maquette PRO-25, gabarit A4 Pro) : en-tête de l'entreprise et
// numéro, client et chantier, lignes numérotées par ouvrage, totaux HT /
// TVA (avec le motif du taux) / TTC, conditions, mentions, rétractation
// pour un particulier, cases de signature. Le même gabarit sert à la
// facture issue d'un devis (documentType « facture »).
const MOTIFS_TVA = { 10: "travaux dans un logement de plus de 2 ans", 5.5: "travaux d'amélioration énergétique" };
const LOCAUX = { "logement-ancien": "logement de plus de 2 ans", "logement-neuf": "logement neuf", professionnel: "local professionnel" };

function nombreFr(n, dec = 2) {
  return Number(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace(/ | /g, " ");
}

function lignesDevisPro(quote) {
  const items = fixObjectText(quote.items || []);
  const groupes = groupedItemsByRoom(items);
  const plusieurs = groupes.length > 1;
  const lignes = [];
  let n = 0;
  for (const g of groupes) {
    if (plusieurs) lignes.push({ groupe: g.room });
    for (const item of g.items) {
      n += 1;
      const details = [
        ...(item.description ? [fixText(item.description)] : []),
        ...(item.subWorks || item.children || []).map((s) => fixText(s.label || s.name || s.designation || "")).filter(Boolean).map((s) => `· ${s}`),
        ...(materialSummary(item).length ? [`Fournitures : ${materialSummary(item).join(", ")}`] : [])
      ];
      lignes.push({
        cellules: [
          String(n).padStart(2, "0"),
          { texte: `${item.variante ? "Variante, hors total : " : item.prefixe ? `${fixText(item.prefixe)}${item.horsTotal ? ", hors total" : ""} : ` : ""}${fixText(item.label || "Ouvrage")}`, details },
          itemQuantity(item).toLocaleString("fr-FR"),
          fixText(itemUnit(item)),
          item.sansPrix ? "—" : nombreFr(itemUnitPriceHt(item)),
          item.sansPrix ? "—" : nombreFr(itemTotalHt(item))
        ]
      });
    }
  }
  return lignes;
}

function tauxTexte(taux) {
  return `${Number(taux).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

export function buildQuotePdf({ quote, project, db, documentType = "devis" }) {
  const isFacture = documentType === "facture";
  const canvas = new PdfCanvas();
  const company = companyFromQuote(quote, db);
  const vatRate = vatRateFromQuote(quote);
  const numero = cleanQuoteNumber(quote.quoteNumber || "");
  const version = Number(quote.versionNumber || 1);
  const dateDoc = quote.quoteDate || quote.createdAtIso || quote.createdAt || new Date().toISOString();
  const objet = fixText(quote.project || "");

  enTetePro(canvas, {
    company,
    kicker: isFacture ? "Facture" : "Devis",
    titre: `N° ${numero || "—"}${!isFacture && version > 1 ? ` · version ${version}` : ""}`,
    lignes: [
      `Date : ${dateLongue(dateDoc)}`,
      isFacture ? "" : `Validité : ${Number(quote.validityDays || 30)} jours`,
      objet
    ]
  });

  const adresseClient = fixText(quote.clientAddress || project?.clientAddress || "");
  const chantier = quoteAddress(quote, project);
  const local = LOCAUX[quote.tva?.local] || "";
  const ligneChantier = [
    chantier && chantier !== adresseClient ? `Chantier : ${chantier}` : chantier ? "Chantier : même adresse" : "",
    local ? `${local}${quote.tva?.local?.startsWith("logement") ? ", usage d'habitation" : ""}` : ""
  ].filter(Boolean).join(" · ");
  blocPartie(canvas, { kicker: "Client", nom: quote.client || project?.client || "Client", lignes: [adresseClient, ligneChantier] });

  const description = fixText(quote.workDescription || "");
  if (description && description !== objet) mentionsPro(canvas, [{ titre: "Travaux :", texte: description }]);

  if ((quote.items || []).length) {
    tableauPro(canvas, {
      colonnes: [{ titre: "N°", largeur: 28 }, { titre: "Désignation", largeur: 250 }, { titre: "Qté", largeur: 42, droite: true }, { titre: "U", largeur: 34, droite: true }, { titre: "PU HT", largeur: 70, droite: true }, { titre: "Total HT", largeur: 78, droite: true }],
      lignes: lignesDevisPro(quote)
    });
  } else {
    mentionsPro(canvas, [{ texte: "Aucune ligne pour ce devis." }]);
  }

  // Totaux : majorations montrées au client, HT, TVA par taux avec le motif, TTC.
  const totals = quoteTotals(quote, vatRate);
  const itemsHt = (quote.items || []).filter((i) => !i.variante && !i.horsTotal).reduce((s, i) => s + itemTotalHt(i), 0);
  const majorations = computeSurchargeBreakdown(itemsHt, quote.surcharges || []).lines.filter((s) => s.mode === "client" || (!s.mode && s.showToClient));
  const lignesTva = lignesTvaDocument(quote, vatRate).map((l) => {
    const t = Number(String(l.label).replace(/[^0-9,.]/g, "").replace(",", "."));
    const motif = MOTIFS_TVA[t];
    return { label: `${l.label.replace(/(\d)%/, "$1 %")}${motif ? ` (${motif})` : ""}`, valeur: money(l.montant) };
  });
  totauxPro(canvas, {
    lignes: [
      ...majorations.map((s) => ({ label: fixText(libelleMajoration(s)), valeur: money(s.amount) })),
      { label: "Total HT", valeur: money(totals.totalHt) },
      ...lignesTva
    ],
    grand: { label: quote.autoliquidation ? "Net à payer" : "Total TTC", valeur: money(totals.totalTtc) }
  });

  // Conditions : échéancier, délai, garanties, conditions propres.
  const jalons = (Array.isArray(quote.paymentMilestones) ? quote.paymentMilestones : []).filter((m) => Number(m.percent) > 0);
  const echeancier = jalons.map((m) => `${fixText(m.label || "Échéance")} : ${tauxTexte(m.percent)} (${money((totals.totalTtc * Number(m.percent)) / 100)})`).join(" ; ");
  const duree = fixText(quote.expectedDuration || "");
  const debut = quote.startDate ? dateLongue(quote.startDate) : "";
  const conditions = [
    echeancier ? `${echeancier}.` : "",
    duree || debut ? `Délai d'exécution : ${[duree, debut ? `à partir du ${debut}` : ""].filter(Boolean).join(" ")}.` : "",
    "Garanties : parfait achèvement 1 an, bon fonctionnement 2 ans, décennale 10 ans.",
    fixText(quote.paymentConditions || company.paymentTerms || "")
  ].filter(Boolean).join(" ");
  const paragraphes = [{ titre: "Conditions", texte: conditions }];
  if (isFacture) {
    const p = paymentInfoFromQuote(quote, company);
    paragraphes.push({ titre: "Paiement", texte: [p.iban ? `Virement : IBAN ${p.iban}${p.bic ? ` · BIC ${p.bic}` : ""} · référence ${numero}.` : "", MENTION_RETARD].filter(Boolean).join(" ") });
  }
  if (quote.legalMentions) paragraphes.push({ titre: "Mentions", texte: fixText(quote.legalMentions) });
  for (const m of mentionsTvaDocument(quote, vatRate)) paragraphes.push({ titre: m.titre ? `${m.titre} :` : "", texte: m.texte });
  mentionsPro(canvas, paragraphes);

  if (!isFacture) {
    const particulier = quote.clientType !== "societe" && quote.signatureLieu !== "locaux";
    if (particulier) {
      mentionsPro(canvas, [{ titre: "Droit de rétractation :", texte: `${quote.retractationJusquau ? `jusqu'au ${dateLongue(quote.retractationJusquau)} inclus. ` : ""}${INFORMATION_RETRACTATION.replace(/^Droit de rétractation\s*:\s*/i, "")}` }]);
    }
    const surPlace = quote.signatureProvider === "sur-place" && quote.signedAt;
    if (surPlace) {
      const c = quote.consentements || {};
      mentionsPro(canvas, [{
        titre: "Signature :",
        texte: [
          c.demandeExpresse && quote.demarrageDemande ? `démarrage demandé le ${dateCourte(quote.demarrageDemande)} avant la fin du délai, case cochée le ${dateCourte(c.demandeExpresse)}.` : "",
          c.mentionTva ? `Mention TVA à taux réduit certifiée le ${dateCourte(c.mentionTva)}.` : "",
          c.exemplaireEmail ? "Exemplaire remis par e-mail, avec l'accord du client." : "Exemplaire remis sur papier."
        ].filter(Boolean).join(" ")
      }]);
    }
    const lieu = quote.signatureLieu === "locaux" ? "dans les locaux de l'entreprise" : "chez le client";
    const client = !quote.signedAt
      ? { label: "Bon pour accord · le client", texte: "Date et signature, précédées de « bon pour accord »" }
      : surPlace
        ? { label: "Bon pour accord · le client", image: quote.signatureImage, texte: `Signé ${lieu} le ${dateHeure(quote.signedAt)} par ${fixText(quote.signerName || quote.client || "le client")}` }
        : { label: "Bon pour accord · le client", image: quote.signatureImage, texte: `Signé en ligne le ${dateHeure(quote.signedAt)} · preuve conservée` };
    signaturesPro(canvas, [{ label: "Pour l'entreprise", texte: `${fixText(company.dirigeant || company.name)} · ${dateCourte(dateDoc)}` }, client]);

    if (particulier) {
      const formulaire = formulaireRetractation({ entreprise: company.name, adresse: [company.addressLine1, company.addressLine2].filter(Boolean).join(" "), email: company.email });
      const h = 18 + formulaire.length * 14;
      canvas.ensure(h + 12);
      canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, h, { stroke: "#CFCFC9", width: 0.8 });
      formulaire.forEach((l, i) => canvas.text(MARGIN + 10, canvas.y + 16 + i * 14, l, { size: i === 0 ? 9.2 : 8.2, bold: i === 0, fill: i === 0 ? "#171B1E" : "#3A3F44" }));
      canvas.y += h + 10;
    }
  }

  const label = isFacture ? "Facture" : "Devis";
  return createPdf(piedsPro(canvas.pages, (i, n) => [`${label} ${numero}`, !isFacture && version > 1 ? `version ${version}` : "", `page ${i} / ${n}`].filter(Boolean).join(" · ")), canvas.images);
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
  // Liste des fournitures d'un devis au gabarit Pro (PRO-25).
  const canvas = new PdfCanvas();
  const company = companyFromQuote(quote, db);
  const numero = cleanQuoteNumber(quote.quoteNumber || "");
  enTetePro(canvas, { company, kicker: "Liste des fournitures", titre: `Devis ${numero || "—"}`, lignes: [fixText(quote.project || ""), fixText(quote.client || "")] });
  const lines = supplyLinesFromQuote(quote, db);
  if (!lines.length) {
    mentionsPro(canvas, [{ texte: "Aucune fourniture liée à ce devis." }]);
  } else {
    tableauPro(canvas, {
      colonnes: [{ titre: "N°", largeur: 28 }, { titre: "Fourniture", largeur: 230 }, { titre: "Fournisseur", largeur: 120 }, { titre: "Qté", largeur: 50, droite: true }, { titre: "Total HT", largeur: 80, droite: true }],
      lignes: lines.map((l, i) => ({ cellules: [String(i + 1).padStart(2, "0"), { texte: l.name, details: [[l.category, l.ouvrage ? `pour ${l.ouvrage}` : ""].filter(Boolean).join(" · ")] }, l.supplier || "—", l.quantity.toLocaleString("fr-FR"), nombreFr(l.total)] }))
    });
    totauxPro(canvas, { grand: { label: "Total fournitures HT", valeur: money(lines.reduce((s, l) => s + l.total, 0)) } });
  }
  return createPdf(piedsPro(canvas.pages, (i, n) => `Fournitures du devis ${numero} · page ${i} / ${n}`), canvas.images);
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
    @page{margin:22mm 15mm 24mm;@top-left{content:"${docCityDate}";font-size:8pt;color:#5B5F66;}@top-right{content:"${docNumber}\\A ${docVersion}";white-space:pre-line;font-size:8pt;color:#06132d;font-weight:700;}@bottom-left{content:"KJ  Édité avec Koji";font-size:8pt;color:#5B5F66;}@bottom-center{content:"${docFooterCenter}";white-space:pre-line;font-size:7pt;color:#5B5F66;}@bottom-right{content:counter(page) "/" counter(pages);font-size:8pt;color:#5B5F66;font-weight:700;}}
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
    .room-row td{background:#F1F1EC;color:#171B1E;font-weight:700;border-bottom:1px solid #E6E6E1}
    .child-row td,.supply-row td{color:#5B5F66;font-size:10px}
    .description-row td{color:#5B5F66;font-size:10px;padding-top:0}
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
        return cs.map((s) => `<div><span>${htmlEscape(libelleMajoration(s))}</span><strong>${money(s.amount)}</strong></div>`).join("");
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
    @page{margin:18mm 15mm 22mm;@bottom-left{content:"KJ  Édité avec Koji";font-size:8pt;color:#5B5F66;}@bottom-center{content:"${footerCenter}";white-space:pre-line;font-size:7pt;color:#5B5F66;}@bottom-right{content:counter(page) "/" counter(pages);font-size:8pt;color:#5B5F66;font-weight:700;}}
    body{font-family:Arial,sans-serif;color:#06132d} h1{font-size:24px}
    table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #dfe6f0;padding:10px;text-align:left}
    th{background:#06132d;color:white;text-transform:uppercase;font-size:12px}
    .footer-note{border-top:1px solid #dfe6f0;color:#5B5F66;font-size:11px;margin-top:28px;padding-top:10px;text-align:center}
  </style></head><body><h1>Liste fournisseurs / fournitures - ${htmlEscape(quote.quoteNumber)}</h1>
    <table><thead><tr><th>Fourniture</th><th>Catégorie</th><th>Fournisseur</th><th>Qté</th><th>Total HT</th></tr></thead><tbody>${rows || "<tr><td colspan=\"5\">Aucune fourniture liée.</td></tr>"}</tbody></table>
    <div class="footer-note">Édité avec Koji</div>
  </body></html>`;
}

export function quoteDocumentFilename(quote, type, format) {
  const base = type === "supplies" ? "Fournitures" : type === "facture" ? "Facture" : "Devis";
  const ext = format === "word" ? "docx" : "pdf";
  return `${base}_${sanitizeFilename(quote.quoteNumber || quote.id)}.${ext}`;
}

// Factures (maquette PRO-25, gabarit A4 Pro) : facture d'acompte ou
// intermédiaire, facture de situation (marché par lot, avancement, dû,
// déjà facturé, retenue de garantie, net, TVA, à payer), avoir, reçu.
const CREDIT_REASON_LABELS = {
  erreur: "Erreur sur la facture",
  retractation: "Rétractation du client",
  geste: "Geste commercial",
  annulation: "Annulation"
};

function tauxFactureDe(invoice, quote) {
  const t = invoice.tauxTva != null ? Number(invoice.tauxTva) : invoice.situation ? Number(invoice.situation.tauxTva) : null;
  return Number.isFinite(t) && t !== null ? t / 100 : quote ? vatRateFromQuote(quote) : 0.2;
}

function enTeteFacture(canvas, { invoice, quote, project, company, kicker, lignes }) {
  enTetePro(canvas, { company, kicker, titre: `N° ${fixText(invoice.invoiceNumber || "—")}`, lignes });
  const adresse = fixText(quote?.clientAddress || project?.clientAddress || "");
  const chantier = fixText(quote ? quoteAddress(quote, project) : project?.address || "");
  blocPartie(canvas, {
    kicker: "Client",
    nom: invoice.client || quote?.client || "Client",
    lignes: [adresse, chantier && chantier !== adresse ? `Chantier : ${chantier}` : chantier ? "Chantier : même adresse" : ""]
  });
}

function piedFacture(canvas, invoice) {
  const label = invoice.kind === "avoir" ? "Avoir" : "Facture";
  return createPdf(piedsPro(canvas.pages, (i, n) => `${label} ${fixText(invoice.invoiceNumber || "")} · page ${i} / ${n} · numérotation continue`), canvas.images);
}

function paiementFacture(company, invoice, retenue) {
  const p = { iban: company.iban, bic: company.bic };
  return [
    { titre: "Paiement", texte: [p.iban ? `Virement : IBAN ${p.iban}${p.bic ? ` · BIC ${p.bic}` : ""} · référence ${fixText(invoice.invoiceNumber || "")}.` : "", MENTION_RETARD, retenue ? "Retenue de garantie restituée à la levée des réserves, au plus tard un an après la réception." : ""].filter(Boolean).join(" ") },
    ...(invoice.notes ? [{ titre: "Notes", texte: fixText(invoice.notes) }] : [])
  ];
}

export function buildInvoicePdf({ invoice, quote, project, db }) {
  const canvas = new PdfCanvas();
  const company = quote ? companyFromQuote(quote, db) : companyFromDb(db, invoice.userId);
  const taux = tauxFactureDe(invoice, quote);
  const devis = [invoice.quoteNumber || quote?.quoteNumber ? `Devis ${cleanQuoteNumber(invoice.quoteNumber || quote?.quoteNumber)}${quote?.versionNumber > 1 ? ` v${Number(quote.versionNumber)}` : ""}` : "", fixText(invoice.projectTitle || project?.title || "")].filter(Boolean).join(" · ");

  if (invoice.kind === "avoir") {
    enTeteFacture(canvas, { invoice, quote, project, company, kicker: "Avoir", lignes: [`Date : ${dateLongue(invoice.issuedAt || invoice.createdAt)}`, `Facture d'origine ${fixText(invoice.refInvoiceNumber || "—")}${invoice.refInvoiceDate ? ` du ${dateCourte(invoice.refInvoiceDate)}` : ""}`, devis] });
    const ttc = Number(invoice.amountTtc || 0);
    const ht = Math.round((ttc / (1 + taux)) * 100) / 100;
    tableauPro(canvas, {
      colonnes: [{ titre: "N°", largeur: 28 }, { titre: "Motif", largeur: 380 }, { titre: "Montant HT", largeur: 100, droite: true }],
      lignes: [{ cellules: ["01", `${CREDIT_REASON_LABELS[invoice.reason] || fixText(invoice.reason || "Avoir")} · facture ${fixText(invoice.refInvoiceNumber || "")}`, money(ht)] }]
    });
    totauxPro(canvas, { lignes: [{ label: "Total HT", valeur: money(ht) }, { label: `TVA ${String(Math.round(taux * 1000) / 10).replace(".", ",")} %`, valeur: money(ttc - ht) }], grand: { label: "Total avoir TTC", valeur: money(ttc) } });
    if (invoice.notes) mentionsPro(canvas, [{ titre: "Notes", texte: fixText(invoice.notes) }]);
    return piedFacture(canvas, invoice);
  }

  const sit = invoice.situation;
  const kicker = sit ? `Facture de situation n° ${sit.numero || 1}` : /acompte/i.test(invoice.type || "") ? "Facture d'acompte" : "Facture";
  enTeteFacture(canvas, {
    invoice, quote, project, company, kicker,
    lignes: [`Date : ${dateLongue(invoice.issuedAt || invoice.createdAt)}`, invoice.status === "Payee" && invoice.paidAt ? `Payée le ${dateLongue(invoice.paidAt)}` : invoice.dueDate ? `Échéance : ${dateLongue(invoice.dueDate)}` : "", devis]
  });

  const tauxTxt = `TVA ${String(Math.round(taux * 1000) / 10).replace(".", ",")} %`;
  if (sit) {
    tableauPro(canvas, {
      colonnes: [{ titre: "N°", largeur: 28 }, { titre: "Lot", largeur: 220 }, { titre: "Marché HT", largeur: 90, droite: true }, { titre: "Avancement", largeur: 80, droite: true }, { titre: "Dû HT", largeur: 90, droite: true }],
      lignes: (sit.lignes || []).map((l, i) => ({ cellules: [String(i + 1).padStart(2, "0"), fixText(l.nom || "Lot"), nombreFr(l.ht), `${l.pct} %`, nombreFr(l.montant)] }))
    });
    totauxPro(canvas, {
      lignes: [
        { label: "Travaux réalisés à ce jour HT", valeur: money(sit.cumuleHt) },
        { label: "Déjà facturé", valeur: `− ${money(sit.dejaFactureHt)}` },
        ...(sit.retenueHt ? [{ label: `Retenue de garantie ${String(sit.tauxRetenue).replace(".", ",")} %`, valeur: `− ${money(sit.retenueHt)}` }] : []),
        { label: "Net HT", valeur: money(sit.ht) },
        { label: tauxTxt, valeur: money(sit.tva) }
      ],
      grand: { label: "À payer TTC", valeur: money(invoice.amountTtc) }
    });
  } else {
    const ttc = Number(invoice.amountTtc || 0);
    const ht = Math.round((ttc / (1 + taux)) * 100) / 100;
    const libelle = `${fixText(invoice.type || "Facture")}${Number(invoice.percent) ? ` · ${String(invoice.percent).replace(".", ",")} % du devis` : ""}${invoice.quoteNumber ? ` ${cleanQuoteNumber(invoice.quoteNumber)}` : ""}`;
    tableauPro(canvas, {
      colonnes: [{ titre: "N°", largeur: 28 }, { titre: "Désignation", largeur: 380 }, { titre: "Total HT", largeur: 100, droite: true }],
      lignes: [{ cellules: ["01", libelle, money(ht)] }]
    });
    totauxPro(canvas, {
      lignes: [{ label: "Total HT", valeur: money(ht) }, { label: tauxTxt, valeur: money(Math.round((ttc - ht) * 100) / 100) }],
      grand: { label: "À payer TTC", valeur: money(ttc) }
    });
    if (Number(invoice.totalQuoteTtc)) mentionsPro(canvas, [{ titre: "Suivi du marché :", texte: `devis ${money(invoice.totalQuoteTtc)} TTC · déjà facturé avant cette facture ${money(invoice.alreadyInvoicedBefore)} · reste après cette facture ${money(invoice.remainingAfter)}.` }]);
  }
  const paragraphes = paiementFacture(company, invoice, Boolean(sit?.retenueHt));
  if (quote) for (const m of mentionsTvaDocument(quote, taux)) paragraphes.push({ titre: m.titre ? `${m.titre} :` : "", texte: m.texte });
  mentionsPro(canvas, paragraphes);
  return piedFacture(canvas, invoice);
}

// Reçu de paiement (maquette PRO-06.3) : pas une facture (pas de numéro de
// la série), mentionne la facture réglée, le paiement et le solde restant.
const MOYENS_RECU = { virement: "Virement", carte: "Carte", cheque: "Chèque", especes: "Espèces" };
export function buildRecuPdf({ invoice, paiement, resteFacture = 0, resteChantier = null, quote, project, db }) {
  const canvas = new PdfCanvas();
  const company = quote ? companyFromQuote(quote, db) : companyFromDb(db, invoice.userId);
  enTetePro(canvas, { company, kicker: "Reçu de paiement", titre: `Facture ${fixText(invoice.invoiceNumber || "—")}`, lignes: [`Paiement reçu le ${dateLongue(paiement.date)}`] });
  blocPartie(canvas, { kicker: "Client", nom: invoice.client || "Client", lignes: [fixText(quote?.clientAddress || project?.address || "")] });
  tableauPro(canvas, {
    colonnes: [{ titre: "Paiement", largeur: 200 }, { titre: "Détail", largeur: 300, droite: true }],
    lignes: [
      ["Facture réglée", `${fixText(invoice.invoiceNumber || "—")} du ${dateCourte(invoice.issuedAt || invoice.createdAt) || "—"}`],
      ["Montant de la facture", money(invoice.amountTtc)],
      ["Moyen de paiement", MOYENS_RECU[paiement.moyen] || "—"],
      ["Référence", fixText(paiement.reference || "—")],
      ["Chantier", fixText(invoice.projectTitle || project?.title || "—")]
    ].map((c) => ({ cellules: c }))
  });
  totauxPro(canvas, {
    lignes: [{ label: "Reste dû sur la facture", valeur: money(resteFacture) }, ...(resteChantier !== null ? [{ label: "Reste sur le chantier", valeur: money(resteChantier) }] : [])],
    grand: { label: "Montant reçu", valeur: money(paiement.amount) }
  });
  mentionsPro(canvas, [{ texte: "Ce reçu atteste un paiement ; il ne remplace pas la facture." }]);
  return createPdf(piedsPro(canvas.pages, (i, n) => `Reçu · facture ${fixText(invoice.invoiceNumber || "")} · page ${i} / ${n}`), canvas.images);
}

export function recuFilename(invoice, paiement) {
  return `Recu_${String(invoice.invoiceNumber || "facture").replace(/[^A-Za-z0-9_-]+/g, "_")}_${String(paiement.date || "").replace(/-/g, "")}.pdf`;
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
    canvas.rect(TABLE.x, canvas.y, TABLE.width, 28, { fill: "#F1F1EC", stroke: "#E6E6E1" });
    canvas.text(TABLE.x + 10, canvas.y + 19, group.room, { size: 10, bold: true, fill: "#171B1E" });
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
        canvas.text(TABLE.x + 18, canvas.y + 20 + labelLines.length * 12 + index * 10, line, { size: 7.6, fill: "#5B5F66" });
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
    canvas.text(TABLE.x + 10, canvas.y + 16, `Sous-total ${group.room}`, { size: 8.2, bold: true, fill: "#5B5F66" });
    canvas.text(TABLE.x + TABLE.width - 88, canvas.y + 16, money(subtotal), { size: 8.2, bold: true });
    canvas.y += 30;
  });
}

function drawAvenantTotals(canvas, avenant, quote) {
  const width = 236;
  const totalsX = PAGE_WIDTH - MARGIN - width;
  canvas.ensure(160);
  canvas.rect(totalsX, canvas.y, width, 92, { fill: "#ffffff", stroke: LINE });
  canvas.text(totalsX + 14, canvas.y + 24, "Total HT (delta)", { size: 9, fill: "#5B5F66" });
  canvas.text(totalsX + 150, canvas.y + 24, money(avenant.totalHtDelta), { size: 9.5, bold: true });
  const vatAmount = Number(avenant.totalTtcDelta || 0) - Number(avenant.totalHtDelta || 0);
  canvas.text(totalsX + 14, canvas.y + 46, `TVA ${Number(avenant.vatRate || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%`, { size: 9, fill: "#5B5F66" });
  canvas.text(totalsX + 150, canvas.y + 46, money(vatAmount), { size: 9.5, bold: true });
  canvas.rect(totalsX, canvas.y + 62, width, 30, { fill: NAVY, stroke: NAVY });
  canvas.text(totalsX + 14, canvas.y + 82, "Total TTC (delta)", { size: 10, bold: true, fill: "#ffffff" });
  canvas.text(totalsX + 134, canvas.y + 82, money(avenant.totalTtcDelta), { size: 10.5, bold: true, fill: GOLD });
  canvas.y += 108;

  const newMarketTotal = Number(quote?.totalTtc || 0) + Number(avenant.totalTtcDelta || 0);
  canvas.rect(MARGIN, canvas.y, PAGE_WIDTH - MARGIN * 2, 46, { fill: "#F1F1EC", stroke: "#E6E6E1" });
  canvas.text(MARGIN + 14, canvas.y + 18, "Nouveau total du marché (devis + cet avenant)", { size: 9.5, fill: "#171B1E" });
  canvas.text(MARGIN + 14, canvas.y + 34, money(newMarketTotal), { size: 12, bold: true, fill: "#171B1E" });
  canvas.y += 62;
}

function drawAvenantLegalMentions(canvas) {
  const lines = AVENANT_LEGAL_TEXT.flatMap((paragraph) => [...wrapText(paragraph, 100), ""]);
  const height = Math.max(30, 20 + lines.length * 11);
  canvas.ensure(height + 10);
  canvas.text(MARGIN, canvas.y + 14, "Mentions légales", { size: 9.5, bold: true, fill: "#5B5F66" });
  lines.forEach((line, index) => {
    if (line) canvas.text(MARGIN, canvas.y + 30 + index * 11, line, { size: 7.6, fill: "#5B5F66" });
  });
  canvas.y += height + 16;
}

function drawAvenantSignature(canvas, avenant) {
  canvas.ensure(84);
  const signatureX = PAGE_WIDTH - MARGIN - 250;
  if (avenant.status === "Signe") {
    canvas.text(signatureX, canvas.y + 12, `Accepté manuellement le ${formatDate(avenant.signedAt)} par ${fixText(avenant.signerName || avenant.client || "le client")}.`, { size: 9.5, fill: "#5B5F66" });
    canvas.y += 18;
  } else {
    canvas.text(signatureX, canvas.y + 12, "Bon pour accord", { size: 10, fill: "#5B5F66" });
    canvas.text(signatureX, canvas.y + 28, "Date et signature du client :", { size: 9, fill: "#5B5F66" });
    canvas.line(signatureX, canvas.y + 58, PAGE_WIDTH - MARGIN, canvas.y + 58, LINE);
    canvas.line(signatureX, canvas.y + 76, PAGE_WIDTH - MARGIN, canvas.y + 76, LINE);
  }
}

export function buildAvenantPdf({ avenant, quote, db }) {
  // Avenant au gabarit Pro (PRO-25) : mêmes en-tête, tableau, totaux,
  // mentions et cases de signature que le devis.
  const canvas = new PdfCanvas();
  const company = quote ? companyFromQuote(quote, db) : companyFromDb(db, avenant.userId);
  const devis = cleanQuoteNumber(avenant.quoteNumber || quote?.quoteNumber || "");
  enTetePro(canvas, {
    company,
    kicker: "Avenant",
    titre: `N° ${fixText(avenant.numero || "—")}`,
    lignes: [avenant.createdAt ? `Date : ${dateLongue(avenant.createdAt)}` : "", devis ? `Au devis ${devis}` : ""]
  });
  const adresse = fixText(avenant.chantierAddress || quote?.chantierAddress || quote?.clientAddress || "");
  blocPartie(canvas, { kicker: "Client", nom: avenant.client || quote?.client || "Client", lignes: [adresse ? `Chantier : ${adresse}` : ""] });
  if (avenant.motif) mentionsPro(canvas, [{ titre: "Motif :", texte: fixText(avenant.motif) }]);

  const lignes = [];
  let n = 0;
  const groupes = groupAvenantLignesByRoom(fixObjectText(avenant.lignes || []));
  for (const g of groupes) {
    if (groupes.length > 1) lignes.push({ groupe: g.room });
    for (const l of g.lignes) {
      n += 1;
      lignes.push({
        cellules: [
          String(n).padStart(2, "0"),
          { texte: `${avenantTypeLabel(l.type)} · ${fixText(l.label || "Ligne")}`, details: l.note ? [fixText(l.note)] : [] },
          Number(l.quantity || 0).toLocaleString("fr-FR"),
          fixText(l.unit || "u"),
          nombreFr(Number(l.unitPriceHt || 0)),
          nombreFr(Number(l.totalHt || 0))
        ]
      });
    }
  }
  if (lignes.length) {
    tableauPro(canvas, {
      colonnes: [{ titre: "N°", largeur: 28 }, { titre: "Désignation", largeur: 250 }, { titre: "Qté", largeur: 42, droite: true }, { titre: "U", largeur: 34, droite: true }, { titre: "PU HT", largeur: 70, droite: true }, { titre: "Total HT", largeur: 78, droite: true }],
      lignes
    });
  } else {
    mentionsPro(canvas, [{ texte: "Aucune ligne pour cet avenant." }]);
  }
  const tva = Number(avenant.totalTtcDelta || 0) - Number(avenant.totalHtDelta || 0);
  const nouveau = Number(quote?.totalTtc || 0) + Number(avenant.totalTtcDelta || 0);
  totauxPro(canvas, {
    lignes: [{ label: "Total HT de l'avenant", valeur: money(avenant.totalHtDelta) }, { label: `TVA ${Number(avenant.vatRate || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`, valeur: money(tva) }],
    grand: { label: "Total TTC de l'avenant", valeur: money(avenant.totalTtcDelta) },
    note: quote?.totalTtc ? `Nouveau total du marché (devis + cet avenant) : ${money(nouveau)} TTC` : ""
  });
  mentionsPro(canvas, AVENANT_LEGAL_TEXT.map((t, i) => ({ titre: i === 0 ? "Mentions :" : "", texte: t })));
  const signe = avenant.status === "Signe";
  signaturesPro(canvas, [
    { label: "Pour l'entreprise", texte: `${fixText(company.dirigeant || company.name)}${avenant.createdAt ? ` · ${dateCourte(avenant.createdAt)}` : ""}` },
    { label: "Bon pour accord · le client", texte: signe ? `Accepté le ${dateCourte(avenant.signedAt)} par ${fixText(avenant.signerName || avenant.client || "le client")}` : "Date et signature, précédées de « bon pour accord »" }
  ]);
  return createPdf(piedsPro(canvas.pages, (i, n2) => `Avenant ${fixText(avenant.numero || "")}${devis ? ` au devis ${devis}` : ""} · page ${i} / ${n2}`), canvas.images);
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
  canvas.text(MARGIN + 14, canvas.y + 22, "RELEVÉ D'HEURES", { size: 10, bold: true, fill: "#5B5F66" });
  rows.forEach((row, index) => {
    const y = canvas.y + 44 + index * rowHeight;
    canvas.text(MARGIN + 16, y, row[0], { size: 9.5, fill: "#5B5F66" });
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
    canvas.text(MARGIN + 12, canvas.y + 15, `Total heures semaine ${weekKey.replace("-W", " - S")}`, { size: 9, bold: true, fill: "#5B5F66" });
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
    canvas.text(PAGE_WIDTH - MARGIN - 90, canvas.y + 16, entry.source === "worker" ? "Ouvrier" : "Entreprise", { size: 8.5, fill: "#5B5F66" });
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
    canvas.text(MARGIN, canvas.y, `Reference contractuelle sur la periode: ${formatMinutesFr(expected)} (${diff >= 0 ? "+" : "-"}${formatMinutesFr(Math.abs(diff))})`, { size: 9, fill: "#5B5F66" });
    canvas.y += 20;
  }
}

function formatMinutesFr(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
}

function addWorkerHoursPdfFooters(pages, { worker, month }) {
  return piedsPro(pages, (i, n) => [`Relevé d'heures`, fixText(worker.name || worker.loginId || ""), fixText(month || ""), `page ${i} / ${n}`].filter(Boolean).join(" · "));
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
  if (addressLine) canvas.text(textX, canvas.y + (hasLogo ? 34 : 44), addressLine, { size: 9, fill: "#5B5F66" });
  if (contactLine) canvas.text(textX, canvas.y + (hasLogo ? 50 : 60), contactLine, { size: 9, fill: "#5B5F66" });
  if (company.siret) canvas.text(textX, canvas.y + (hasLogo ? 66 : 76), `SIRET : ${company.siret}`, { size: 9, fill: "#5B5F66" });

  // "RAPPORT D'INTERVENTION" now leads, top-right, alongside the auto-generated
  // reference number and creation date — same footprint as the devis/facture
  // tan reference box (drawHeader), sized for the longer French caption.
  const boxW = 190;
  const boxH = 78;
  const boxX = PAGE_WIDTH - MARGIN - boxW;
  canvas.rect(boxX, canvas.y, boxW, boxH, { fill: "#F1F1EC", stroke: "#E6E6E1" });
  canvas.text(boxX + 14, canvas.y + 20, "RAPPORT D'INTERVENTION", { size: 8.2, bold: true, fill: "#5B5F66" });
  canvas.text(boxX + 14, canvas.y + 42, `N° ${intervention.reference || "-"}`, { size: 12.5, bold: true, fill: NAVY });
  canvas.text(boxX + 14, canvas.y + 62, `Créé le ${formatDate(intervention.createdAt)}`, { size: 8.2, fill: "#5B5F66" });

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
  canvas.text(x, canvas.y, "Signature", { size: 9, bold: true, fill: "#5B5F66" });
  canvas.y += 16;
  if (hasImage) {
    canvas.image(x, canvas.y, boxW, 64, intervention.signatureImageDataUrl);
    canvas.y += 70;
  } else {
    canvas.text(x, canvas.y, fixText(intervention.signature || company.name || "-"), { size: 11, bold: true });
    canvas.y += 30;
  }
}

function addInterventionPdfFooters(pages, { intervention }) {
  return piedsPro(pages, (i, n) => ["Intervention", fixText(intervention.client || ""), dateCourte(intervention.date || new Date().toISOString()), `page ${i} / ${n}`].filter(Boolean).join(" · "));
}

export function buildInterventionPdf({ intervention, db }) {
  // Rapport d'intervention au gabarit Pro (PRO-25).
  const canvas = new PdfCanvas();
  const company = companyFromIntervention(intervention, db);
  enTetePro(canvas, {
    company,
    kicker: "Rapport d'intervention",
    titre: `N° ${fixText(intervention.reference || "—")}`,
    lignes: [intervention.date ? `Date : ${dateLongue(intervention.date)}` : "", intervention.createdAt ? `Créé le ${dateCourte(intervention.createdAt)}` : ""]
  });
  blocPartie(canvas, { kicker: "Client", nom: intervention.client || "Client", lignes: [intervention.site ? `Site : ${fixText(intervention.site)}` : "", intervention.equipement ? `Équipement : ${fixText(intervention.equipement)}` : ""] });
  for (const [titre, texte] of [["Constat", intervention.constat], ["Analyse", intervention.analyse], ["Préconisations", intervention.preconisations]]) {
    if (!String(texte || "").trim()) continue;
    titreSection(canvas, titre);
    mentionsPro(canvas, String(texte).split("\n").map((p) => p.trim()).filter(Boolean).map((p) => ({ texte: p })));
  }
  signaturesPro(canvas, [
    { label: "Pour l'entreprise", image: intervention.signatureImageDataUrl, texte: fixText(intervention.signature || intervention.entreprise || company.name || "") },
    null
  ]);
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

// Procès-verbal de réception (maquette PRO-25, gabarit A4 Pro) : réserves en
// tableau, levées, retenue de garantie, point de départ des garanties,
// documents remis, signatures.
export function buildPvReceptionPdf({ pv, chantier = {}, quote = null, db, userId }) {
  const canvas = new PdfCanvas();
  const company = quote ? companyFromQuote(quote, db) : companyFromDb(db, userId);
  const avenants = (pv.avenants || []).length ? ` · avenant${pv.avenants.length > 1 ? "s" : ""} ${pv.avenants.join(", ")}` : "";
  const devis = `Devis ${cleanQuoteNumber(pv.devisNumero || "")}${quote?.versionNumber > 1 ? ` v${Number(quote.versionNumber)}` : ""}`;
  enTetePro(canvas, {
    company,
    kicker: "Procès-verbal de réception",
    titre: fixText(chantier.titre ? `Chantier ${chantier.titre}` : "Réception des travaux"),
    lignes: [`Date : ${dateLongue(pv.signeLe)}`, `${devis}${avenants}`, "En présence du client et de l'entreprise"]
  });
  const adresse = fixText(quote?.clientAddress || "");
  const lieu = fixText(chantier.adresse || quote?.chantierAddress || "");
  blocPartie(canvas, { kicker: "Client", nom: pv.signataire || quote?.client || "Client", lignes: [adresse || lieu, adresse && lieu && lieu !== adresse ? `Chantier : ${lieu}` : lieu ? "Chantier : même adresse" : ""] });

  titreSection(canvas, "Réception des travaux");
  const reserves = pv.reserves || [];
  const decrits = `au devis ${cleanQuoteNumber(pv.devisNumero || "")}${quote?.versionNumber > 1 ? ` version ${Number(quote.versionNumber)}` : ""}${(pv.avenants || []).length ? " et à ses avenants" : ""}`;
  mentionsPro(canvas, [{ texte: reserves.length ? `Le client déclare réceptionner les travaux décrits ${decrits}, avec les réserves suivantes :` : `Le client déclare réceptionner sans réserve les travaux décrits ${decrits}.` }]);
  if (reserves.length) {
    tableauPro(canvas, {
      colonnes: [{ titre: "N°", largeur: 34 }, { titre: "Réserve", largeur: 260 }, { titre: "Par", largeur: 130 }, { titre: "Avant le", largeur: 84, droite: true }],
      lignes: reserves.map((r) => ({ cellules: [fixText(r.numero), fixText([r.titre, r.lieu].filter(Boolean).join(" · ")), fixText(r.attribueeNom || "à attribuer"), r.pourLe ? dateCourte(r.pourLe) : "—"] }))
    });
  }
  const paragraphes = [];
  if ((pv.levees || []).length) paragraphes.push({ texte: `${reserves.length ? "Les autres réserves" : "Les réserves relevées pendant le chantier"} (${pv.levees.join(", ")}) ont été levées avant ce jour.` });
  if (pv.retenue?.taux) paragraphes.push({ texte: `La retenue de garantie de ${pv.retenue.taux} % (${money(pv.retenue.montantTtc)} TTC) sera restituée à la levée des réserves, au plus tard un an après la date de ce procès-verbal (loi n° 71-584 du 16 juillet 1971).` });
  paragraphes.push({ texte: "Le point de départ des garanties légales est la date de ce procès-verbal : parfait achèvement (1 an), bon fonctionnement des équipements (2 ans), garantie décennale (10 ans), articles 1792 à 1792-6 du Code civil." });
  const remis = Array.isArray(pv.documentsRemis) ? pv.documentsRemis.map(fixText).filter(Boolean) : [];
  if (remis.length) paragraphes.push({ titre: "Documents remis :", texte: `${remis.join(", ")}.` });
  mentionsPro(canvas, paragraphes);

  signaturesPro(canvas, [
    { label: "L'entreprise", image: pv.signaturePro, texte: `${fixText(pv.entreprise || company.dirigeant || company.name || "Entreprise")} · ${dateCourte(pv.signeLe)}` },
    { label: "Le client", image: pv.signatureClient, texte: pv.signatureClient ? `${fixText(pv.signataire || "")} · signé sur place le ${dateHeure(pv.signeLe)}` : "Date et signature" }
  ]);
  return createPdf(piedsPro(canvas.pages, (i, n) => `PV de réception${pv.numero ? ` ${fixText(pv.numero)}` : ""} · page ${i} / ${n}`), canvas.images);
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

// Feuille de chantier (maquette PRO-02.7, « Imprimer la liste ») : les
// tâches par lot avec une case à cocher, pour les compagnons sans téléphone.
export function buildFeuilleChantierPdf({ chantier = {}, lots = [], devis = null, db, userId, imprimeLe = new Date() }) {
  const canvas = new PdfCanvas();
  const company = devis ? companyFromQuote(devis, db) : companyFromDb(db, userId);
  const width = PAGE_WIDTH - MARGIN * 2;
  canvas.text(MARGIN, canvas.y + 4, "FEUILLE DE CHANTIER", { size: 8.5, bold: true, fill: GREY });
  canvas.text(MARGIN, canvas.y + 26, fixText(chantier.titre || "Chantier"), { size: 18, bold: true, fill: INK });
  const sous = [chantier.adresse, `imprimée le ${pvDate(imprimeLe)}`].filter(Boolean).map(fixText).join(" · ");
  canvas.text(MARGIN, canvas.y + 44, sous, { size: 9, fill: GREY });
  canvas.y += 64;
  if (!lots.length) pvParagraph(canvas, "Aucune tâche sur ce chantier.");
  lots.forEach((lot) => {
    canvas.ensure(54);
    canvas.rect(MARGIN, canvas.y, width, 24, { fill: INK, stroke: INK });
    canvas.text(MARGIN + 10, canvas.y + 16, fixText(lot.titre), { size: 10, bold: true, fill: "#FFFFFF" });
    canvas.text(PAGE_WIDTH - MARGIN - 90, canvas.y + 16, `${lot.faites} / ${lot.taches.length} faites`, { size: 8.5, fill: "#C4C8CD" });
    canvas.y += 24;
    lot.taches.forEach((t) => {
      const lignes = wrapText(fixText(t.label), 62);
      const h = Math.max(34, 14 + lignes.length * 12 + 12);
      canvas.ensure(h);
      canvas.rect(MARGIN, canvas.y, width, h, { fill: "#FFFFFF", stroke: "#DCDCD6" });
      canvas.rect(MARGIN + 10, canvas.y + 10, 12, 12, { fill: t.fait ? INK : "#FFFFFF", stroke: INK, width: 1.2 });
      lignes.forEach((l, i) => canvas.text(MARGIN + 32, canvas.y + 19 + i * 12, l, { size: 9.6, bold: true, fill: INK }));
      canvas.text(MARGIN + 32, canvas.y + 19 + lignes.length * 12, fixText(t.ligne), { size: 8.2, fill: GREY });
      canvas.line(PAGE_WIDTH - MARGIN - 150, canvas.y + h - 10, PAGE_WIDTH - MARGIN - 10, canvas.y + h - 10, "#CFCFC9", 0.8);
      canvas.text(PAGE_WIDTH - MARGIN - 150, canvas.y + h - 14, "Note", { size: 7, fill: "#A3A39D" });
      canvas.y += h;
    });
    canvas.y += 14;
  });
  return createPdf(addPdfFooters(canvas.pages, {
    company,
    quoteNumber: devis?.quoteNumber || "",
    generatedAt: imprimeLe,
    quote: { ...(devis || {}), quoteDate: imprimeLe.toISOString(), chantierAddress: chantier.adresse || devis?.chantierAddress },
    project: {},
    documentLabel: "Feuille de chantier",
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


// Bon de commande fournisseur (maquette PRO-07.6, et PRO-07.3 pour un
// partenaire Koji : numéro Koji et code partenaire). L'entreprise est
// passée telle que lue sur son profil vérifié.
// Bon de commande fournisseur (maquette PRO-25 sur PRO-07.6, et PRO-07.3
// pour un partenaire Koji : numéro Koji et code partenaire) : fournisseur,
// livraison, lignes avec références, totaux, conditions.
export function buildBonCommandePdf({ bon, company, chantier = {} }) {
  const canvas = new PdfCanvas();
  const livraison = bon.livraisonLe ? `${dateLongue(bon.livraisonLe)}${bon.livraisonHeure ? ` avant ${fixText(bon.livraisonHeure)}` : ""}` : "";
  enTetePro(canvas, {
    company,
    kicker: "Bon de commande",
    titre: `N° ${fixText(bon.numero || "—")}`,
    lignes: [
      `Date : ${dateLongue(bon.envoyeLe || bon.createdAt || new Date().toISOString())}`,
      livraison ? `Livraison : ${livraison}` : "",
      chantier.titre ? `Chantier : ${fixText(chantier.titre)}${bon.lot ? ` · ${fixText(bon.lot)}` : ""}` : ""
    ]
  });
  blocPartie(canvas, {
    kicker: "Fournisseur",
    nom: bon.supplierName || "Fournisseur",
    lignes: [
      [bon.supplierAddress, bon.supplierEmail].map(fixText).filter(Boolean).join(" · "),
      [bon.compteFournisseur ? `Compte client ${fixText(bon.compteFournisseur)}` : "", `livraison ${bon.livraisonAdresse || chantier.adresse ? `sur chantier : ${fixText(bon.livraisonAdresse || chantier.adresse)}` : "à convenir"}`].filter(Boolean).join(" · "),
      bon.numeroKoji ? `Commande émise depuis Koji · ${fixText(bon.numeroKoji)} · code partenaire ${fixText(bon.codePartenaire || "")}` : ""
    ]
  });

  let ht = 0;
  const lignes = (bon.lignes || []).map((l, i) => {
    const total = Math.round(Number(l.quantite || 0) * Number(l.prixHt || 0) * 100) / 100;
    ht += total;
    const cond = Number(l.paquets) > 0 && l.uniteCond && Number(l.contenance) !== 1 ? `${l.paquets} ${fixText(l.uniteCond)}${l.paquets > 1 && !/s$/.test(l.uniteCond) ? "s" : ""}` : "";
    return {
      cellules: [
        String(i + 1),
        { texte: `${fixText(l.name || "")}${l.ref ? ` · réf. ${fixText(l.ref)}` : ""}`, details: cond ? [cond] : [] },
        String(l.quantite ?? "").replace(".", ","),
        fixText(l.unit || "u"),
        money(l.prixHt).replace(/\s?€$/, ""),
        money(total).replace(/\s?€$/, "")
      ]
    };
  });
  tableauPro(canvas, {
    colonnes: [{ titre: "N°", largeur: 24 }, { titre: "Désignation", largeur: 262 }, { titre: "Qté", largeur: 42, droite: true }, { titre: "U", largeur: 34, droite: true }, { titre: "PU HT", largeur: 68, droite: true }, { titre: "Total HT", largeur: 78, droite: true }],
    lignes
  });
  ht = Math.round(ht * 100) / 100;
  const tva = Math.round(ht * 0.2 * 100) / 100;
  totauxPro(canvas, { lignes: [{ label: `Total HT${bon.numeroKoji ? " · prix Koji" : ""}`, valeur: money(ht) }, { label: "TVA 20 %", valeur: money(tva) }], grand: { label: "Total TTC", valeur: money(ht + tva) } });
  mentionsPro(canvas, [{
    texte: [
      "Conditions générales de vente du fournisseur applicables.",
      `Merci d'indiquer le numéro ${fixText(bon.numeroKoji || bon.numero || "")} sur le bon de livraison et la facture.`,
      bon.contactChantier ? `Contact chantier : ${fixText(bon.contactChantier)}.` : "",
      bon.numeroKoji && bon.validitePrix ? `Prix Koji de la mercuriale valables jusqu'au ${dateCourte(bon.validitePrix)}.` : "",
      fixText(bon.notes || "")
    ].filter(Boolean).join(" ")
  }]);
  signaturesPro(canvas, [{ label: "Pour l'entreprise", texte: `${fixText(company.dirigeant || company.name || "")} · ${dateCourte(bon.envoyeLe || bon.createdAt || new Date().toISOString())}` }, null]);
  return createPdf(piedsPro(canvas.pages, (i, n) => `Bon de commande ${fixText(bon.numero || "")} · page ${i} / ${n}`), canvas.images);
}

export function bonCommandeFilename(bon) {
  return `Bon_de_commande_${sanitizeFilename(bon.numero || "BC")}.pdf`;
}

// Identité de l'entreprise pour un document, depuis son profil vérifié.
export function companyFromWebUser(webUser = {}) {
  const b = webUser.business || {};
  return {
    name: fixText(b.raisonSociale || webUser.name || "Entreprise"),
    addressLine1: fixText(b.addressLine1 || b.address || ""),
    addressLine2: fixText(b.addressLine2 || ""),
    email: fixText(b.emailPro || webUser.email || ""),
    phone: fixText(b.phone || ""),
    siret: fixText(b.siret || ""),
    rcs: fixText(b.rcs || b.siren || ""),
    siren: fixText(b.siren || ""),
    tva: fixText(b.tva || ""),
    legalForm: fixText(b.legalForm || b.formeJuridique || ""),
    capital: fixText(b.capital || ""),
    logoDataUrl: fixText(b.logoDataUrl || ""),
    city: fixText(b.city || ""),
    iban: "",
    bankHolder: "",
    bic: "",
    legalMentions: fixText(b.legalMentions || ""),
    paymentTerms: "",
    dirigeant: fixText(webUser.name && webUser.name !== b.raisonSociale ? webUser.name : ""),
    decennale: shared.decennaleEntreprise(b)
  };
}

// Relevé du mois pour le comptable (maquette PRO-09.4) : synthèse, puis
// achats rangés par chantier (« un dossier par chantier »), ventes et
// encaissements. Montants de TVA indicatifs.
export function buildReleveComptablePdf({ company, synthese }) {
  const canvas = new PdfCanvas();
  drawHeader(canvas, { quoteNumber: synthese.libelle }, company, "RELEVÉ COMPTABLE");
  const pl = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
  const t = synthese.totaux;
  const ligne = (cols, { bold = false, size = 9, fill = "#111827" } = {}) => {
    canvas.ensure(16);
    cols.forEach(([x, v, right]) => {
      const s = fixText(String(v ?? ""));
      canvas.text(right ? x - Math.min(110, s.length * size * 0.5) : x, canvas.y + 10, s, { size, bold, fill });
    });
    canvas.y += 15;
  };
  const titre = (s) => { canvas.ensure(40); canvas.y += 10; canvas.text(MARGIN, canvas.y + 12, s, { size: 11, bold: true, fill: "#5B5F66" }); canvas.y += 22; };
  const R = PAGE_WIDTH - MARGIN;
  titre("SYNTHÈSE");
  ligne([[MARGIN, "Ventes"], [MARGIN + 150, `${pl(t.ventes.factures, "facture")}, ${pl(t.ventes.avoirs, "avoir")}`], [R - 120, money(t.ventes.ht), true], [R, money(t.ventes.tva), true]]);
  ligne([[MARGIN, "Achats"], [MARGIN + 150, `${pl(t.achats.factures, "facture")}, ${pl(t.achats.tickets, "ticket")}`], [R - 120, money(t.achats.ht), true], [R, money(t.achats.tva), true]]);
  ligne([[MARGIN, "Encaissements"], [MARGIN + 150, pl(t.encaissements.nombre, "paiement")], [R - 120, money(t.encaissements.ttc), true], [R, "-", true]]);
  ligne([[R - 120, "HT / TTC", true], [R, "TVA", true]], { size: 8, fill: "#5B5F66" });
  canvas.y += 4;
  ligne([[MARGIN, "TVA collectée"], [R, money(synthese.tva.collectee), true]]);
  ligne([[MARGIN, "TVA déductible"], [R, money(synthese.tva.deductible), true]]);
  ligne([[MARGIN, "Solde indicatif, à confirmer par votre comptable"], [R, money(synthese.tva.solde), true]], { bold: true });
  if (t.achats.autoliquidees) ligne([[MARGIN, `Dont ${t.achats.autoliquidees} facture(s) en autoliquidation (sous-traitance) : ${money(t.achats.autoliquideesHt)} HT, TVA due par l'entreprise`]], { size: 8.5, fill: "#5B5F66" });

  const parChantier = new Map();
  for (const a of synthese.achats) {
    const k = a.chantier || "Sans chantier";
    if (!parChantier.has(k)) parChantier.set(k, []);
    parChantier.get(k).push(a);
  }
  titre("ACHATS, PAR CHANTIER");
  for (const [chantier, liste] of [...parChantier.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    canvas.y += 4;
    ligne([[MARGIN, chantier], [R, money(liste.reduce((s, x) => s + x.ht, 0)), true]], { bold: true, size: 9.5 });
    for (const a of liste) {
      ligne([[MARGIN + 8, formatDate(a.date) || a.date], [MARGIN + 80, `${a.fournisseur}${a.numero ? ` · ${a.numero}` : ""}${a.justificatif ? "" : " · sans justificatif"}${a.tvaEstimee ? " · TVA estimée" : ""}`.slice(0, 70)], [R - 120, money(a.ht), true], [R, a.taux === "autoliquidation" ? "autoliq." : money(a.tva), true]], { size: 8.5 });
    }
  }
  if (!synthese.achats.length) ligne([[MARGIN, "Aucune pièce rangée sur la période."]], { size: 9, fill: "#5B5F66" });
  titre("VENTES");
  for (const v of synthese.ventes) ligne([[MARGIN, formatDate(v.date) || v.date], [MARGIN + 72, `${v.numero} · ${v.client || ""}`.slice(0, 60)], [R - 120, money(v.ht), true], [R, money(v.tva), true]], { size: 8.5 });
  if (!synthese.ventes.length) ligne([[MARGIN, "Aucune facture émise sur la période."]], { size: 9, fill: "#5B5F66" });
  titre("ENCAISSEMENTS");
  for (const e of synthese.encaissements) ligne([[MARGIN, formatDate(e.date) || e.date], [MARGIN + 72, `${e.numero} · ${e.moyen}${e.reference ? ` · ${e.reference}` : ""}`.slice(0, 60)], [R, money(e.montant), true]], { size: 8.5 });
  if (!synthese.encaissements.length) ligne([[MARGIN, "Aucun paiement reçu sur la période."]], { size: 9, fill: "#5B5F66" });
  canvas.y += 10;
  wrapText("Koji range et transmet les pièces. Il ne tient pas la comptabilité et ne produit ni liasse ni FEC. Les montants de TVA sont indicatifs.", 100).forEach((s) => { canvas.ensure(14); canvas.text(MARGIN, canvas.y, s, { size: 8.5, fill: "#5B5F66" }); canvas.y += 12; });
  return createPdf(addPdfFooters(canvas.pages, { company, quoteNumber: synthese.libelle, generatedAt: new Date(), quote: { quoteDate: new Date().toISOString() }, project: {}, documentLabel: "Relevé pour le comptable", showVersion: false }), canvas.images);
}

export function releveFilename(periode) {
  return `Releve_comptable_${sanitizeFilename(periode || "periode")}.pdf`;
}

// Carte de visite KojiPage (maquette PRO-13.4) : modèle Koji unique, 85 × 55
// mm. Recto : identité et coordonnées ; verso : bandeau à la couleur de la
// KojiPage, QR code vers la page, sceau seulement si les vérifications sont
// à jour. Formats : carte (recto + verso), planche A4 de 10 cartes recto
// avec traits de coupe, fichier imprimeur avec fonds perdus de 3 mm.
const MM = 2.83465;
function dessinerRectoCarte(canvas, ox, oy, carte, { couleur, logo, bleed = 0 }) {
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  canvas.rect(ox - bleed, oy - bleed, W + bleed * 2, H + bleed * 2, { fill: "#ffffff", stroke: null });
  canvas.rect(ox - bleed, oy - bleed, W + bleed * 2, 5 + bleed, { fill: couleur, stroke: null });
  const x = ox + 16;
  const mots = fixText(carte.nom || "K").split(/\s+/).filter(Boolean);
  const initiales = (/^[A-Z]{2,}$/.test(mots[0] || "") ? mots[0].slice(0, 2) : mots.slice(0, 2).map((m) => m[0]).join("")).toUpperCase();
  if (logo) canvas.image(x, oy + 16, 22, 22, logo);
  else {
    canvas.rect(x, oy + 16, 22, 22, { fill: couleur, stroke: null });
    canvas.text(x + 4, oy + 31, initiales, { size: 9, bold: true, fill: "#ffffff" });
  }
  if (carte.accroche) canvas.text(x + 30, oy + 30, fixText(carte.accroche).slice(0, 48), { size: 6.5, fill: "#5b6472" });
  canvas.text(x, oy + 62, fixText(carte.nom).slice(0, 30), { size: 14, bold: true, fill: CARD_INK });
  if (carte.personne) canvas.text(x, oy + 75, fixText([carte.personne, carte.fonction].filter(Boolean).join(" · ")).slice(0, 50), { size: 7.5, fill: CARD_INK });
  if (carte.metiers?.length) canvas.text(x, oy + 92, fixText(carte.metiers.join(" · ")).slice(0, 70), { size: 6.2, fill: "#5b6472" });
  let y = oy + 114;
  if (carte.telephone) { canvas.text(x, y, `Tél. ${fixText(carte.telephone)}`, { size: 7.4, fill: CARD_INK }); y += 11; }
  if (carte.email) { canvas.text(x, y, `E-mail ${fixText(carte.email)}`.slice(0, 60), { size: 7.4, fill: CARD_INK }); y += 11; }
  if (carte.adresse && carte.adresseTexte) canvas.text(x, y, fixText(carte.adresseTexte).slice(0, 60), { size: 6.5, fill: "#5b6472" });
}

function dessinerVersoCarte(canvas, ox, oy, carte, { couleur, qr, url, sceau, siret, bleed = 0 }) {
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  canvas.rect(ox - bleed, oy - bleed, W + bleed * 2, H + bleed * 2, { fill: couleur, stroke: null });
  const x = ox + 16;
  canvas.text(x, oy + 30, fixText(carte.nom).slice(0, 30), { size: 11, bold: true, fill: "#ffffff" });
  canvas.wrapped(x, oy + 50, "Nos réalisations, nos avis, votre demande de devis", 26, { size: 7, fill: "#ffffff" });
  canvas.text(x, oy + 96, fixText(url.replace(/^https?:\/\//, "")).slice(0, 40), { size: 6.6, bold: true, fill: "#ffffff" });
  if (sceau) canvas.wrapped(x, oy + 124, `Vérifié par Koji · assurance décennale vérifiée${siret ? ` · SIRET ${siret}` : ""}`, 44, { size: 5.2, fill: "#ffffff" });
  if (qr) {
    const s = 66;
    canvas.rect(ox + W - 16 - s - 4, oy + 22, s + 8, s + 8, { fill: "#ffffff", stroke: null });
    canvas.image(ox + W - 16 - s, oy + 26, s, s, qr);
  }
}

export async function buildCarteKojiPdf({ carte = {}, couleur = "#0B1530", url = "", logo = "", sceau = false, siret = "", format = "carte" }) {
  const qr = carte.qr !== false && url ? await qrDataUrl(`${url}/carte`, { dark: "#0d1b33" }) : "";
  const opts = { couleur, logo: carte.logo !== false || carte.photo ? logo : "", qr, url, sceau, siret };
  if (format === "planche") {
    const canvas = new PdfCanvas(PAGE_WIDTH, PAGE_HEIGHT);
    canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, { fill: "#ffffff", stroke: null });
    const cols = 2;
    const rows = 5;
    const x0 = (PAGE_WIDTH - cols * CARD_WIDTH) / 2;
    const y0 = (PAGE_HEIGHT - rows * CARD_HEIGHT) / 2;
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) dessinerRectoCarte(canvas, x0 + c * CARD_WIDTH, y0 + r * CARD_HEIGHT, carte, opts);
    // Traits de coupe hors des cartes.
    const trait = "#6b7280";
    for (let c = 0; c <= cols; c += 1) {
      const x = x0 + c * CARD_WIDTH;
      canvas.line(x, y0 - 18, x, y0 - 4, trait, 0.4);
      canvas.line(x, y0 + rows * CARD_HEIGHT + 4, x, y0 + rows * CARD_HEIGHT + 18, trait, 0.4);
    }
    for (let r = 0; r <= rows; r += 1) {
      const y = y0 + r * CARD_HEIGHT;
      canvas.line(x0 - 18, y, x0 - 4, y, trait, 0.4);
      canvas.line(x0 + cols * CARD_WIDTH + 4, y, x0 + cols * CARD_WIDTH + 18, y, trait, 0.4);
    }
    return createPdf(canvas.pages, canvas.images, { width: PAGE_WIDTH, height: PAGE_HEIGHT });
  }
  const bleed = format === "imprimeur" ? 3 * MM : 0;
  const w = CARD_WIDTH + bleed * 2;
  const h = CARD_HEIGHT + bleed * 2;
  const canvas = new PdfCanvas(w, h);
  dessinerRectoCarte(canvas, bleed, bleed, carte, { ...opts, bleed });
  canvas.pages.push([]);
  dessinerVersoCarte(canvas, bleed, bleed, carte, { ...opts, bleed });
  return createPdf(canvas.pages, canvas.images, { width: w, height: h });
}

export function carteKojiFilename(nom = "", format = "carte") {
  return `Carte_visite_${sanitizeFilename(nom || "Koji")}${format === "planche" ? "_planche_A4" : format === "imprimeur" ? "_imprimeur" : ""}.pdf`;
}

// Contrat de sous-traitance préparé par Koji (maquette PRO-14.1) : les
// conditions convenues, sans clause juridique rédigée par Koji (modèle à
// faire valider par un avocat), la présentation au client et la garantie
// de paiement à choisir.
export function buildContratSousTraitancePdf({ contrat = {}, company = {}, lignes = [] }) {
  const canvas = new PdfCanvas();
  drawHeader(canvas, { quoteNumber: contrat.numero || "" }, company, "SOUS-TRAITANCE");
  canvas.text(MARGIN, canvas.y + 4, "Conditions de sous-traitance préparées par Koji", { size: 13, bold: true });
  canvas.y += 22;
  canvas.text(MARGIN, canvas.y, "Projet à compléter : les clauses du contrat sont à faire valider par un avocat avant signature.", { size: 8.8, fill: "#9B2C1F" });
  canvas.y += 20;
  for (const [k, v] of lignes) {
    const lignesV = wrapText(fixText(v || "-"), 62);
    canvas.ensure(lignesV.length * 13 + 10);
    canvas.text(MARGIN, canvas.y, fixText(k), { size: 9.5, fill: "#5B5F66" });
    lignesV.forEach((t, i) => canvas.text(MARGIN + 150, canvas.y + i * 13, t, { size: 10, bold: i === 0 }));
    canvas.y += lignesV.length * 13 + 6;
    canvas.line(MARGIN, canvas.y - 2, PAGE_WIDTH - MARGIN, canvas.y - 2, LINE, 0.6);
    canvas.y += 6;
  }
  canvas.y += 8;
  const notes = [
    "Acceptation du sous-traitant et agrément de ses conditions de paiement par le maître d'ouvrage (loi n° 75-1334 du 31 décembre 1975, article 3).",
    `Garantie de paiement du sous-traitant (article 14) : ${contrat.garantie === "delegation" ? "délégation de paiement par le client" : contrat.garantie === "caution" ? "caution bancaire" : "à choisir avant le début des travaux du sous-traitant (délégation de paiement ou caution bancaire)"}.`,
    contrat.accepteLe ? `Sous-traitant accepté par le client le ${formatDate(contrat.accepteLe)}.` : contrat.presenteLe ? `Sous-traitant présenté au client le ${formatDate(contrat.presenteLe)} ; accord en attente.` : "Sous-traitant pas encore présenté au client.",
    "Pièces jointes : attestations d'assurance décennale et de responsabilité civile, documents de vigilance du sous-traitant."
  ];
  for (const n of notes) {
    wrapText(n, 100).forEach((t) => { canvas.ensure(14); canvas.text(MARGIN, canvas.y, t, { size: 8.8, fill: "#3A3F44" }); canvas.y += 12; });
    canvas.y += 4;
  }
  canvas.y += 24;
  canvas.ensure(70);
  const w = (PAGE_WIDTH - MARGIN * 2 - 24) / 2;
  ["Entreprise principale", "Sous-traitant"].forEach((t, i) => {
    const x = MARGIN + i * (w + 24);
    canvas.text(x, canvas.y, t, { size: 9, bold: true });
    canvas.rect(x, canvas.y + 6, w, 50, { stroke: LINE, width: 0.8 });
  });
  return createPdf(addPdfFooters(canvas.pages, {
    company,
    quoteNumber: contrat.numero || "",
    generatedAt: new Date(),
    quote: { quoteDate: contrat.creeLe || new Date().toISOString() },
    project: {},
    documentLabel: "Sous-traitance",
    showVersion: false
  }), canvas.images);
}

export function contratSousTraitanceFilename(contrat = {}) {
  return `Sous-traitance_${sanitizeFilename([contrat.sousTraitant, contrat.lot].filter(Boolean).join("_") || "contrat")}.pdf`;
}
