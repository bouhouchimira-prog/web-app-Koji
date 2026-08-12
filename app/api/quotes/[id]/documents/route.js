import { NextResponse } from "next/server";
import { badRequest } from "../../../../../lib/http";
import { readDb } from "../../../../../lib/db";
import { getAuth } from "../../../../../lib/server-auth";
import { mapQuote } from "../../../../../lib/quote-mapping";
import {
  buildQuotePdf,
  buildQuoteWordHtml,
  buildSuppliesPdf,
  buildSuppliesWordHtml,
  quoteDocumentFilename
} from "../../../../../lib/document-generator";
import { fixObjectText } from "../../../../../lib/text";
import { checkTrialGenerateLimit } from "../../../../../lib/plan";

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

  const auth = getAuth(request);
  if (!auth) return badRequest("Session expirée. Reconnectez-vous.", 401);

  const { data: row, error } = await auth.supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (error) return badRequest(`Lecture du devis impossible: ${error.message}`, 500);
  if (!row) return badRequest("Devis introuvable.", 404);
  const quote = fixObjectText(mapQuote(row));

  const db = await readDb();

  // Trial gate: only the first (or claimed) quote can be generated as PDF.
  const quoteOwner = quote.userId ? db.users.find((u) => u.id === quote.userId) : null;
  const generateGate = checkTrialGenerateLimit(db, quoteOwner, quote);
  if (!generateGate.allowed) {
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Formule requise — Kôji</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.card{background:#fff;border-radius:16px;padding:48px 40px;max-width:440px;width:100%;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}img{width:56px;margin-bottom:24px}h2{color:#1e293b;font-size:1.25rem;margin-bottom:12px}p{color:#64748b;line-height:1.6;font-size:.95rem;margin-bottom:28px}.btn{display:inline-block;padding:13px 32px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:600;font-size:.95rem}.note{color:#94a3b8;font-size:.82rem;margin-top:16px}</style></head><body><div class="card"><img src="/koji-logo.svg" alt="Kôji"><h2>Période d'essai — 1 devis inclus</h2><p>Votre période d'essai inclut la génération complète d'un seul devis. Pour générer ce devis, passez à une formule Kôji.</p><a href="/abonnement" class="btn">Voir les formules Kôji</a><p class="note">14 jours d'essai · Sans engagement</p></div></body></html>`;
    return new NextResponse(html, {
      status: 402,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
  let project = {};
  if (quote.projectId) {
    const { data: chantierRow } = await auth.supabase
      .from("chantiers")
      .select("*")
      .eq("id", quote.projectId)
      .maybeSingle();
    if (chantierRow) {
      project = {
        title: chantierRow.reference || "Chantier",
        reference: chantierRow.reference || "",
        client: chantierRow.client_email ? chantierRow.client_email.split("@")[0] : "",
        clientAddress: "",
        address: [chantierRow.street, chantierRow.postal_code, chantierRow.city].filter(Boolean).join(", "),
        city: chantierRow.city || "",
        description: ""
      };
    }
  }
  project = fixObjectText(project);
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

  return responseFor(buildQuotePdf({ quote, project, db, documentType: type === "facture" ? "facture" : "devis" }), filename, "application/pdf", inline);
}
