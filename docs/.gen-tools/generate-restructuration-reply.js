// One-off converter: docs/KOJI-reponse-restructuration.md -> .docx
// Run from this folder: node generate-restructuration-reply.js
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ExternalHyperlink, BorderStyle
} = require("docx");

const NAVY = "06132D";
const BLUE = "1D74FF";
const TEXT = "1A1F29";
const MUTED = "5B6472";

const SRC = path.join(__dirname, "..", "KOJI-reponse-restructuration.md");
const OUT = path.join(__dirname, "..", "KOJI-reponse-restructuration.docx");

// Parses **bold**, [text](url) and plain text within one line into TextRun/ExternalHyperlink segments.
function parseInline(line) {
  const parts = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let match;
  while ((match = re.exec(line))) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index) });
    if (match[1] !== undefined) {
      parts.push({ text: match[1], bold: true });
    } else {
      parts.push({ link: true, text: match[2], url: match[3] });
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
    return new TextRun({ text: p.text, bold: Boolean(p.bold), color: TEXT, size: 21 });
  });
}

function main() {
  const raw = fs.readFileSync(SRC, "utf8");
  const lines = raw.split(/\r?\n/);
  const children = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
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
    if (line.startsWith("- ")) {
      children.push(new Paragraph({
        bullet: { level: 0 },
        children: parseInline(line.slice(2)),
        spacing: { after: 80 }
      }));
      continue;
    }
    if (line.startsWith("**") && line.includes(":**")) {
      // Metadata line like "**Destinataires :** ..."
      children.push(new Paragraph({
        children: [new TextRun({ text: "", color: MUTED, size: 20 }), ...parseInline(line)],
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
