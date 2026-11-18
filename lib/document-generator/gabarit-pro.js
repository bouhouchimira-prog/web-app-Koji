// Gabarit A4 des documents Koji Pro (maquette PRO-25) : en-tête de
// l'entreprise à gauche, titre et numéro à droite, filet de 2 pt, client,
// lignes, totaux alignés à droite, mentions, cases de signature, pied
// discret « Document établi avec Koji ». Encre graphite, filets fins.
// Les largeurs de texte viennent des métriques Helvetica (polices standard
// du PDF), pour aligner les montants à droite.
import { fixText } from "../text";
import { CADRE, CLAIR, FILET, GRIS, INK, MARGIN, PAGE_HEIGHT, PAGE_WIDTH, TEXTE, cleanQuoteNumber, pdfTextOp } from "./shared.js";

export const PRO_X = MARGIN;
export const PRO_W = PAGE_WIDTH - MARGIN * 2;
export const PRO_DROITE = PAGE_WIDTH - MARGIN;

// Métriques Helvetica et Helvetica-Bold, caractères 32 à 126 (AFM Adobe).
const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const HELV_B = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];
const SPECIAUX = { "€": 556, "°": 400, "·": 278, "×": 584, "«": 556, "»": 556, "’": 191, "‘": 191, "œ": 944, "Œ": 1000, "…": 1000, "–": 333, "—": 333, "−": 333, " ": 278, " ": 278, "²": 333, "³": 333 };

function largeurCar(ch, bold) {
  const code = ch.charCodeAt(0);
  const table = bold ? HELV_B : HELV;
  if (code >= 32 && code <= 126) return table[code - 32];
  if (SPECIAUX[ch] != null) return SPECIAUX[ch];
  const base = ch.normalize("NFD").charAt(0);
  const b = base.charCodeAt(0);
  if (b >= 32 && b <= 126) return table[b - 32];
  return 556;
}

export function largeurTexte(value, size = 10, bold = false, spacing = 0) {
  const t = fixText(String(value ?? ""));
  let w = 0;
  for (const ch of t) w += largeurCar(ch, bold);
  return (w / 1000) * size + spacing * Math.max(0, [...t].length - 1);
}

// Coupe un texte en lignes d'une largeur donnée (en points). La première
// ligne peut être plus courte (texte qui suit un titre en gras).
export function couper(value, largeur, size, bold = false, premiere = largeur) {
  const lignes = [];
  for (const para of fixText(String(value ?? "")).split(/\r?\n/)) {
    let courante = "";
    for (const mot of para.split(/\s+/).filter(Boolean)) {
      const max = lignes.length === 0 ? premiere : largeur;
      const essai = courante ? `${courante} ${mot}` : mot;
      if (largeurTexte(essai, size, bold) <= max || !courante) courante = essai;
      else { lignes.push(courante); courante = mot; }
    }
    lignes.push(courante);
  }
  return lignes;
}

export function texteDroite(c, xDroite, y, value, opts = {}) {
  c.text(xDroite - largeurTexte(value, opts.size || 10, opts.bold, opts.spacing || 0), y, value, opts);
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function parts(v) {
  if (!v) return null;
  const s = String(v);
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  const d = fr ? new Date(Date.UTC(+fr[3], +fr[2] - 1, +fr[1], 12)) : new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00Z` : s);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { j: +p.day, m: +p.month - 1, a: +p.year, h: p.hour, mi: p.minute };
}
export const dateLongue = (v) => { const p = parts(v); return p ? `${p.j}${p.j === 1 ? "er" : ""} ${MOIS[p.m]} ${p.a}` : ""; };
export const dateCourte = (v) => { const p = parts(v); return p ? `${p.j} ${MOIS_COURTS[p.m]} ${p.a}` : ""; };
export const dateHeure = (v) => { const p = parts(v); return p ? `${p.j} ${MOIS_COURTS[p.m]} ${p.a} ${p.h}:${p.mi}` : ""; };

// Lignes d'identité de l'entreprise sous son nom.
export function identiteEntreprise(company = {}) {
  const adresse = [company.addressLine1, company.addressLine2].filter(Boolean).join(", ");
  const siren = fixText(company.siren || String(company.siret || "").replace(/\s/g, "").slice(0, 9));
  const dec = company.decennale || {};
  return [
    [company.legalForm, adresse].filter(Boolean).join(" · "),
    [siren ? `SIREN ${siren}` : "", company.tva ? `TVA ${company.tva}` : ""].filter(Boolean).join(" · "),
    [company.phone, company.email].filter(Boolean).join(" · "),
    dec.assureur ? `Décennale : ${dec.assureur}${dec.contrat ? ` n° ${dec.contrat}` : ""}${dec.jusqua ? ` · valable jusqu'au ${dateCourte(dec.jusqua)}` : ""}` : ""
  ].map((l) => fixText(l)).filter(Boolean);
}

const KICKER = { size: 7.4, bold: true, fill: GRIS, spacing: 0.6 };

// En-tête : entreprise à gauche, nature et numéro du document à droite.
export function enTetePro(c, { company = {}, kicker = "", titre = "", lignes = [] }) {
  const top = c.y;
  let xTexte = PRO_X;
  if (company.logoDataUrl && c.image(PRO_X, top, 40, 40, company.logoDataUrl)) xTexte = PRO_X + 50;
  const largeurGauche = PRO_W * 0.56 - (xTexte - PRO_X);
  c.text(xTexte, top + 12, fixText(company.name || "Entreprise"), { size: 12.8, bold: true, fill: INK });
  let yG = top + 26;
  for (const l of identiteEntreprise(company)) {
    for (const t of couper(l, largeurGauche, 8.2)) { c.text(xTexte, yG, t, { size: 8.2, fill: TEXTE }); yG += 10.5; }
  }
  let yD = top + 8;
  if (kicker) { texteDroite(c, PRO_DROITE, yD, fixText(kicker).toUpperCase(), KICKER); yD += 15; }
  if (titre) { texteDroite(c, PRO_DROITE, yD + 2, titre, { size: 14, bold: true, fill: INK }); yD += 16; }
  for (const l of lignes.filter(Boolean)) { texteDroite(c, PRO_DROITE, yD + 2, l, { size: 8.2, fill: TEXTE }); yD += 10.5; }
  const bas = Math.max(yG, yD, top + 40) + 6;
  c.line(PRO_X, bas, PRO_DROITE, bas, INK, 1.6);
  c.y = bas + 16;
}

// Bloc d'une partie (client, fournisseur) : intitulé, nom, lignes.
export function blocPartie(c, { kicker = "Client", nom = "", lignes = [], x = PRO_X, largeur = PRO_W, avancer = true }) {
  const top = c.y;
  c.text(x, top + 8, fixText(kicker).toUpperCase(), KICKER);
  c.text(x, top + 22, fixText(nom || "—"), { size: 10.4, bold: true, fill: INK });
  let y = top + 34;
  for (const l of lignes.filter(Boolean)) for (const t of couper(l, largeur, 8.8)) { c.text(x, y, t, { size: 8.8, fill: TEXTE }); y += 11; }
  if (avancer) c.y = y + 8;
  return y + 8;
}

// Tableau : colonnes { titre, largeur, droite }, lignes { cellules, groupe }.
// Une cellule est un texte ou { texte, gras, details: [] }.
export function tableauPro(c, { colonnes, lignes }) {
  const somme = colonnes.reduce((t, col) => t + col.largeur, 0);
  const cols = colonnes.map((col) => ({ ...col, largeur: (col.largeur / somme) * PRO_W }));
  const entete = () => {
    let x = PRO_X;
    for (const col of cols) {
      const t = fixText(col.titre).toUpperCase();
      if (col.droite) texteDroite(c, x + col.largeur - 4, c.y + 10, t, KICKER);
      else c.text(x + 4, c.y + 10, t, KICKER);
      x += col.largeur;
    }
    c.line(PRO_X, c.y + 15, PRO_DROITE, c.y + 15, INK, 1.1);
    c.y += 15;
  };
  c.ensure(40);
  entete();
  for (const ligne of lignes) {
    if (ligne.groupe) {
      if (c.ensure(22)) entete();
      c.text(PRO_X + 4, c.y + 14, fixText(ligne.groupe), { size: 8.6, bold: true, fill: INK });
      c.y += 20;
      c.line(PRO_X, c.y, PRO_DROITE, c.y, FILET, 0.8);
      continue;
    }
    const cellules = ligne.cellules.map((cel, i) => {
      const o = typeof cel === "object" && cel !== null ? cel : { texte: cel };
      const w = cols[i].largeur - 8;
      return { ...o, lignes: cols[i].droite ? [fixText(o.texte ?? "")] : couper(o.texte ?? "", w, 8.6, o.gras), details: (o.details || []).flatMap((d) => couper(d, w - 4, 7.4)) };
    });
    const h = Math.max(...cellules.map((cel) => cel.lignes.length * 10.8 + cel.details.length * 9.4)) + 9;
    if (c.ensure(h)) entete();
    let x = PRO_X;
    cellules.forEach((cel, i) => {
      const col = cols[i];
      cel.lignes.forEach((t, k) => {
        const opts = { size: 8.6, bold: cel.gras, fill: i === 0 && !col.noir ? GRIS : INK };
        if (col.droite) texteDroite(c, x + col.largeur - 4, c.y + 12 + k * 10.8, t, opts);
        else c.text(x + 4, c.y + 12 + k * 10.8, t, opts);
      });
      cel.details.forEach((t, k) => c.text(x + 8, c.y + 12 + cel.lignes.length * 10.8 + k * 9.4, t, { size: 7.4, fill: GRIS }));
      x += col.largeur;
    });
    c.y += h;
    c.line(PRO_X, c.y, PRO_DROITE, c.y, FILET, 0.8);
  }
  c.y += 8;
}

// Totaux alignés à droite ; la dernière ligne (grand) sous un filet, en gras.
export function totauxPro(c, { lignes = [], grand = null, note = "" }) {
  const hauteur = lignes.length * 13 + (grand ? 26 : 0) + (note ? 12 : 0) + 8;
  c.ensure(hauteur);
  const xValeur = PRO_DROITE - 4;
  const xLabel = xValeur - 84;
  for (const l of lignes) {
    c.y += 13;
    texteDroite(c, xLabel, c.y, l.label, { size: 8.8, fill: GRIS });
    texteDroite(c, xValeur, c.y, l.valeur, { size: 8.8, bold: true, fill: INK });
  }
  if (grand) {
    const largeurLabel = largeurTexte(grand.label, 9.6);
    c.y += 7;
    c.line(Math.min(xLabel - largeurLabel, PRO_DROITE - 240), c.y, PRO_DROITE, c.y, INK, 1.1);
    c.y += 15;
    texteDroite(c, xLabel, c.y, grand.label, { size: 9.6, fill: GRIS });
    texteDroite(c, xValeur, c.y, grand.valeur, { size: 12.8, bold: true, fill: INK });
  }
  if (note) { c.y += 11; texteDroite(c, xValeur, c.y, note, { size: 7.2, fill: CLAIR }); }
  c.y += 14;
}

// Paragraphes de mentions : titre en gras en tête de ligne, texte à la suite.
export function mentionsPro(c, paragraphes = []) {
  for (const p of paragraphes.filter((x) => x && (x.texte || x.titre))) {
    const titre = p.titre ? fixText(p.titre) : "";
    const decal = titre ? largeurTexte(`${titre} `, 8.2, true) : 0;
    const lignes = couper(p.texte || "", PRO_W, 8.2, false, PRO_W - decal);
    c.ensure(lignes.length * 10.6 + 6);
    if (titre) c.text(PRO_X, c.y + 9, titre, { size: 8.2, bold: true, fill: INK });
    lignes.forEach((t, i) => c.text(PRO_X + (i === 0 ? decal : 0), c.y + 9 + i * 10.6, t, { size: 8.2, fill: TEXTE }));
    c.y += lignes.length * 10.6 + 5;
  }
  c.y += 4;
}

export function titreSection(c, texte) {
  c.ensure(30);
  c.text(PRO_X, c.y + 10, fixText(texte), { size: 9.6, bold: true, fill: INK });
  c.y += 18;
}

// Deux cases de signature encadrées ; une case nulle reste vide.
export function signaturesPro(c, cases) {
  const gap = 19;
  const w = (PRO_W - gap) / 2;
  const avecImage = cases.some((s) => s?.image);
  const h = avecImage ? 82 : 62;
  c.ensure(h + 16);
  c.y += 8;
  const top = c.y;
  cases.forEach((s, i) => {
    if (!s) return;
    const x = PRO_X + i * (w + gap);
    c.rect(x, top, w, h, { stroke: CADRE, width: 0.8 });
    c.text(x + 8, top + 12, fixText(s.label).toUpperCase(), KICKER);
    if (s.image) c.image(x + 8, top + 18, w - 16, h - 36, s.image);
    const lignes = couper(s.texte || "", w - 16, 8.4);
    lignes.forEach((t, k) => c.text(x + 8, top + h - 8 - (lignes.length - 1 - k) * 10.4, t, { size: 8.4, fill: INK }));
  });
  c.y = top + h + 10;
}

// Pied de page : référence et page à gauche, « Document établi avec Koji » à droite.
export function piedsPro(pages, gauche) {
  const n = pages.length;
  const y = PAGE_HEIGHT - 30;
  const droite = "Document établi avec Koji · ";
  const site = "getkoji.io";
  const xSite = PRO_DROITE - largeurTexte(site, 7.6, true);
  return pages.map((ops, i) => [
    ...ops,
    `q 0.902 0.902 0.882 RG 0.8 w ${PRO_X} ${PAGE_HEIGHT - (y - 11)} m ${PRO_DROITE} ${PAGE_HEIGHT - (y - 11)} l S Q`,
    pdfTextOp(PRO_X, y, fixText(gauche(i + 1, n)), { size: 7.6, fill: GRIS }),
    pdfTextOp(xSite - largeurTexte(droite, 7.6), y, droite, { size: 7.6, fill: GRIS }),
    pdfTextOp(xSite, y, site, { size: 7.6, bold: true, fill: GRIS })
  ]);
}

// Version Pro des aides historiques (en-tête, pied, bloc client), pour les
// documents qui suivent le même gabarit sans mise en page propre.
export function drawHeader(canvas, quote, company, title) {
  const numero = cleanQuoteNumber(quote?.quoteNumber || "");
  enTetePro(canvas, { company, kicker: title, titre: numero ? `N° ${numero}` : "", lignes: [] });
}

export function drawInfoColumns(canvas, quote = {}, project, company) {
  blocPartie(canvas, {
    kicker: "Client",
    nom: quote.client || project?.client || "Client",
    lignes: [quote.clientAddress || project?.clientAddress || "", [quote.clientPhone, quote.clientEmail].filter(Boolean).join(" · ")]
  });
}

export function addPdfFooters(pages, { quoteNumber, quote = {}, documentLabel = "Devis", showVersion = true } = {}) {
  const numero = cleanQuoteNumber(quoteNumber || quote.quoteNumber || "");
  const version = showVersion ? Number(quote.versionNumber || quote.version || 1) : 1;
  return piedsPro(pages, (i, n) => [`${documentLabel}${numero ? ` ${numero}` : ""}`, version > 1 ? `version ${version}` : "", `page ${i} / ${n}`].filter(Boolean).join(" · "));
}
