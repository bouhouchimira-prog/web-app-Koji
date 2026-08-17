// Regenerates Recap-Koji-Manager.pptx from data.json.
// Run after editing data.json: `node generate.js` (from this folder).
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

const DATA_PATH = path.join(__dirname, "data.json");
const OUT_PATH = path.join(__dirname, "Recap-Koji-Manager.pptx");

const COLORS = {
  navy: "0B1030",
  navySoft: "1B2140",
  paper: "F3EEE3",
  panel: "FFFFFF",
  line: "E4DCCB",
  muted: "8A7C68",
  ink: "1B1F3B",
  accent: "1D6FE0",
  gold: "C9A96A"
};

const CATEGORY_META = {
  frontend: { label: "Frontend", sub: "Interface et expérience utilisateur", color: "1D6FE0", bg: "E5EDFB" },
  backend:  { label: "Backend",  sub: "API, logique métier et intégrations", color: "9A4C1F", bg: "F5E6DA" },
  database: { label: "Base de données", sub: "Modèle de données et infrastructure", color: "386641", bg: "E6EFE4" }
};
const CATEGORY_ORDER = ["frontend", "backend", "database"];

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function groupByTheme(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    if (!map.has(entry.theme)) map.set(entry.theme, []);
    map.get(entry.theme).push(entry);
  });
  return [...map.entries()];
}

function addFooter(slide, pptx, pageLabel) {
  slide.addText("Koji Web — Récapitulatif technique", {
    x: 0.4, y: 7.12, w: 6, h: 0.3, fontSize: 9, color: COLORS.muted, fontFace: "Segoe UI"
  });
  if (pageLabel) {
    slide.addText(pageLabel, {
      x: 10.5, y: 7.12, w: 2.4, h: 0.3, fontSize: 9, color: COLORS.muted, align: "right", fontFace: "Segoe UI"
    });
  }
}

function build() {
  const data = loadData();
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "KOJI_WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "KOJI_WIDE";
  pptx.author = data.meta.preparedBy || "Koji Web";
  pptx.title = data.meta.title || "Récapitulatif Koji Web";

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    meta: CATEGORY_META[cat],
    entries: data.entries.filter((entry) => entry.category === cat)
  }));

  // ── Slide 1: Title ──────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.navy };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: COLORS.gold } });
    slide.addText("KOJI", {
      x: 0.7, y: 0.6, w: 4, h: 0.6, fontSize: 20, bold: true, color: COLORS.gold, fontFace: "Georgia", charSpacing: 4
    });
    slide.addText(data.meta.title, {
      x: 0.7, y: 2.7, w: 11.5, h: 1.3, fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Georgia"
    });
    slide.addText(data.meta.subtitle, {
      x: 0.7, y: 3.75, w: 11.5, h: 0.6, fontSize: 18, color: "C7C9E0", fontFace: "Segoe UI"
    });
    slide.addText(data.meta.periodLabel, {
      x: 0.7, y: 4.5, w: 6, h: 0.4, fontSize: 14, bold: true, color: COLORS.gold, fontFace: "Segoe UI"
    });
    slide.addText(`Préparé pour : ${data.meta.preparedFor}`, {
      x: 0.7, y: 6.5, w: 6, h: 0.35, fontSize: 11, color: "8890B5", fontFace: "Segoe UI"
    });
    slide.addText(`Préparé par : ${data.meta.preparedBy}`, {
      x: 0.7, y: 6.85, w: 6, h: 0.35, fontSize: 11, color: "8890B5", fontFace: "Segoe UI"
    });
  }

  // ── Slide 2: Executive summary ──────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.paper };
    slide.addText("Vue d'ensemble", { x: 0.7, y: 0.45, w: 8, h: 0.6, fontSize: 26, bold: true, color: COLORS.ink, fontFace: "Georgia" });
    slide.addText(data.meta.periodLabel, { x: 0.7, y: 1.05, w: 8, h: 0.35, fontSize: 13, color: COLORS.muted, fontFace: "Segoe UI" });

    const total = data.entries.length;
    const stats = [
      { label: "Mises à jour livrées", value: String(total) },
      ...byCategory.map((c) => ({ label: c.meta.label, value: String(c.entries.length) }))
    ];
    const cardW = 2.7, gap = 0.3, startX = 0.7;
    stats.forEach((stat, index) => {
      const x = startX + index * (cardW + gap);
      slide.addShape(pptx.ShapeType.roundRect, {
        x, y: 1.7, w: cardW, h: 1.5, rectRadius: 0.08,
        fill: { color: COLORS.panel }, line: { color: COLORS.line, width: 1 }
      });
      slide.addText(stat.value, { x, y: 1.85, w: cardW, h: 0.7, align: "center", fontSize: 32, bold: true, color: COLORS.accent, fontFace: "Georgia" });
      slide.addText(stat.label, { x: x + 0.1, y: 2.6, w: cardW - 0.2, h: 0.5, align: "center", fontSize: 10.5, color: COLORS.muted, fontFace: "Segoe UI" });
    });

    slide.addText("Faits marquants", { x: 0.7, y: 3.65, w: 8, h: 0.4, fontSize: 15, bold: true, color: COLORS.ink, fontFace: "Georgia" });
    const highlights = [
      "Migration progressive vers Supabase : devis, chantiers, planning et fournitures désormais partagés avec l'application mobile.",
      "Nouveau module Planning / pointage des heures : suivi du temps, alertes automatiques, export PDF pour la paie et la comptabilité.",
      "Ouverture complète des espaces Client particulier et Ouvrier (suivi, notifications, réclamations, alertes urgentes).",
      "Audit et fiabilisation du backend : correction de plusieurs routes critiques restées sur l'ancienne base de données locale."
    ];
    slide.addText(highlights.map((text) => ({ text, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 8 } })), {
      x: 0.7, y: 4.1, w: 11.9, h: 2.7, fontSize: 13, color: COLORS.ink, fontFace: "Segoe UI", lineSpacing: 20
    });

    addFooter(slide, pptx, "2");
  }

  // ── Category section divider + content slides ───────────────────
  let pageNum = 2;
  byCategory.forEach(({ cat, meta, entries }) => {
    pageNum += 1;
    // Section divider
    {
      const slide = pptx.addSlide();
      slide.background = { color: COLORS.navy };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 3.55, w: 13.333, h: 0.06, fill: { color: meta.color } });
      slide.addText(meta.label, { x: 0.7, y: 2.7, w: 11, h: 1, fontSize: 38, bold: true, color: "FFFFFF", fontFace: "Georgia" });
      slide.addText(meta.sub, { x: 0.7, y: 3.75, w: 11, h: 0.5, fontSize: 15, color: "C7C9E0", fontFace: "Segoe UI" });
      slide.addText(`${entries.length} mise(s) à jour`, { x: 0.7, y: 4.3, w: 6, h: 0.4, fontSize: 12, bold: true, color: meta.color === "1D6FE0" ? "8FB6FF" : COLORS.gold, fontFace: "Segoe UI" });
      addFooter(slide, pptx, String(pageNum));
    }

    const themed = groupByTheme(entries);
    themed.forEach(([theme, themeEntries]) => {
      chunk(themeEntries, 4).forEach((pageEntries, pageIndex) => {
        pageNum += 1;
        const slide = pptx.addSlide();
        slide.background = { color: COLORS.paper };

        slide.addShape(pptx.ShapeType.roundRect, {
          x: 0.7, y: 0.45, w: 2.6, h: 0.4, rectRadius: 0.2,
          fill: { color: meta.bg }, line: { type: "none" }
        });
        slide.addText(meta.label.toUpperCase(), { x: 0.7, y: 0.45, w: 2.6, h: 0.4, align: "center", fontSize: 10, bold: true, color: meta.color, fontFace: "Segoe UI", charSpacing: 1 });

        slide.addText(theme + (pageIndex > 0 ? ` (suite)` : ""), { x: 0.7, y: 0.95, w: 11.5, h: 0.6, fontSize: 24, bold: true, color: COLORS.ink, fontFace: "Georgia" });

        let y = 1.85;
        pageEntries.forEach((entry) => {
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.7, y, w: 11.9, h: 1.2, rectRadius: 0.06,
            fill: { color: COLORS.panel }, line: { color: COLORS.line, width: 1 }
          });
          slide.addShape(pptx.ShapeType.rect, { x: 0.7, y, w: 0.06, h: 1.2, fill: { color: meta.color } });
          slide.addText(entry.title, { x: 1.0, y: y + 0.12, w: 11.3, h: 0.4, fontSize: 14, bold: true, color: COLORS.ink, fontFace: "Segoe UI" });
          slide.addText(entry.detail, { x: 1.0, y: y + 0.5, w: 11.3, h: 0.65, fontSize: 11, color: COLORS.muted, fontFace: "Segoe UI", lineSpacing: 14 });
          y += 1.35;
        });

        addFooter(slide, pptx, String(pageNum));
      });
    });
  });

  // ── Closing slide ────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.navy };
    slide.addText("Merci", { x: 0.7, y: 2.9, w: 8, h: 1, fontSize: 40, bold: true, color: "FFFFFF", fontFace: "Georgia" });
    slide.addText("Document généré automatiquement à partir de l'historique de développement du projet.", {
      x: 0.7, y: 3.9, w: 10, h: 0.6, fontSize: 13, color: "C7C9E0", fontFace: "Segoe UI"
    });
  }

  return pptx.writeFile({ fileName: OUT_PATH }).then(() => {
    console.log(`OK: ${OUT_PATH}`);
  });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
