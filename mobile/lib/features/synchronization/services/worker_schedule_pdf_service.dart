import 'dart:typed_data';

import 'package:intl/intl.dart';
import 'package:koji/features/synchronization/data/scheduled_task_model.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

/// Builds and shares a one-page PDF listing a given worker's tasks for a
/// given day. Designed to be sent to the worker via WhatsApp / SMS / email
/// (workers don't have the app yet — this is how the contractor dispatches
/// their daily plan).
class WorkerSchedulePdfService {
  Future<Uint8List> buildWorkerDayPdf({
    required Worker worker,
    required DateTime day,
    required List<ScheduledTask> tasks,
  }) async {
    final doc = pw.Document();
    final dateFormat = DateFormat('EEEE d MMMM yyyy', 'fr_FR');
    final fullName = '${worker.firstName} ${worker.lastName}'.trim();
    final headerDate = dateFormat.format(day);

    // Sort tasks by start time defensively.
    final ordered = [...tasks]
      ..sort((a, b) => a.startTime.compareTo(b.startTime));

    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (ctx) {
          return pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(
                'Planning du jour',
                style: pw.TextStyle(
                  fontSize: 20,
                  fontWeight: pw.FontWeight.bold,
                ),
              ),
              pw.SizedBox(height: 4),
              pw.Text(
                headerDate,
                style: const pw.TextStyle(fontSize: 13),
              ),
              pw.SizedBox(height: 20),
              pw.Container(
                padding: const pw.EdgeInsets.all(12),
                decoration: pw.BoxDecoration(
                  color: PdfColors.grey100,
                  borderRadius: pw.BorderRadius.circular(8),
                ),
                child: pw.Row(
                  mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                  children: [
                    pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        pw.Text(
                          fullName.isEmpty ? 'Ouvrier' : fullName,
                          style: pw.TextStyle(
                            fontSize: 16,
                            fontWeight: pw.FontWeight.bold,
                          ),
                        ),
                        if (worker.profession.isNotEmpty)
                          pw.Text(
                            worker.profession,
                            style: const pw.TextStyle(
                              fontSize: 12,
                              color: PdfColors.grey600,
                            ),
                          ),
                      ],
                    ),
                    pw.Text(
                      _totalHoursLabel(ordered),
                      style: pw.TextStyle(
                        fontSize: 14,
                        fontWeight: pw.FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              pw.SizedBox(height: 24),
              if (ordered.isEmpty)
                pw.Text(
                  'Aucune tâche planifiée ce jour.',
                  style: const pw.TextStyle(
                    fontSize: 13,
                    color: PdfColors.grey600,
                  ),
                )
              else
                pw.Table(
                  columnWidths: const {
                    0: pw.FixedColumnWidth(110),
                    1: pw.FlexColumnWidth(),
                  },
                  border: pw.TableBorder.symmetric(
                    inside: const pw.BorderSide(
                      color: PdfColors.grey300,
                      width: 0.5,
                    ),
                  ),
                  children: [
                    pw.TableRow(
                      decoration:
                          const pw.BoxDecoration(color: PdfColors.grey200),
                      children: [
                        _cell('Heure', bold: true),
                        _cell('Tâche', bold: true),
                      ],
                    ),
                    ...ordered.map(
                      (t) => pw.TableRow(
                        children: [
                          _cell('${t.startTime}\n→ ${t.endTime}'),
                          _cell(_taskDescription(t)),
                        ],
                      ),
                    ),
                  ],
                ),
              pw.Spacer(),
              pw.Divider(color: PdfColors.grey300),
              pw.Text(
                'Généré le ${DateFormat('dd/MM/yyyy HH:mm').format(DateTime.now())}',
                style: const pw.TextStyle(
                  fontSize: 9,
                  color: PdfColors.grey500,
                ),
              ),
            ],
          );
        },
      ),
    );

    return doc.save();
  }

  Future<void> shareWorkerDay({
    required Worker worker,
    required DateTime day,
    required List<ScheduledTask> tasks,
  }) async {
    final bytes = await buildWorkerDayPdf(
      worker: worker,
      day: day,
      tasks: tasks,
    );
    final safeName = '${worker.firstName}-${worker.lastName}'
        .toLowerCase()
        .replaceAll(RegExp(r'[^a-z0-9\-]'), '');
    final dateStr =
        '${day.year.toString().padLeft(4, '0')}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    await Printing.sharePdf(
      bytes: bytes,
      filename: 'planning-$safeName-$dateStr.pdf',
    );
  }

  pw.Widget _cell(String text, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(8),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          fontSize: 11,
          fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
        ),
      ),
    );
  }

  String _taskDescription(ScheduledTask t) {
    final chantierLabel = [
      if ((t.chantierReference ?? '').isNotEmpty) t.chantierReference,
      if ((t.chantierCity ?? '').isNotEmpty) t.chantierCity,
    ].whereType<String>().join(' · ');
    final notes = (t.notes ?? '').trim();
    return [
      t.title,
      if (chantierLabel.isNotEmpty) 'Chantier: $chantierLabel',
      if (notes.isNotEmpty) notes,
    ].join('\n');
  }

  String _totalHoursLabel(List<ScheduledTask> tasks) {
    final minutes = tasks.fold<int>(0, (s, t) => s + t.durationMinutes);
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (minutes == 0) return '0h';
    if (m == 0) return '${h}h';
    return '${h}h${m.toString().padLeft(2, '0')}';
  }
}
