import { resolveEntreprise } from "../../../../../lib/entreprise-auth";

// GET /api/entreprise/devis/:id/pdf — download quote as PDF
export async function GET(request, { params }) {
  const entreprise = await resolveEntreprise(request);
  if (!entreprise) return new Response("Unauthorized", { status: 401 });

  try {
    const devisId = params.id;

    // TODO: Generate PDF from quote data using a library like puppeteer or pdfkit
    // For now, return a placeholder
    const pdfBuffer = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 612 792]/Contents 5 0 R>>endobj4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj5 0 obj<</Length 44>>stream\nBT\n/F1 12 Tf\n100 700 Td\n(Devis) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000266 00000 n\n0000000346 00000 n\ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n437\n%%EOF"
    );

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="devis-${devisId}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Error generating PDF:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
