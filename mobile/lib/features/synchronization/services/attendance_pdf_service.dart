import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/models/attendance_entry.dart';
import 'package:koji/features/synchronization/repositories/attendance_repository.dart';

/// Monthly hours-sheet export for one worker, mirroring web's
/// GET /api/attendance/pdf. Follows InvoicePdfService's visual language.
class AttendancePdfService {
  static const _navy = 0xFF0F172A;
  static const _accent = 0xFFA18B73;

  Future<pw.Document> build({
    required Worker worker,
    required DateTime month,
  }) async {
    final pdf = pw.Document();
    final fontRegular = await PdfGoogleFonts.interRegular();
    final fontBold = await PdfGoogleFonts.interBold();
    const colorNavy = PdfColor.fromInt(_navy);
    const colorAccent = PdfColor.fromInt(_accent);

    final monthStart = DateTime(month.year, month.month, 1);
    final monthEnd = DateTime(month.year, month.month + 1, 0);

    final entries = await AttendanceRepository(Supabase.instance.client)
        .getForWorker(worker.id, from: monthStart, to: monthEnd);
    entries.sort((a, b) => a.date.compareTo(b.date));

    final totalMinutes = entries.fold<int>(0, (s, e) => s + e.durationMinutes);

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
          pw.Text('Relevé d\'heures',
              style: pw.TextStyle(
                  fontWeight: pw.FontWeight.bold, fontSize: 18, color: colorNavy)),
          pw.SizedBox(height: 4),
          pw.Text('${worker.firstName} ${worker.lastName} — ${DateFormat('MMMM yyyy', 'fr_FR').format(month)}',
              style: const pw.TextStyle(fontSize: 11, color: PdfColors.grey700)),
          pw.SizedBox(height: 16),
          pw.Divider(color: PdfColors.grey300),
          pw.SizedBox(height: 12),
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: pw.BoxDecoration(
                color: colorNavy, borderRadius: pw.BorderRadius.circular(6)),
            child: pw.Row(children: [
              pw.Expanded(
                  flex: 2,
                  child: pw.Text('DATE',
                      style: pw.TextStyle(
                          fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.white))),
              pw.Expanded(
                  flex: 3,
                  child: pw.Text('TYPE',
                      style: pw.TextStyle(
                          fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.white))),
              pw.Expanded(
                  flex: 2,
                  child: pw.Text('DURÉE',
                      style: pw.TextStyle(
                          fontSize: 9, fontWeight: pw.FontWeight.bold, color: PdfColors.white),
                      textAlign: pw.TextAlign.right)),
            ]),
          ),
          ...entries.map((e) => pw.Container(
                padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: const pw.BoxDecoration(
                    border: pw.Border(bottom: pw.BorderSide(color: PdfColors.grey200))),
                child: pw.Row(children: [
                  pw.Expanded(
                      flex: 2,
                      child: pw.Text(DateFormat('dd/MM').format(e.date),
                          style: pw.TextStyle(fontSize: 10, color: colorNavy))),
                  pw.Expanded(
                      flex: 3,
                      child: pw.Text(AttendanceType.label(e.type),
                          style: pw.TextStyle(fontSize: 10, color: colorNavy))),
                  pw.Expanded(
                      flex: 2,
                      child: pw.Text('${(e.durationMinutes / 60).toStringAsFixed(1)} h',
                          style: pw.TextStyle(
                              fontSize: 10, fontWeight: pw.FontWeight.bold, color: colorNavy),
                          textAlign: pw.TextAlign.right)),
                ]),
              )),
          pw.SizedBox(height: 16),
          pw.Container(
            padding: const pw.EdgeInsets.all(14),
            decoration: pw.BoxDecoration(
              border: pw.Border.all(color: colorAccent),
              borderRadius: pw.BorderRadius.circular(8),
            ),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('TOTAL',
                    style: pw.TextStyle(
                        fontSize: 12, fontWeight: pw.FontWeight.bold, color: colorNavy)),
                pw.Text('${(totalMinutes / 60).toStringAsFixed(1)} h',
                    style: pw.TextStyle(
                        fontSize: 14, fontWeight: pw.FontWeight.bold, color: colorNavy)),
              ],
            ),
          ),
        ],
      ),
    );

    return pdf;
  }

  Future<void> share({required Worker worker, required DateTime month}) async {
    final pdf = await build(worker: worker, month: month);
    final bytes = await pdf.save();
    await Printing.sharePdf(
        bytes: bytes,
        filename: 'heures_${worker.firstName}_${worker.lastName}_${DateFormat('MM-yyyy').format(month)}.pdf');
  }
}
