// One-off converter: docs/KOJI-interface-marketplace.md -> .docx
// Run from this folder: node generate-interface-marketplace.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  ExternalHyperlink, BorderStyle, ShadingType, ImageRun
} = require("docx");

const MAX_IMAGE_WIDTH = 560;

function pngDimensions(buffer) {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const NAVY = "06132D";
const BLUE = "1D74FF";
const TEXT = "1A1F29";
const MUTED = "5B6472";
const CODE_BG = "F2F4F8";

const SRC = path.join(__dirname, "..", "KOJI-interface-marketplace.md");
const OUT = path.join(__dirname, "..", "KOJI-interface-marketplace.docx");

// Parses **bold**, *italic*, `code`, [text](url) and plain text within one line.
function parseInline(line) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let match;
  while ((match = re.exec(line))) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index) });
    if (match[1] !== undefined) {
      parts.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      parts.push({ text: match[2], code: true });
    } else {
      parts.push({ link: true, text: match[3], url: match[4] });
    }
    last = re.lastIndex;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts.map((p) => {
    if (p.link) {
      return new ExternalHyperlink({
        link: p.url,
        children: [new TextRun({ text: p.text, color: BLUE, underline: {}, size: 21 })]
      });
    }
    if (p.code) {
      return new TextRun({ text: p.text, font: "Consolas", color: "B5006B", size: 20, shading: { type: ShadingType.CLEAR, fill: CODE_BG } });
    }
    return new TextRun({ text: p.text, bold: Boolean(p.bold), color: TEXT, size: 21 });
  });
}

function main() {
  const raw = fs.readFileSync(SRC, "utf8");
  const lines = raw.split(/\r?\n/);
  const children = [];
  let inCode = false;

  for (const rawLine of lines) {
    if (rawLine.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      children.push(new Paragraph({
        children: [new TextRun({ text: rawLine || " ", font: "Consolas", color: TEXT, size: 19 })],
        shading: { type: ShadingType.CLEAR, fill: CODE_BG },
        spacing: { after: 0 }
      }));
      continue;
    }

    const line = rawLine.trim();
    if (!line) continue;

    const imageMatch = /^!\[(.*?)\]\((.+?)\)$/.exec(line);
    if (imageMatch) {
      const [, alt, relPath] = imageMatch;
      const imagePath = path.join(__dirname, "..", relPath);
      const buffer = fs.readFileSync(imagePath);
      const { width, height } = pngDimensions(buffer);
      const scale = Math.min(1, MAX_IMAGE_WIDTH / width);
      children.push(new Paragraph({
        children: [new ImageRun({
          data: buffer,
          type: "png",
          transformation: { width: Math.round(width * scale), height: Math.round(height * scale) }
        })],
        spacing: { before: 80, after: 60 }
      }));
      if (alt) {
        children.push(new Paragraph({
          children: [new TextRun({ text: alt, italics: true, color: MUTED, size: 18 })],
          spacing: { after: 200 }
        }));
      }
      continue;
    }

    if (line === "---") {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "DFE6F0" } },
        spacing: { before: 200, after: 200 }
      }));
      continue;
    }
    if (line.startsWith("# ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2), bold: true, color: NAVY, size: 40 })],
        spacing: { after: 160 }
      }));
      continue;
    }
    if (line.startsWith("## ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(3), bold: true, color: NAVY, size: 28 })],
        spacing: { before: 320, after: 140 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BLUE } }
      }));
      continue;
    }
    if (line.startsWith("### ")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(4), bold: true, color: NAVY, size: 24 })],
        spacing: { before: 220, after: 100 }
      }));
      continue;
    }
    if (line.startsWith("- ")) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInline(line.slice(2)),
        spacing: { after: 80 }
      }));
      continue;
    }
    if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(1, -1), italics: true, color: MUTED, size: 20 })],
        spacing: { after: 160 }
      }));
      continue;
    }
    if (line.startsWith("**") && line.includes(":**")) {
      children.push(new Paragraph({
        children: parseInline(line),
        spacing: { after: 60 }
      }));
      continue;
    }
    children.push(new Paragraph({
      children: parseInline(line),
      spacing: { after: 160 },
      alignment: AlignmentType.LEFT
    }));
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children
    }]
  });

  Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(OUT, buffer);
    console.log("OK:", OUT);
  });
}

main();
