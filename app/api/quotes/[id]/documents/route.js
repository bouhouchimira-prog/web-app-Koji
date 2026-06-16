import { NextResponse } from "next/server";
import { badRequest } from "../../../../../lib/http";
import { readDb } from "../../../../../lib/db";
import {
  buildQuotePdf,
  buildQuoteWordHtml,
  buildSuppliesPdf,
  buildSuppliesWordHtml,
  quoteDocumentFilename
} from "../../../../../lib/document-generator";
import { fixObjectText } from "../../../../../lib/text";

function responseFor(bufferOrText, filename, contentType, inline = false) {
  return new NextResponse(bufferOrText, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`
    }
  });
}

export async function GET(request, context) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "quote";
  const format = url.searchParams.get("format") || "pdf";
  const inline = Boolean(url.searchParams.get("preview"));
  const db = await readDb();
  const quote = fixObjectText(db.quotes.find((item) => item.id === id));
  if (!quote) return badRequest("Devis introuvable.", 404);
  const project = fixObjectText(db.projects.find((item) => item.id === quote.projectId) || {});
  const filename = quoteDocumentFilename(quote, type, format);

  if (type === "supplies" && format === "word") {
    return responseFor(buildSuppliesWordHtml({ quote, db }), filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=utf-8", inline);
  }

  if (type === "supplies") {
    return responseFor(buildSuppliesPdf({ quote, db }), filename, "application/pdf", inline);
  }

  if (format === "word") {
    return responseFor(buildQuoteWordHtml({ quote, project, db }), filename, "application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=utf-8", inline);
  }

  return responseFor(buildQuotePdf({ quote, project, db }), filename, "application/pdf", inline);
}
