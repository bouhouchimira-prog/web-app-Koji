import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Builds the PDF for a single facture.
///
/// A facture is a distinct document from the devis: it has its own number
/// (FAC-YYYY-NNNN), its own type (acompte / intermédiaire / finale), and — for
/// a final invoice — it lists every acompte already invoiced as a deducted line
/// so the "reste à payer" is computed automatically and is juridiquement
/// propre. It reuses the devis PDF's visual language (Inter fonts, navy/accent
/// palette, company header, Koji watermark) for a consistent rendering.
class InvoicePdfService {
  static const _navy = 0xFF0F172A;
  static const _accent = 0xFFA18B73;

  /// Generate the document for [invoice]. [priorInvoices] are the chantier's
  /// other invoices (used to deduct already-paid acomptes on a final invoice).
  Future<pw.Document> build({
    required Map<String, dynamic> invoice,
    List<Map<String, dynamic>> priorInvoices = const [],
  }) async {
    final pdf = pw.Document();

    final fontRegular = await PdfGoogleFonts.interRegular();
    final fontBold = await PdfGoogleFonts.interBold();
    const colorNavy = PdfColor.fromInt(_navy);
    const colorAccent = PdfColor.fromInt(_accent);

    final company = await _loadCompany();
    Uint8List? logoBytes = company['logoBytes'] as Uint8List?;

    pw.MemoryImage? watermark;
    try {
      final bytes =
          (await rootBundle.load('assets/icons/LOGO.png')).buffer.asUint8List();
      watermark = pw.MemoryImage(bytes);
    } catch (e) {
      debugPrint('Could not load Koji watermark: $e');
    }

    final reference = invoice['reference'] as String? ?? 'FAC-XXXX';
    final type = invoice['type'] as String? ?? 'intermediaire';
    final amountTtc = (invoice['amount'] as num?)?.toDouble() ?? 0;
    final quoteTotal = (invoice['quote_total'] as num?)?.toDouble() ?? 0;
    final percent = (invoice['percent'] as num?)?.toDouble();
    final note = invoice['note'] as String? ?? '';
    final clientName = invoice['client_name'] as String? ?? 'Client';
    final clientEmail = invoice['client_email'] as String? ?? '';
    final issuedAt = invoice['issued_at'] as String?;
    final dateStr = _fmtDate(issuedAt) ?? _fmtDate(DateTime.now().toIso8601String())!;

    // VAT: derive from the same 20% assumption used across the devis flow.
    // amount is treated as TTC, mirroring the billing summary in the UI.
    final amountHt = amountTtc / 1.2;
    final amountTva = amountTtc - amountHt;

    // For a final invoice, deduct every acompte already invoiced.
    final acomptes = type == 'finale'
        ? priorInvoices
            .where((inv) =>
                (inv['type'] as String?) == 'acompte' &&
                inv['id'] != invoice['id'])
            .toList()
        : <Map<String, dynamic>>[];
    final double acompteTotal = acomptes.fold<double>(
        0, (sum, inv) => sum + ((inv['amount'] as num?)?.toDouble() ?? 0));
    final resteAPayer = amountTtc - acompteTotal;

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
          // ── Header: company + invoice number ──
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
                    pw.Text(company['name'] ?? 'Koji',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 16,
                            color: colorNavy)),
                    pw.Text(company['address'] ?? '',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text(company['phone'] ?? '',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                    pw.Text(company['email'] ?? '',
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
                    pw.Text("FACTURE N°",
                        style: const pw.TextStyle(fontSize: 8, color: colorAccent)),
                    pw.Text(reference,
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 12,
                            color: colorNavy)),
                    pw.SizedBox(height: 2),
                    pw.Text(_typeLabel(type).toUpperCase(),
                        style: const pw.TextStyle(fontSize: 8, color: colorAccent)),
                  ],
                ),
              ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Divider(color: PdfColors.grey300),
          pw.SizedBox(height: 16),

          // ── Client + date ──
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text("CLIENT",
                      style: pw.TextStyle(
                          fontSize: 8,
                          fontWeight: pw.FontWeight.bold,
                          color: colorAccent)),
                  pw.SizedBox(height: 4),
                  pw.Text(clientName,
                      style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold,
                          fontSize: 12,
                          color: colorNavy)),
                  if (clientEmail.isNotEmpty)
                    pw.Text(clientEmail,
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                ],
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text("DATE",
                      style: pw.TextStyle(
                          fontSize: 8,
                          fontWeight: pw.FontWeight.bold,
                          color: colorAccent)),
                  pw.Text(dateStr,
                      style: const pw.TextStyle(fontSize: 11, color: colorNavy)),
                ],
              ),
            ],
          ),

          pw.SizedBox(height: 20),

          // ── Line table ──
          pw.Container(
            padding:
                const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: pw.BoxDecoration(
                color: colorNavy, borderRadius: pw.BorderRadius.circular(6)),
            child: pw.Row(children: [
              pw.Expanded(
                  flex: 5,
                  child: pw.Text("DÉSIGNATION",
                      style: pw.TextStyle(
                          fontSize: 9,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.white))),
              pw.Expanded(
                  flex: 2,
                  child: pw.Text("MONTANT HT",
                      style: pw.TextStyle(
                          fontSize: 9,
                          fontWeight: pw.FontWeight.bold,
                          color: PdfColors.white),
                      textAlign: pw.TextAlign.right)),
            ]),
          ),
          _line(
            _designation(type, percent, quoteTotal, note),
            '${_money(amountHt)} €',
            colorNavy,
          ),

          pw.SizedBox(height: 20),

          // ── Financial summary ──
          pw.Container(
            padding: const pw.EdgeInsets.all(16),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: colorAccent),
              borderRadius: pw.BorderRadius.circular(8),
              color: PdfColors.white,
            ),
            child: pw.Column(children: [
              _sumRow("Total HT", '${_money(amountHt)} €', colorNavy),
              pw.SizedBox(height: 6),
              _sumRow("TVA 20%", '${_money(amountTva)} €', colorNavy),
              pw.SizedBox(height: 8),
              pw.Divider(color: PdfColors.grey300),
              pw.SizedBox(height: 8),
              _sumRow("Total TTC", '${_money(amountTtc)} €', colorNavy,
                  big: true),
              // Final invoice: deduct already-paid acomptes.
              if (type == 'finale' && acompteTotal > 0) ...[
                pw.SizedBox(height: 8),
                ...acomptes.map((inv) {
                  final ref = inv['reference'] as String? ?? 'Acompte';
                  final a = (inv['amount'] as num?)?.toDouble() ?? 0;
                  return pw.Padding(
                    padding: const pw.EdgeInsets.only(top: 4),
                    child: _sumRow(
                      "Acompte déjà versé ($ref)",
                      '- ${_money(a)} €',
                      PdfColors.grey700,
                    ),
                  );
                }),
                pw.SizedBox(height: 8),
                pw.Divider(color: PdfColors.grey300),
                pw.SizedBox(height: 8),
                _sumRow("RESTE À PAYER", '${_money(resteAPayer)} €', colorNavy,
                    big: true),
              ],
            ]),
          ),

          if (note.isNotEmpty) ...[
            pw.SizedBox(height: 16),
            pw.Container(
              padding: const pw.EdgeInsets.all(10),
              decoration: pw.BoxDecoration(
                color: PdfColors.grey50,
                borderRadius: pw.BorderRadius.circular(6),
                border: pw.Border.all(color: PdfColors.grey200),
              ),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text("NOTE",
                      style: pw.TextStyle(
                          fontSize: 8,
                          fontWeight: pw.FontWeight.bold,
                          color: colorAccent)),
                  pw.SizedBox(height: 4),
                  pw.Text(note,
                      style: const pw.TextStyle(
                          fontSize: 9, color: PdfColors.grey800)),
                ],
              ),
            ),
          ],

          pw.SizedBox(height: 24),

          // ── Legal mentions ──
          pw.Container(
            padding: const pw.EdgeInsets.all(10),
            decoration: pw.BoxDecoration(
              color: PdfColors.grey50,
              borderRadius: pw.BorderRadius.circular(6),
              border: pw.Border.all(color: PdfColors.grey200),
            ),
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text("MENTIONS LÉGALES",
                    style: pw.TextStyle(
                        fontSize: 8,
                        fontWeight: pw.FontWeight.bold,
                        color: colorAccent)),
                pw.SizedBox(height: 4),
                pw.Text(
                    "Facture émise en référence au devis signé. TVA 20% sauf mention contraire.",
                    style: const pw.TextStyle(
                        fontSize: 9, color: PdfColors.grey800)),
                pw.Text(
                    "En cas de retard de paiement, des pénalités sont exigibles (art. L441-10 du Code de commerce).",
                    style: const pw.TextStyle(
                        fontSize: 9, color: PdfColors.grey800)),
              ],
            ),
          ),

          pw.SizedBox(height: 16),
          pw.Center(
            child: pw.Text("Merci pour votre confiance.",
                style:
                    const pw.TextStyle(fontSize: 8, color: PdfColors.grey500)),
          ),
        ],
      ),
    );

    return pdf;
  }

  /// Render and open the OS share sheet for [invoice].
  Future<void> share({
    required Map<String, dynamic> invoice,
    List<Map<String, dynamic>> priorInvoices = const [],
  }) async {
    final pdf = await build(invoice: invoice, priorInvoices: priorInvoices);
    final bytes = await pdf.save();
    final ref = invoice['reference'] as String? ?? 'facture';
    await Printing.sharePdf(bytes: bytes, filename: '$ref.pdf');
  }

  /// Render and open the system print/preview dialog for [invoice].
  Future<void> preview({
    required Map<String, dynamic> invoice,
    List<Map<String, dynamic>> priorInvoices = const [],
  }) async {
    final pdf = await build(invoice: invoice, priorInvoices: priorInvoices);
    await Printing.layoutPdf(onLayout: (format) async => pdf.save());
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> _loadCompany() async {
    final result = <String, dynamic>{};
    try {
      final client = Supabase.instance.client;
      final uid = client.auth.currentUser?.id;
      if (uid != null) {
        final res = await client
            .from('users')
            .select('business_info, logo_url')
            .eq('id', uid)
            .maybeSingle();
        if (res != null) {
          // Company details live in the `business_info` JSONB column, same as
          // the company profile screen and the devis flow read them.
          final info =
              (res['business_info'] as Map?)?.cast<String, dynamic>() ?? {};
          result['name'] = info['raisonSociale'] as String?;
          result['address'] = info['address'] as String?;
          result['phone'] = info['phone'] as String?;
          result['email'] = info['emailPro'] as String?;
          final logoUrl = res['logo_url'] as String?;
          if (logoUrl != null && logoUrl.isNotEmpty) {
            try {
              final response = await HttpClient().getUrl(Uri.parse(logoUrl));
              final imageResponse = await response.close();
              result['logoBytes'] =
                  await consolidateHttpClientResponseBytes(imageResponse);
            } catch (e) {
              debugPrint('Could not fetch company logo: $e');
            }
          }
        }
      }
    } catch (e) {
      debugPrint('Could not load company info for invoice: $e');
    }
    return result;
  }

  pw.Widget _line(String designation, String amount, PdfColor navy) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: const pw.BoxDecoration(
          border:
              pw.Border(bottom: pw.BorderSide(color: PdfColors.grey200))),
      child: pw.Row(children: [
        pw.Expanded(
            flex: 5,
            child: pw.Text(designation,
                style: pw.TextStyle(fontSize: 10, color: navy))),
        pw.Expanded(
            flex: 2,
            child: pw.Text(amount,
                style: pw.TextStyle(
                    fontSize: 10, fontWeight: pw.FontWeight.bold, color: navy),
                textAlign: pw.TextAlign.right)),
      ]),
    );
  }

  pw.Widget _sumRow(String label, String value, PdfColor navy,
      {bool big = false}) {
    return pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: [
        pw.Text(label,
            style: pw.TextStyle(
                fontSize: big ? 14 : 11,
                fontWeight: big ? pw.FontWeight.bold : pw.FontWeight.normal,
                color: big ? navy : PdfColors.grey700)),
        pw.Text(value,
            style: pw.TextStyle(
                fontSize: big ? 16 : 11,
                fontWeight: pw.FontWeight.bold,
                color: navy)),
      ],
    );
  }

  String _designation(
      String type, double? percent, double quoteTotal, String note) {
    final base = switch (type) {
      'acompte' => 'Acompte sur travaux',
      'finale' => 'Facture de solde des travaux',
      'complementaire' =>
        'Facture complémentaire — travaux / fournitures supplémentaires',
      _ => 'Facture intermédiaire — travaux en cours',
    };
    final parts = <String>[base];
    if (percent != null && percent > 0) {
      parts.add('(${percent.toStringAsFixed(0)} % du devis signé'
          '${quoteTotal > 0 ? ' de ${_money(quoteTotal)} €' : ''})');
    }
    return parts.join(' ');
  }

  static String _typeLabel(String type) => switch (type) {
        'acompte' => 'Acompte',
        'finale' => 'Solde',
        'complementaire' => 'Complémentaire',
        _ => 'Intermédiaire',
      };

  static String _money(double v) => v.toStringAsFixed(2).replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+\.)'),
        (m) => '${m[1]} ',
      );

  static String? _fmtDate(String? iso) {
    if (iso == null) return null;
    final dt = DateTime.tryParse(iso);
    if (dt == null) return null;
    return DateFormat('dd/MM/yyyy').format(dt);
  }
}
