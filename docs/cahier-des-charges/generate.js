// Regenerates Cahier-des-charges-Koji-Web.pptx from data.json.
// Run after editing data.json: `node generate.js` (from this folder).
const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

const DATA_PATH = path.join(__dirname, "data.json");
const OUT_PATH = path.join(__dirname, "Cahier-des-charges-Koji-Web.pptx");

const COLORS = {
  navy: "0B1030",
  paper: "F3EEE3",
  panel: "FFFFFF",
  line: "E4DCCB",
  muted: "8A7C68",
  ink: "1B1F3B",
  accent: "1D6FE0",
  gold: "C9A96A",
  tanBg: "F7EADF",
  tanLine: "F0DDCB",
  tanText: "9A7C5C"
};

function loadData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function addFooter(slide, pageLabel) {
  slide.addText("Koji Web — Cahier des charges", {
    x: 0.4, y: 7.12, w: 6, h: 0.3, fontSize: 8.5, color: COLORS.muted, fontFace: "Segoe UI"
  });
  if (pageLabel) {
    slide.addText(pageLabel, { x: 10.5, y: 7.12, w: 2.4, h: 0.3, fontSize: 8.5, color: COLORS.muted, align: "right", fontFace: "Segoe UI" });
  }
}

function build() {
  const data = loadData();
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "KOJI_WIDE", width: 13.333, height: 7.5 });
  pptx.layout = "KOJI_WIDE";
  pptx.author = data.meta.developedBy;
  pptx.title = `${data.meta.title} — ${data.meta.subtitle}`;

  let pageNum = 0;

  // ── Slide 1: Title ──────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.navy };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: COLORS.gold } });
    slide.addText("KOJI", { x: 0.7, y: 0.6, w: 4, h: 0.6, fontSize: 20, bold: true, color: COLORS.gold, fontFace: "Georgia", charSpacing: 4 });
    slide.addText(data.meta.title, { x: 0.7, y: 2.5, w: 11.5, h: 1.1, fontSize: 42, bold: true, color: "FFFFFF", fontFace: "Georgia" });
    slide.addText(data.meta.subtitle, { x: 0.7, y: 3.55, w: 11.5, h: 0.6, fontSize: 17, color: "C7C9E0", fontFace: "Segoe UI" });
    slide.addText(data.meta.dateLabel, { x: 0.7, y: 4.25, w: 6, h: 0.4, fontSize: 13, bold: true, color: COLORS.gold, fontFace: "Segoe UI" });
    slide.addText(`Cahier des charges préparé par : ${data.meta.preparedBy}`, { x: 0.7, y: 6.2, w: 8, h: 0.35, fontSize: 12, color: "C7C9E0", fontFace: "Segoe UI" });
    slide.addText(`Application Koji Web développée par : ${data.meta.developedBy}`, { x: 0.7, y: 6.6, w: 8, h: 0.35, fontSize: 12, color: "C7C9E0", fontFace: "Segoe UI" });
  }

  // ── Slide 2: Présentation / objectifs ────────────────────────────
  {
    pageNum += 1;
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.paper };
    slide.addText("Présentation du projet", { x: 0.7, y: 0.45, w: 11.5, h: 0.6, fontSize: 26, bold: true, color: COLORS.ink, fontFace: "Georgia" });
    slide.addText(data.intro, { x: 0.7, y: 1.15, w: 11.9, h: 1.6, fontSize: 12, color: COLORS.ink, fontFace: "Segoe UI", lineSpacing: 18 });

    slide.addText("Objectifs de l'application", { x: 0.7, y: 2.9, w: 8, h: 0.4, fontSize: 15, bold: true, color: COLORS.ink, fontFace: "Georgia" });
    slide.addText(data.objectifs.map((text) => ({ text, options: { bullet: { code: "2022" }, breakLine: true, paraSpaceAfter: 8 } })), {
      x: 0.7, y: 3.35, w: 11.9, h: 3.6, fontSize: 12.5, color: COLORS.ink, fontFace: "Segoe UI", lineSpacing: 19
    });
    addFooter(slide, String(pageNum));
  }

  // ── Slide 3: Sommaire ─────────────────────────────────────────────
  {
    pageNum += 1;
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.paper };
    slide.addText("Sommaire", { x: 0.7, y: 0.45, w: 8, h: 0.6, fontSize: 26, bold: true, color: COLORS.ink, fontFace: "Georgia" });

    const half = Math.ceil(data.sections.length / 2);
    const col1 = data.sections.slice(0, half);
    const col2 = data.sections.slice(half);
    [col1, col2].forEach((col, colIndex) => {
      const x = 0.7 + colIndex * 6.1;
      col.forEach((section, index) => {
        const num = colIndex * half + index + 1;
        const y = 1.4 + index * 0.62;
        slide.addText(String(num).padStart(2, "0"), { x, y, w: 0.5, h: 0.5, fontSize: 13, bold: true, color: COLORS.gold, fontFace: "Georgia" });
        slide.addText(section.title, { x: x + 0.55, y, w: 5.3, h: 0.5, fontSize: 13, color: COLORS.ink, fontFace: "Segoe UI", valign: "top" });
      });
    });
    addFooter(slide, String(pageNum));
  }

  // ── One section per module: divider + feature slides ─────────────
  data.sections.forEach((section, sectionIndex) => {
    pageNum += 1;
    // Section divider
    {
      const slide = pptx.addSlide();
      slide.background = { color: COLORS.navy };
      slide.addShape(pptx.ShapeType.rect, { x: 0, y: 3.55, w: 13.333, h: 0.06, fill: { color: COLORS.gold } });
      slide.addText(String(sectionIndex + 1).padStart(2, "0"), { x: 0.7, y: 2.1, w: 3, h: 0.6, fontSize: 15, bold: true, color: COLORS.gold, fontFace: "Segoe UI" });
      slide.addText(section.title, { x: 0.7, y: 2.6, w: 11.5, h: 1, fontSize: 34, bold: true, color: "FFFFFF", fontFace: "Georgia" });
      slide.addText(section.intro, { x: 0.7, y: 3.75, w: 11, h: 1.3, fontSize: 13, color: "C7C9E0", fontFace: "Segoe UI", lineSpacing: 18 });
      addFooter(slide, String(pageNum));
    }

    chunk(section.features, 2).forEach((pageFeatures) => {
      pageNum += 1;
      const slide = pptx.addSlide();
      slide.background = { color: COLORS.paper };

      slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y: 0.45, w: 3.4, h: 0.4, rectRadius: 0.2, fill: { color: COLORS.tanBg }, line: { type: "none" } });
      slide.addText(section.title.toUpperCase(), { x: 0.7, y: 0.45, w: 3.4, h: 0.4, align: "center", fontSize: 9.5, bold: true, color: COLORS.tanText, fontFace: "Segoe UI", charSpacing: 1 });

      let y = 1.1;
      pageFeatures.forEach((feature) => {
        const hasTechnical = Boolean(feature.technical);
        const cardH = hasTechnical ? 2.85 : 1.9;
        slide.addShape(pptx.ShapeType.roundRect, { x: 0.7, y, w: 11.9, h: cardH, rectRadius: 0.06, fill: { color: COLORS.panel }, line: { color: COLORS.line, width: 1 } });
        slide.addShape(pptx.ShapeType.rect, { x: 0.7, y, w: 0.06, h: cardH, fill: { color: COLORS.accent } });

        slide.addText(feature.name, { x: 1.0, y: y + 0.14, w: 11.3, h: 0.4, fontSize: 15, bold: true, color: COLORS.ink, fontFace: "Georgia" });
        slide.addText(feature.description, { x: 1.0, y: y + 0.58, w: 11.3, h: hasTechnical ? 1.15 : 1.1, fontSize: 11.5, color: COLORS.ink, fontFace: "Segoe UI", lineSpacing: 16 });

        if (hasTechnical) {
          slide.addText("RÉALISATION TECHNIQUE", { x: 1.0, y: y + cardH - 0.95, w: 11.3, h: 0.25, fontSize: 8, bold: true, color: COLORS.tanText, fontFace: "Segoe UI", charSpacing: 1 });
          slide.addText(feature.technical, { x: 1.0, y: y + cardH - 0.68, w: 11.3, h: 0.6, fontSize: 10, color: COLORS.muted, fontFace: "Segoe UI", lineSpacing: 14, italic: true });
        }

        y += cardH + 0.22;
      });

      addFooter(slide, String(pageNum));
    });
  });

  // ── Closing slide ────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    slide.background = { color: COLORS.navy };
    slide.addText(data.closing.title, { x: 0.7, y: 2.5, w: 10, h: 0.9, fontSize: 34, bold: true, color: "FFFFFF", fontFace: "Georgia" });
    slide.addText(data.closing.text, { x: 0.7, y: 3.5, w: 10, h: 0.9, fontSize: 13, color: "C7C9E0", fontFace: "Segoe UI", lineSpacing: 18 });
    slide.addText(`Cahier des charges préparé par : ${data.meta.preparedBy}`, { x: 0.7, y: 5.3, w: 8, h: 0.35, fontSize: 12, bold: true, color: COLORS.gold, fontFace: "Segoe UI" });
    slide.addText(`Application Koji Web développée par : ${data.meta.developedBy}`, { x: 0.7, y: 5.68, w: 8, h: 0.35, fontSize: 12, bold: true, color: COLORS.gold, fontFace: "Segoe UI" });
  }

  return pptx.writeFile({ fileName: OUT_PATH }).then(() => {
    console.log(`OK: ${OUT_PATH}`);
  });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
