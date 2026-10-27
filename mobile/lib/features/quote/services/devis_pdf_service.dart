import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Single source of truth for the devis PDF.
///
/// Both the entreprise (quote_success_screen, "devis envoyé par message") and
/// the client (signature_screen, "devis du profil client") render through this
/// service so the two presentations are guaranteed identical (client request
/// to harmonize the devis design).
///
/// The layout is a faithful port of the original `_generatePdf` from
/// quote_success_screen. It is fed a plain [quoteData] map (the same shape that
/// screen builds/saves) plus optional logo/signature image bytes.
class DevisPdfService {
  // Palette — deliberately calm. The old design flooded every header with navy
  // (#0F172A). Per the redesign brief we keep navy only for dark *text*, use a
  // warm beige accent for section headers, and a light neutral for table heads.
  static const _navyInt = 0xFF1F2937; // dark slate — used for text, not fills
  static const _accentInt = 0xFFA18B73; // warm beige — pièce/section accents
  static const _lineInt = 0xFFE7E1D8; // soft divider in the beige family

  // Lot accent rotation — each "nom de pièce" gets its own calm colour so the

  Future<pw.Document> generate({
    required Map<String, dynamic> quoteData,
    Uint8List? logoBytes,
    String? logoPath,
    Uint8List? signatureBytes,
    PdfPageFormat format = PdfPageFormat.a4,
  }) async {
    final pdf = pw.Document();

    final company = quoteData['company'] ?? {};
    final client = quoteData['client'] ?? {};
    final totals = quoteData['totals'] ?? {};
    final expenses = quoteData['expenses'] as Map<String, dynamic>? ?? {};
    final quoteNumber = (quoteData['quoteNumber']?.toString().trim().isNotEmpty == true)
        ? quoteData['quoteNumber'].toString()
        : '${DateTime.now().year}-0001';

    // Professional "LOT" devis config (per-lot labels + per-lot HT).
    final lotsMeta = (quoteData['lots'] is Map)
        ? Map<String, dynamic>.from(quoteData['lots'] as Map)
        : <String, dynamic>{};
    final lotTotals = (quoteData['lotTotals'] is Map)
        ? Map<String, dynamic>.from(quoteData['lotTotals'] as Map)
        : <String, dynamic>{};

    final fontRegular = await PdfGoogleFonts.interRegular();
    final fontBold = await PdfGoogleFonts.interBold();
    // Italic variants must be supplied explicitly — otherwise pw.Text with
    // fontStyle: italic falls back to Helvetica, which has no Unicode support
    // and cannot draw glyphs like "Œ" (MAIN D'ŒUVRE). Registering all four as
    // fontFallback guarantees every glyph resolves through Inter.
    final fontItalic = await PdfGoogleFonts.interItalic();
    final fontBoldItalic = await PdfGoogleFonts.interBoldItalic();
    const colorNavy = PdfColor.fromInt(_navyInt);
    const colorAccent = PdfColor.fromInt(_accentInt);
    const colorLine = PdfColor.fromInt(_lineInt);

    // Entreprise logo for the header (from raw bytes or a local file path).
    pw.ImageProvider? companyLogo;
    if (logoBytes != null) {
      companyLogo = pw.MemoryImage(logoBytes);
    } else if (logoPath != null && logoPath.isNotEmpty) {
      try {
        companyLogo = pw.MemoryImage(File(logoPath).readAsBytesSync());
      } catch (e) {
        debugPrint('Could not load entreprise logo: $e');
      }
    }

    Uint8List? kojiLogoBytes;
    try {
      kojiLogoBytes =
          (await rootBundle.load('assets/icons/LOGO.png')).buffer.asUint8List();
    } catch (e) {
      debugPrint('Could not load Koji logo: $e');
    }

    final siteAddress = (quoteData['siteAddress'] as String?) ?? '';
    final travauxLieu = siteAddress.isNotEmpty
        ? siteAddress
        : (client['address']?.toString() ?? '');
    final travauxStart = (quoteData['travauxStart'] as String?) ?? '';
    final travauxDuration = (quoteData['travauxDuration'] as String?) ?? '';

    pdf.addPage(pw.MultiPage(
        pageTheme: pw.PageTheme(
          pageFormat: format,
          theme: pw.ThemeData.withFont(
            base: fontRegular,
            bold: fontBold,
            italic: fontItalic,
            boldItalic: fontBoldItalic,
            fontFallback: [fontRegular, fontBold, fontItalic, fontBoldItalic],
          ),
          // Very subtle "K" watermark — barely visible, like the reference.
          buildBackground: (context) => pw.Center(
            child: pw.Opacity(
              opacity: 0.02,
              child: pw.Text(
                'K',
                style: pw.TextStyle(
                  font: fontBold,
                  fontSize: 300,
                  fontWeight: pw.FontWeight.bold,
                  color: PdfColors.grey400,
                ),
              ),
            ),
          ),
        ),
        footer: (context) =>
            _buildLegalFooter(context, company, colorAccent, kojiLogoBytes),
        build: (context) {
          return [
            // ── Top line : "Le {date}" (gauche)  ·  {Devis n° + Version} (droite) ──
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text("Le ${quoteData['date']?.toString() ?? ''}",
                    style: const pw.TextStyle(
                        fontSize: 9, color: PdfColors.grey600)),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text("Devis n° : $quoteNumber",
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 12,
                            color: colorNavy)),
                    pw.SizedBox(height: 2),
                    // Version du devis — pour gérer les modifications (01, 02…).
                    pw.Text(
                        "Version N° : ${_versionLabel(quoteData['version'])}",
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey600)),
                  ],
                ),
              ],
            ),

            pw.SizedBox(height: 24),

            // ── Entreprise (gauche) ↔ Client (droite) — plain text ──
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Expanded(
                  child: _identityColumn(
                    "",
                    company['name']?.toString() ?? 'Entreprise',
                    [
                      company['address']?.toString() ?? '',
                      company['phone']?.toString() ?? '',
                      company['email']?.toString() ?? '',
                    ],
                    colorAccent,
                    colorNavy,
                    logo: companyLogo,
                  ),
                ),
                pw.SizedBox(width: 24),
                pw.Expanded(
                  child: _identityColumn(
                    "Client",
                    client['name']?.toString() ?? 'Client',
                    [
                      client['address']?.toString() ?? '',
                      client['phone']?.toString() ?? '',
                      client['email']?.toString() ?? '',
                    ],
                    colorAccent,
                    colorNavy,
                  ),
                ),
              ],
            ),

            pw.SizedBox(height: 20),

            // ── Adresse du chantier (plain) ──
            _kvInline(
                "Adresse du chantier",
                travauxLieu.isNotEmpty ? travauxLieu : 'À compléter',
                colorAccent,
                colorNavy),

            // ── Date de début / Durée — compactes, et UNIQUEMENT si renseignées.
            //     Plus de placeholder "À définir" : un champ vide n'est pas
            //     affiché, ce qui économise de la place sur le devis. ──
            if (travauxStart.isNotEmpty || travauxDuration.isNotEmpty) ...[
              pw.SizedBox(height: 8),
              pw.Row(
                children: [
                  if (travauxStart.isNotEmpty)
                    pw.Expanded(
                      child: _outlinedField("Date prévisionnelle de début",
                          travauxStart, colorAccent, colorNavy, colorLine),
                    ),
                  if (travauxStart.isNotEmpty && travauxDuration.isNotEmpty)
                    pw.SizedBox(width: 12),
                  if (travauxDuration.isNotEmpty)
                    pw.Expanded(
                      child: _outlinedField("Durée estimée des travaux",
                          travauxDuration, colorAccent, colorNavy, colorLine),
                    ),
                ],
              ),
            ],

            // ── Texte de description (optionnel) ──
            if (((quoteData['description'] as String?)?.trim() ?? '')
                .isNotEmpty) ...[
              pw.SizedBox(height: 16),
              pw.Text((quoteData['description'] as String).trim(),
                  style: const pw.TextStyle(
                      fontSize: 10, lineSpacing: 2, color: PdfColors.grey800)),
            ],

            pw.SizedBox(height: 20),

            // ── "Description des travaux" — titre placé directement
            //     au-dessus du tableau (toujours affiché). ──
            pw.Text("Description des travaux",
                style: pw.TextStyle(
                    fontSize: 11,
                    fontWeight: pw.FontWeight.bold,
                    color: colorNavy)),
            pw.SizedBox(height: 8),

            // ── UN SEUL TABLEAU : un en-tête de colonnes, puis chaque pièce
            //     (salon, chambre…) comme groupe de lignes à l'intérieur. ──
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                _tableHeader(colorNavy),
                ...expenses.entries.toList().asMap().entries.expand((indexed) {
                  final roomId = indexed.value.key;
                  final items = (indexed.value.value as List)
                      .cast<Map<String, dynamic>>();
                  final meta = (lotsMeta[roomId] is Map)
                      ? Map<String, dynamic>.from(lotsMeta[roomId] as Map)
                      : const <String, dynamic>{};
                  final lotTitle =
                      (meta['title']?.toString().trim().isNotEmpty == true)
                          ? meta['title'].toString()
                          : roomId;
                  return _pieceRows(lotTitle, items, colorNavy, colorAccent);
                }),
              ],
            ),

            pw.SizedBox(height: 20),

            // ── RÉCAPITULATIF (per-lot totals + global provisions + TVA) ──
            _buildRecap(
                expenses, lotsMeta, lotTotals, totals, colorNavy, colorAccent),

            pw.SizedBox(height: 16),

            _buildPaymentTerms(company, totals, colorNavy, colorAccent,
                validity: quoteData['validity']?.toString() ?? '',
                colorLine: colorLine),

            pw.SizedBox(height: 20),

            // ── Signatures ──
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text("Signature du client",
                          style: pw.TextStyle(
                              fontSize: 9,
                              fontWeight: pw.FontWeight.bold,
                              color: colorNavy)),
                      pw.SizedBox(height: 4),
                      pw.Text(_faitALe(quoteData),
                          style: const pw.TextStyle(
                              fontSize: 8, color: PdfColors.grey600)),
                      pw.SizedBox(height: 4),
                      pw.Text("Mention manuscrite obligatoire :",
                          style: const pw.TextStyle(
                              fontSize: 8, color: PdfColors.grey600)),
                      pw.Text("« Lu et approuvé, bon pour accord »",
                          style: pw.TextStyle(
                              fontSize: 9,
                              fontStyle: pw.FontStyle.italic,
                              fontWeight: pw.FontWeight.bold,
                              color: colorNavy)),
                      pw.SizedBox(height: 40),
                    ],
                  ),
                ),
                pw.SizedBox(width: 24),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.center,
                  children: [
                    pw.Text("Signature de l'entreprise",
                        style: pw.TextStyle(
                            fontSize: 9,
                            fontWeight: pw.FontWeight.bold,
                            color: colorNavy)),
                    pw.SizedBox(height: 8),
                    if (signatureBytes != null)
                      pw.Container(
                          height: 50,
                          width: 90,
                          child: pw.Image(pw.MemoryImage(signatureBytes),
                              fit: pw.BoxFit.contain))
                    else
                      pw.SizedBox(height: 50),
                  ],
                ),
              ],
            ),

            pw.SizedBox(height: 12),
            pw.Center(
              child: pw.Text(
                  "Ce devis est valable 30 jours. Merci pour votre confiance.",
                  style: const pw.TextStyle(
                      fontSize: 8, color: PdfColors.grey500)),
            ),
          ];
        }));
    return pdf;
  }

  /// Version label for the devis header — "01", "02"… A missing/invalid value
  /// defaults to 1. Accepts an int, a numeric string, or "01" already.
  String _versionLabel(dynamic raw) {
    int n = 1;
    if (raw is num) {
      n = raw.toInt();
    } else if (raw is String) {
      n = int.tryParse(raw.trim()) ?? 1;
    }
    if (n < 1) n = 1;
    return n.toString().padLeft(2, '0');
  }

  /// "Fait à <lieu>, le <date>" — mirrors quote_success_screen._faitALe.
  String _faitALe(Map<String, dynamic> quoteData) {
    final lieu = (quoteData['signatureLieu'] as String?)?.trim() ?? '';
    final rawDate = quoteData['signatureDate'] as String?;
    String dateStr = '____________';
    final dt = rawDate != null ? DateTime.tryParse(rawDate) : null;
    if (dt != null) {
      dateStr =
          '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    }
    if (lieu.isEmpty) return 'Fait à ______________  le $dateStr';
    return 'Fait à $lieu, le $dateStr';
  }

  // ── Small identity helpers ───────────────────────────────────────────────────


  /// Inline "Label : value" used inside the chantier band.
  pw.Widget _kvInline(
      String label, String value, PdfColor colorAccent, PdfColor colorNavy) {
    return pw.RichText(
      text: pw.TextSpan(
        children: [
          pw.TextSpan(
              text: '$label : ',
              style: pw.TextStyle(
                  fontSize: 9,
                  fontWeight: pw.FontWeight.bold,
                  color: colorAccent)),
          pw.TextSpan(
              text: value,
              style: pw.TextStyle(
                  fontSize: 10,
                  fontWeight: pw.FontWeight.bold,
                  color: colorNavy)),
        ],
      ),
    );
  }

  /// A bordered identity card (Entreprise / Client) — mirrors the two facing
  /// boxes in the hand sketch. Optional logo shown for the entreprise side.
  /// Plain identity column (Entreprise / Client) — a small accent label, the
  /// name in bold, then the detail lines as plain grey text. No box, no border.
  pw.Widget _identityColumn(String title, String name, List<String> lines,
      PdfColor colorAccent, PdfColor colorNavy,
      {pw.ImageProvider? logo}) {
    final visibleLines = lines.where((l) => l.trim().isNotEmpty).toList();

    // The textual block: optional accent label, bold name, then detail lines.
    final textBlock = pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        if (title.trim().isNotEmpty) ...[
          pw.Text(title, style: pw.TextStyle(fontSize: 9, color: colorAccent)),
          pw.SizedBox(height: 3),
        ],
        pw.Text(name,
            style: pw.TextStyle(
                fontSize: 12,
                fontWeight: pw.FontWeight.bold,
                color: colorNavy)),
        ...visibleLines.map((l) => pw.Padding(
              padding: const pw.EdgeInsets.only(top: 1),
              child: pw.Text(l,
                  style:
                      const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
            )),
      ],
    );

    // Logo (entreprise) sits to the LEFT of the information; the rest of the
    // identity (name + details) flows to its right. When there is no logo we
    // simply return the text block on its own.
    if (logo == null) return textBlock;
    return pw.Row(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Container(
          height: 48,
          width: 48,
          margin: const pw.EdgeInsets.only(right: 10),
          child: pw.Image(logo, fit: pw.BoxFit.contain),
        ),
        pw.Expanded(child: textBlock),
      ],
    );
  }

  /// A light-bordered field box (Date de début / Durée) with a small label
  /// above the value, matching the reference devis.
  pw.Widget _outlinedField(String label, String value, PdfColor colorAccent,
      PdfColor colorNavy, PdfColor colorLine) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: colorLine),
        borderRadius: pw.BorderRadius.circular(5),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(label,
              style: pw.TextStyle(fontSize: 7, color: colorAccent)),
          pw.SizedBox(height: 2),
          pw.Text(value,
              style: pw.TextStyle(fontSize: 9, color: colorNavy)),
        ],
      ),
    );
  }

  // ── LOT rendering ────────────────────────────────────────────────────────────
  static double _num(dynamic v) => (v as num?)?.toDouble() ?? 0.0;

  /// Column header — solid navy bar with white text, matching the client's
  /// reference: DÉSIGNATION · QTÉ · UNITÉ · P.UNIT HT · TOTAL HT.
  pw.Widget _tableHeader(PdfColor colorNavy) {
    pw.Widget cell(String t, int flex, pw.TextAlign align) => pw.Expanded(
        flex: flex,
        child: pw.Text(t,
            style: pw.TextStyle(
                fontSize: 8,
                fontWeight: pw.FontWeight.bold,
                color: PdfColors.white),
            textAlign: align));
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      color: colorNavy,
      child: pw.Row(children: [
        cell('DÉSIGNATION', 5, pw.TextAlign.left),
        cell('QTÉ', 1, pw.TextAlign.center),
        cell('UNITÉ', 1, pw.TextAlign.center),
        cell('P.UNIT HT', 2, pw.TextAlign.center),
        cell('TOTAL HT', 2, pw.TextAlign.right),
      ]),
    );
  }

  /// One priced line — 5 columns matching the header flexes (5·1·1·2·2).
  /// One priced line — plain text, no blue (client: no blue in the table).
  pw.Widget _lineRow(Map<String, dynamic> item, double unitPrice, double total,
      PdfColor colorNavy) {
    final qty = _num(item['quantity']);
    final unite = item['unite']?.toString() ?? '';
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: const pw.BoxDecoration(
          border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey200))),
      child: pw.Row(children: [
        pw.Expanded(
            flex: 5,
            child: pw.Text(item['title']?.toString() ?? 'Prestation',
                style: pw.TextStyle(fontSize: 9, color: colorNavy))),
        pw.Expanded(
            flex: 1,
            child: pw.Text(
                qty == qty.roundToDouble()
                    ? qty.toInt().toString()
                    : qty.toString(),
                style:
                    const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
                textAlign: pw.TextAlign.center)),
        pw.Expanded(
            flex: 1,
            child: pw.Text(unite,
                style:
                    const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
                textAlign: pw.TextAlign.center)),
        pw.Expanded(
            flex: 2,
            child: pw.Text('${unitPrice.toStringAsFixed(2)} €',
                style:
                    const pw.TextStyle(fontSize: 9, color: PdfColors.grey700),
                textAlign: pw.TextAlign.center)),
        pw.Expanded(
            flex: 2,
            child: pw.Text('${total.toStringAsFixed(2)} €',
                style: pw.TextStyle(
                    fontSize: 9,
                    fontWeight: pw.FontWeight.bold,
                    color: colorNavy),
                textAlign: pw.TextAlign.right)),
      ]),
    );
  }

  /// Rows for ONE pièce inside the single shared table (no column header —
  /// that is rendered once, above, in build). Returns, in order:
  ///   • a beige pièce-name band ("salon"…) spanning the table width,
  ///   • the main-d'œuvre lines,
  ///   • a small "Fournitures" label row + fourniture lines — ONLY if the
  ///     pièce actually has fournitures,
  ///   • optional "à votre charge" / "en attente" note blocks.
  List<pw.Widget> _pieceRows(String lotTitle, List<Map<String, dynamic>> items,
      PdfColor colorNavy, PdfColor colorAccent) {
    // Split lines by role. Standalone fournitures (isFourniture) and ouvrage
    // fourniture amounts go to FOURNITURES; labor goes to MAIN D'ŒUVRE.
    final moLines = <pw.Widget>[];
    final fntLines = <pw.Widget>[];
    final chargeLines = <Map<String, dynamic>>[];
    final attenteLines = <Map<String, dynamic>>[];

    for (final item in items) {
      // Commentaire / note libre : annotation interne, JAMAIS rendue sur le
      // devis (ni contractant ni client). Reste éditable dans le récapitulatif.
      if (item['isComment'] == true) continue;
      final type = item['lineType']?.toString() ?? 'normal';
      if (type == 'charge') {
        chargeLines.add(item);
        continue;
      }
      if (type == 'attente') {
        attenteLines.add(item);
        continue;
      }
      final qty = _num(item['quantity']);
      final materialQty = _num(item['materialQuantity'] ?? item['quantity']);
      final labor = _num(item['laborCost']);
      final material = _num(item['materialCost']);
      final isFourniture = item['isFourniture'] == true;
      final hideFournitures = item['hideFournitures'] == true;
      final materialTotal = materialQty * material;
      final visibleLabor =
          hideFournitures && qty > 0 ? labor + materialTotal / qty : labor;

      if (isFourniture) {
        fntLines.add(_lineRow(
            {...item, 'quantity': materialQty}, material, materialTotal,
            colorNavy));
      } else {
        if (visibleLabor > 0) {
          moLines.add(_lineRow(item, visibleLabor, qty * visibleLabor,
              colorNavy));
        }
        if (!hideFournitures && material > 0) {
          fntLines.add(_lineRow(
              {...item, 'quantity': materialQty}, material, materialTotal,
              colorNavy));
        }
      }
    }

    // Pièce-name row — no background band, just the colored bold word.
    pw.Widget pieceBand() => pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: pw.Text(lotTitle,
              style: pw.TextStyle(
                  fontSize: 11,
                  fontWeight: pw.FontWeight.bold,
                  color: colorAccent)),
        );

    // Small "Fournitures" sub-label — rendered ONLY when the pièce has
    // fournitures. No background band, just the colored bold word.
    pw.Widget fournituresLabel() => pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: pw.Text('Fournitures',
              style: pw.TextStyle(
                  fontSize: 9,
                  fontWeight: pw.FontWeight.bold,
                  color: colorAccent)),
        );

    pw.Widget noteBlock(String header, List<Map<String, dynamic>> lines,
        PdfColor bg, PdfColor fg) {
      if (lines.isEmpty) return pw.SizedBox();
      return pw.Container(
        margin: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        padding: const pw.EdgeInsets.all(8),
        decoration: pw.BoxDecoration(
            color: bg, borderRadius: pw.BorderRadius.circular(4)),
        child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(header,
                  style: pw.TextStyle(
                      fontSize: 8, fontWeight: pw.FontWeight.bold, color: fg)),
              pw.SizedBox(height: 2),
              ...lines.map((l) => pw.Padding(
                  padding: const pw.EdgeInsets.only(top: 2),
                  child: pw.Text('• ${l['title'] ?? ''}',
                      style: pw.TextStyle(fontSize: 8, color: fg)))),
            ]),
      );
    }

    // Lot sans aucune ligne visible (ex. uniquement une note, désormais
    // masquée) : ne pas afficher un titre de lot vide.
    if (moLines.isEmpty &&
        fntLines.isEmpty &&
        chargeLines.isEmpty &&
        attenteLines.isEmpty) {
      return <pw.Widget>[];
    }

    return [
      pieceBand(),
      ...moLines,
      // Fournitures only if the pièce actually has any.
      if (fntLines.isNotEmpty) ...[
        fournituresLabel(),
        ...fntLines,
      ],
      noteBlock('FOURNITURE À VOTRE CHARGE', chargeLines,
          const PdfColor.fromInt(0xFFFFF7ED),
          const PdfColor.fromInt(0xFFB45309)),
      noteBlock('EN ATTENTE DE VOTRE DÉCISION', attenteLines,
          const PdfColor.fromInt(0xFFF1F5F9), PdfColors.grey700),
    ];
  }

  /// The récapitulatif block: each lot's HT, the three global provisions,
  /// TOTAL GÉNÉRAL H.T., TVA (at the chosen rate), TOTAL GÉNÉRAL T.T.C.
  pw.Widget _buildRecap(
      Map<String, dynamic> expenses,
      Map<String, dynamic> lotsMeta,
      Map<String, dynamic> lotTotals,
      Map<dynamic, dynamic> totals,
      PdfColor colorNavy,
      PdfColor colorAccent) {
    pw.Widget row(String label, String value,
        {bool bold = false, double size = 10, PdfColor? color}) {
      final c = color ?? colorNavy;
      return pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 3),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(label,
                style: pw.TextStyle(
                    fontSize: size,
                    fontWeight:
                        bold ? pw.FontWeight.bold : pw.FontWeight.normal,
                    color: c)),
            pw.Text(value,
                style: pw.TextStyle(
                    fontSize: size, fontWeight: pw.FontWeight.bold, color: c)),
          ],
        ),
      );
    }

    final coordPct = _num(totals['coordPct']);
    final aleasPct = _num(totals['aleasPct']);
    final decennalePct = _num(totals['decennalePct']);
    final coordAmount = _num(totals['coordAmount']);
    final aleasAmount = _num(totals['aleasAmount']);
    final decennaleAmount = _num(totals['decennaleAmount']);
    final generalHT = _num(totals['ht']);
    final tvaRate = (totals['tvaRate'] as num?)?.toInt() ?? 20;
    final tva = _num(totals['tva']);
    final ttc = _num(totals['ttc']);

    String pct(double v) =>
        v == v.roundToDouble() ? v.toInt().toString() : v.toString();

    // Compact totals block pinned to the right, like the client's reference:
    // (optional provisions) → Total HT → TVA → navy Total TTC bar.
    final totalsBox = pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        if (coordAmount != 0)
          row('Coordination de chantier (${pct(coordPct)} %)',
              '${coordAmount.toStringAsFixed(2)} €',
              size: 9, color: PdfColors.grey700),
        if (aleasAmount != 0)
          row('Provision aléas de chantier (${pct(aleasPct)} %)',
              '${aleasAmount.toStringAsFixed(2)} €',
              size: 9, color: PdfColors.grey700),
        if (decennaleAmount != 0)
          row('Assurance décennale (${pct(decennalePct)} %)',
              '${decennaleAmount.toStringAsFixed(2)} €',
              size: 9, color: PdfColors.grey700),
        if (coordAmount != 0 || aleasAmount != 0 || decennaleAmount != 0)
          pw.Divider(color: PdfColors.grey300),
        row('Total HT', '${generalHT.toStringAsFixed(2)} €', size: 10),
        row('TVA $tvaRate %', '${tva.toStringAsFixed(2)} €',
            size: 10, color: PdfColors.grey700),
        pw.SizedBox(height: 6),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 9),
          color: colorNavy,
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text('Total TTC',
                  style: pw.TextStyle(
                      fontSize: 12,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.white)),
              pw.Text('${ttc.toStringAsFixed(2)} €',
                  style: pw.TextStyle(
                      fontSize: 13,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.white)),
            ],
          ),
        ),
      ],
    );

    // Right-align the box: empty flex on the left, box on the right.
    return pw.Row(
      children: [
        pw.Spacer(flex: 2),
        pw.Expanded(flex: 3, child: totalsBox),
      ],
    );
  }

  pw.Widget _buildPaymentTerms(Map<dynamic, dynamic> company,
      Map<dynamic, dynamic> totals, PdfColor colorNavy, PdfColor colorAccent,
      {String validity = '', PdfColor? colorLine}) {
    final line = colorLine ?? PdfColors.grey300;
    final iban = (company['iban']?.toString() ?? '').trim();
    final bic = (company['bic']?.toString() ?? '').trim();
    final titulaire = (company['name']?.toString() ?? '').trim();

    // Client reference: the key labels (IBAN, BIC/SWIFT, Délai…) are blue.
    const colorBlue = PdfColor.fromInt(0xFF2563EB);
    pw.Widget kv(String label, String value) => pw.RichText(
          text: pw.TextSpan(children: [
            pw.TextSpan(
                text: '$label : ',
                style: const pw.TextStyle(fontSize: 9, color: colorBlue)),
            pw.TextSpan(
                text: value,
                style: pw.TextStyle(fontSize: 9, color: colorNavy)),
          ]),
        );

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        // ── Informations de paiement (bordered box) ──
        pw.Container(
          width: double.infinity,
          padding: const pw.EdgeInsets.all(12),
          decoration: pw.BoxDecoration(
            border: pw.Border.all(color: line),
            borderRadius: pw.BorderRadius.circular(6),
          ),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text("Informations de paiement",
                  style: pw.TextStyle(
                      fontSize: 11,
                      fontWeight: pw.FontWeight.bold,
                      color: colorNavy)),
              pw.SizedBox(height: 8),
              pw.Row(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Expanded(
                    child: pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        kv("IBAN", iban.isNotEmpty ? iban : 'À compléter'),
                        pw.SizedBox(height: 3),
                        kv("Titulaire du compte",
                            titulaire.isNotEmpty ? titulaire : 'À compléter'),
                      ],
                    ),
                  ),
                  pw.Expanded(
                    child: kv(
                        "BIC/SWIFT", bic.isNotEmpty ? bic : 'À compléter'),
                  ),
                ],
              ),
            ],
          ),
        ),

        pw.SizedBox(height: 16),

        // ── Conditions de règlement ──
        pw.Text("Conditions de règlement",
            style: pw.TextStyle(
                fontSize: 11,
                fontWeight: pw.FontWeight.bold,
                color: colorNavy)),
        pw.SizedBox(height: 6),
        kv("Délai de paiement", "30 jours"),
        pw.SizedBox(height: 3),
        kv("Validité du devis", validity.isNotEmpty ? validity : '30 jours'),
      ],
    );
  }

  pw.Widget _buildLegalFooter(pw.Context context, Map<dynamic, dynamic> company,
      PdfColor colorAccent, Uint8List? kojiLogoBytes) {
    // Footer layout requested by the client:
    //   ① Gauche  — « Edited by Koji » + logo Koji
    //   ② Centre  — nom entreprise, forme juridique (SAS), capital social,
    //               numéro de TVA, numéro SIRET
    //   ③ Droite  — numéro de page
    final name = company['name']?.toString() ?? '';
    final legalForm = company['formeJuridique']?.toString() ?? '';
    final capital = company['capital']?.toString() ?? '';
    final tva = company['tva']?.toString() ?? '';
    final siret = company['siret']?.toString() ?? '';

    // Centre lines (only the ones that exist).
    final centerLines = <String>[];
    if (name.isNotEmpty) {
      centerLines.add(legalForm.isNotEmpty ? '$name – $legalForm' : name);
    } else if (legalForm.isNotEmpty) {
      centerLines.add(legalForm);
    }
    if (capital.isNotEmpty) centerLines.add('Capital social : $capital');
    if (tva.isNotEmpty) centerLines.add('TVA : $tva');
    if (siret.isNotEmpty) centerLines.add('SIRET : $siret');

    return pw.Container(
      margin: const pw.EdgeInsets.only(top: 8),
      padding: const pw.EdgeInsets.only(top: 6),
      decoration: const pw.BoxDecoration(
        border:
            pw.Border(top: pw.BorderSide(color: PdfColors.grey300, width: 0.5)),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          // ① Gauche — « Edited by Koji » + logo.
          pw.Expanded(
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              children: [
                if (kojiLogoBytes != null) ...[
                  pw.Image(pw.MemoryImage(kojiLogoBytes), width: 9, height: 9),
                  pw.SizedBox(width: 3),
                ],
                pw.Text(
                  'Edited by Koji',
                  style: pw.TextStyle(
                      fontSize: 7,
                      fontWeight: pw.FontWeight.bold,
                      color: colorAccent),
                ),
              ],
            ),
          ),
          // ② Centre — identité légale de l'entreprise.
          pw.Expanded(
            flex: 2,
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.center,
              mainAxisSize: pw.MainAxisSize.min,
              children: centerLines
                  .map((l) => pw.Text(l,
                      textAlign: pw.TextAlign.center,
                      style: const pw.TextStyle(
                          fontSize: 7, color: PdfColors.grey600)))
                  .toList(),
            ),
          ),
          // ③ Droite — numéro de page.
          pw.Expanded(
            child: pw.Text(
              'Page ${context.pageNumber} / ${context.pagesCount}',
              textAlign: pw.TextAlign.right,
              style: const pw.TextStyle(fontSize: 7, color: PdfColors.grey500),
            ),
          ),
        ],
      ),
    );
  }
}
