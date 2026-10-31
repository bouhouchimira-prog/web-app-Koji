import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/features/quote/repositories/chantier_repository.dart';
import 'package:koji/features/quote/widgets/task_notes_thread.dart';

/// "Suivi ouvriers" — the entreprise's read-only view of what the workers logged
/// on a chantier: per ouvrage, the assigned worker(s), their pointages, the
/// photos and documents they sent, and every réclamation / retard / blocage /
/// dépassement. Counterpart to the worker's ouvrage-detail screen.
class ChantierWorkerActivityScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data; // chantier map ({id, reference, ...})

  const ChantierWorkerActivityScreen({super.key, required this.data});

  @override
  ConsumerState<ChantierWorkerActivityScreen> createState() =>
      _ChantierWorkerActivityScreenState();
}

class _ChantierWorkerActivityScreenState
    extends ConsumerState<ChantierWorkerActivityScreen> {
  static const _navy = Color(0xFF0F172A);
  static const _red = Color(0xFFDC2626);

  final _repo = ChantierRepository();

  List<Map<String, dynamic>> _ouvrages = [];
  bool _loading = true;
  String? _error;

  String get _chantierId => widget.data['id'] as String? ?? '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await _repo.getChantierWorkerActivity(_chantierId);
      if (mounted) setState(() => _ouvrages = data);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _list(Map m, String key) {
    final raw = m[key];
    if (raw is! List) return const [];
    // Elements may be Map<dynamic, dynamic> (json) — convert defensively rather
    // than .cast(), which throws on the first non-conforming element.
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final ref0 = widget.data['reference'] as String? ?? 'Chantier';
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: _navy,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Suivi ouvriers',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            Text(ref0,
                style:
                    const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _navy))
          : _error != null
              ? _errorView()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _ouvrages.isEmpty
                      ? _emptyView()
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
                          itemCount: _ouvrages.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 14),
                          itemBuilder: (_, i) => _ouvrageCard(_ouvrages[i]),
                        ),
                ),
    );
  }

  Widget _ouvrageCard(Map<String, dynamic> o) {
    final title = (o['title'] as String?)?.trim();
    final status = (o['status'] as String?) ?? '';
    final planned = (o['duration_minutes'] as num?)?.toInt() ?? 0;
    final worked = (o['worked_seconds'] as num?)?.toInt() ?? 0;
    final overrun = planned > 0 && worked > planned * 60;
    final workers =
        _list(o, 'workers').map((e) => e.toString()).where((s) => s.isNotEmpty);
    final pointages = _list(o, 'pointages');
    final photos = _list(o, 'photos');
    final documents = _list(o, 'documents');
    final reports = _list(o, 'reports');

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
              color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: reports.isNotEmpty,
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          title: Text((title != null && title.isNotEmpty) ? title : 'Ouvrage',
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 15, color: _navy)),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (workers.isNotEmpty)
                  Text(workers.join(', '),
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF64748B))),
                Text(
                  'Prévu : ${_fmtMinutes(planned)} · Pointé : ${_fmtSeconds(worked)}',
                  style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: overrun ? FontWeight.w700 : FontWeight.w400,
                      color: overrun ? _red : const Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
          trailing: _statusChip(status, overrun),
          children: [
            if (pointages.isNotEmpty) ...[
              _sectionLabel('Pointages'),
              ...pointages.map((p) {
                final at = _parseDate(p['at']);
                return _line(_pointageLabel(p['kind'] as String? ?? ''),
                    at == null ? '' : _fmtDateTime(at));
              }),
            ],
            if (photos.isNotEmpty) ...[
              _sectionLabel('Photos d\'avancement (${photos.length})'),
              const SizedBox(height: 4),
              SizedBox(
                height: 80,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: photos.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 8),
                  itemBuilder: (_, i) {
                    final url = _repo.workerUploadUrl(
                        photos[i]['storage_path'] as String? ?? '');
                    return GestureDetector(
                      onTap: () => _openUrl(url),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(url,
                            width: 80,
                            height: 80,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                                width: 80,
                                height: 80,
                                color: const Color(0xFFF1F5F9),
                                child: const Icon(Icons.broken_image_outlined,
                                    color: Color(0xFFCBD5E1)))),
                      ),
                    );
                  },
                ),
              ),
            ],
            if (documents.isNotEmpty) ...[
              _sectionLabel('Documents joints (${documents.length})'),
              ...documents.map((d) {
                final url =
                    _repo.workerUploadUrl(d['storage_path'] as String? ?? '');
                return InkWell(
                  onTap: () => _openUrl(url),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        const Icon(Icons.insert_drive_file_outlined,
                            size: 16, color: Color(0xFF64748B)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(d['file_name'] as String? ?? 'Document',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 13, color: Color(0xFF2563EB))),
                        ),
                        const Icon(Icons.open_in_new,
                            size: 14, color: Color(0xFF94A3B8)),
                      ],
                    ),
                  ),
                );
              }),
            ],
            if (reports.isNotEmpty) ...[
              _sectionLabel('Réclamations & signalements'),
              ...reports.map((r) {
                final kind = r['kind'] as String? ?? '';
                final msg = r['message'] as String? ?? '';
                final at = _parseDate(r['created_at']);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(_reportIcon(kind),
                          size: 16, color: _reportColor(kind)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${_reportLabel(kind)}${at != null ? ' · ${_fmtDateTime(at)}' : ''}',
                              style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.bold,
                                  color: _reportColor(kind)),
                            ),
                            if (msg.isNotEmpty)
                              Text(msg,
                                  style: const TextStyle(
                                      fontSize: 12.5,
                                      color: Color(0xFF475569))),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
            if (pointages.isEmpty &&
                photos.isEmpty &&
                documents.isEmpty &&
                reports.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: Text('Aucune activité enregistrée pour cet ouvrage.',
                    style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
              ),
            if ((o['id'] as String?) != null) ...[
              const Divider(height: 24),
              _sectionLabel('Notes'),
              const SizedBox(height: 6),
              TaskNotesThread(taskId: o['id'] as String, projectId: _chantierId),
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusChip(String status, bool overrun) {
    if (overrun) {
      return _chip('Dépassé', const Color(0xFFFEE2E2), const Color(0xFFB91C1C));
    }
    final done = status.toLowerCase().contains('termin');
    if (done) {
      return _chip('Terminé', const Color(0xFFDCFCE7), const Color(0xFF166534));
    }
    final running = status.toLowerCase().contains('cours');
    if (running) {
      return _chip('En cours', const Color(0xFFDBEAFE), const Color(0xFF1D4ED8));
    }
    return _chip(status.isEmpty ? 'À faire' : status, const Color(0xFFF1F5F9),
        const Color(0xFF64748B));
  }

  Widget _chip(String label, Color bg, Color fg) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration:
            BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
        child: Text(label,
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.bold, color: fg)),
      );

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.only(top: 12, bottom: 2),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
                color: Color(0xFF94A3B8))),
      );

  Widget _line(String label, String trailing) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Text(label,
                style:
                    const TextStyle(fontSize: 12.5, color: Color(0xFF475569))),
            const Spacer(),
            Text(trailing,
                style:
                    const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
          ],
        ),
      );

  Widget _emptyView() => ListView(
        children: const [
          SizedBox(height: 120),
          Icon(Icons.engineering_outlined, size: 56, color: Color(0xFFCBD5E1)),
          SizedBox(height: 16),
          Center(
            child: Text('Aucune activité ouvrier',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF64748B))),
          ),
          SizedBox(height: 6),
          Center(
            child: Text(
                'Le pointage, les photos et les signalements des ouvriers apparaîtront ici.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
          ),
        ],
      );

  Widget _errorView() => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: _red),
              const SizedBox(height: 12),
              Text(_error ?? 'Erreur',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF64748B))),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _load, child: const Text('Réessayer')),
            ],
          ),
        ),
      );

  Future<void> _openUrl(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  String _fmtMinutes(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0 && m > 0) return '${h}h${m.toString().padLeft(2, '0')}';
    if (h > 0) return '${h}h';
    return '${m}min';
  }

  String _fmtSeconds(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    if (h > 0) return '${h}h${m.toString().padLeft(2, '0')}';
    return '${m}min';
  }

  DateTime? _parseDate(dynamic v) =>
      v is String ? DateTime.tryParse(v)?.toLocal() : null;

  String _fmtDateTime(DateTime d) => DateFormat('dd/MM HH:mm').format(d);

  String _pointageLabel(String kind) => switch (kind) {
        'start' => 'Début',
        'resume' => 'Reprise',
        'pause' => 'Pause',
        'end' => 'Fin',
        _ => kind,
      };

  IconData _reportIcon(String kind) => switch (kind) {
        'reclamation' => Icons.report_problem_outlined,
        'retard' => Icons.schedule_outlined,
        'blocage' => Icons.block_outlined,
        'depassement' => Icons.warning_amber_rounded,
        'commentaire' => Icons.chat_bubble_outline,
        _ => Icons.info_outline,
      };

  Color _reportColor(String kind) => switch (kind) {
        'reclamation' || 'blocage' || 'depassement' => _red,
        'retard' => const Color(0xFFF59E0B),
        'commentaire' => const Color(0xFF2563EB),
        _ => const Color(0xFF64748B),
      };

  String _reportLabel(String kind) => switch (kind) {
        'reclamation' => 'Réclamation',
        'retard' => 'Retard signalé',
        'blocage' => 'Blocage signalé',
        'depassement' => 'Dépassement de temps',
        'commentaire' => 'Commentaire',
        _ => kind,
      };
}
