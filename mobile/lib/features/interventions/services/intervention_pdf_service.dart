import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/interventions/models/intervention.dart';

/// Builds the PDF for a single intervention/diagnostic report. Follows
/// InvoicePdfService/DevisPdfService's visual language (Inter fonts,
/// navy/accent palette, company header, Koji watermark) for consistency.
class InterventionPdfService {
  static const _navy = 0xFF0F172A;
  static const _accent = 0xFFA18B73;

  Future<pw.Document> build(Intervention intervention) async {
    final pdf = pw.Document();

    final fontRegular = await PdfGoogleFonts.interRegular();
    final fontBold = await PdfGoogleFonts.interBold();
    const colorNavy = PdfColor.fromInt(_navy);
    const colorAccent = PdfColor.fromInt(_accent);

    final company = intervention.companySnapshot;
    Uint8List? logoBytes;
    final logoUrl = company['logoUrl'] as String?;
    if (logoUrl != null && logoUrl.isNotEmpty) {
      try {
        final response = await HttpClient().getUrl(Uri.parse(logoUrl));
        final imageResponse = await response.close();
        logoBytes = await consolidateHttpClientResponseBytes(imageResponse);
      } catch (e) {
        debugPrint('Could not fetch company logo: $e');
      }
    }

    Uint8List? signatureBytes;
    if (intervention.signatureImagePath != null) {
      try {
        signatureBytes = await Supabase.instance.client.storage
            .from('intervention-signatures')
            .download(intervention.signatureImagePath!);
      } catch (e) {
        debugPrint('Could not fetch intervention signature: $e');
      }
    }

    pw.MemoryImage? watermark;
    try {
      final bytes =
          (await rootBundle.load('assets/icons/LOGO.png')).buffer.asUint8List();
      watermark = pw.MemoryImage(bytes);
    } catch (e) {
      debugPrint('Could not load Koji watermark: $e');
    }

    pdf.addPage(
      pw.MultiPage(
        pageTheme: pw.PageTheme(
          pageFormat: PdfPageFormat.a4,
          margin: const pw.EdgeInsets.all(32),
          theme: pw.ThemeData.withFont(base: fontRegular, bold: fontBold),
          buildBackground: (ctx) => watermark == null
              ? pw.SizedBox()
              : pw.Center(
                  child: pw.Opacity(
                    opacity: 0.04,
                    child: pw.Image(watermark, width: 320, height: 320),
                  ),
                ),
        ),
        build: (context) => [
          // ── Header: company + report reference ──
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Container(
                width: 54,
                height: 54,
                decoration: pw.BoxDecoration(
                  color: colorNavy,
                  borderRadius: pw.BorderRadius.circular(8),
                  image: logoBytes != null
                      ? pw.DecorationImage(
                          image: pw.MemoryImage(logoBytes), fit: pw.BoxFit.cover)
                      : null,
                ),
                child: logoBytes == null
                    ? pw.Center(child: pw.PdfLogo(color: PdfColors.white))
                    : null,
              ),
              pw.SizedBox(width: 14),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text((company['name'] as String?) ?? 'Koji',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 16,
                            color: colorNavy)),
                    pw.Text((company['address'] as String?) ?? '',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text((company['phone'] as String?) ?? '',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text((company['email'] as String?) ?? '',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                  ],
                ),
              ),
              pw.Container(
                padding:
                    const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: pw.BoxDecoration(
                  color: PdfColors.grey100,
                  borderRadius: pw.BorderRadius.circular(6),
                ),
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text("RAPPORT N°",
                        style: const pw.TextStyle(fontSize: 8, color: colorAccent)),
                    pw.Text(intervention.reference,
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 12,
                            color: colorNavy)),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Divider(color: PdfColors.grey300),
          pw.SizedBox(height: 16),

          // ── Client + site + date ──
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    _label("CLIENT", colorAccent),
                    pw.Text(intervention.client,
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 12,
                            color: colorNavy)),
                    if ((intervention.site ?? '').isNotEmpty)
                      pw.Text(intervention.site!,
                          style: const pw.TextStyle(
                              fontSize: 9, color: PdfColors.grey600)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  _label("DATE", colorAccent),
                  pw.Text(DateFormat('dd/MM/yyyy').format(intervention.date),
                      style: const pw.TextStyle(fontSize: 11, color: colorNavy)),
                ],
              ),
            ],
          ),

          pw.SizedBox(height: 20),

          if ((intervention.equipement ?? '').isNotEmpty)
            _section("ÉQUIPEMENT", intervention.equipement!, colorAccent),
          if ((intervention.constat ?? '').isNotEmpty)
            _section("CONSTAT", intervention.constat!, colorAccent),
          if ((intervention.analyse ?? '').isNotEmpty)
            _section("ANALYSE", intervention.analyse!, colorAccent),
          if ((intervention.preconisations ?? '').isNotEmpty)
            _section("PRÉCONISATIONS", intervention.preconisations!, colorAccent),

          pw.SizedBox(height: 24),

          // ── Signature ──
          if (signatureBytes != null || (intervention.signature ?? '').isNotEmpty) ...[
            _label("SIGNATURE", colorAccent),
            pw.SizedBox(height: 6),
            if (signatureBytes != null)
              pw.Container(
                height: 80,
                alignment: pw.Alignment.centerLeft,
                child: pw.Image(pw.MemoryImage(signatureBytes), height: 70),
              ),
            if ((intervention.signature ?? '').isNotEmpty)
              pw.Text(intervention.signature!,
                  style: pw.TextStyle(
                      fontSize: 10, fontStyle: pw.FontStyle.italic, color: colorNavy)),
          ],

          pw.SizedBox(height: 16),
          pw.Center(
            child: pw.Text("Rapport d'intervention généré via Koji.",
                style:
                    const pw.TextStyle(fontSize: 8, color: PdfColors.grey500)),
          ),
        ],
      ),
    );

    return pdf;
  }

  Future<void> share(Intervention intervention) async {
    final pdf = await build(intervention);
    final bytes = await pdf.save();
    await Printing.sharePdf(
        bytes: bytes, filename: '${intervention.reference}.pdf');
  }

  Future<void> preview(Intervention intervention) async {
    final pdf = await build(intervention);
    await Printing.layoutPdf(onLayout: (format) async => pdf.save());
  }

  pw.Widget _label(String text, PdfColor color) => pw.Text(text,
      style: pw.TextStyle(
          fontSize: 8, fontWeight: pw.FontWeight.bold, color: color));

  pw.Widget _section(String title, String body, PdfColor accent) {
    return pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 14),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          _label(title, accent),
          pw.SizedBox(height: 4),
          pw.Text(body,
              style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey800)),
        ],
      ),
    );
  }
}
