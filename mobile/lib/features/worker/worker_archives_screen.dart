import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/features/auth/repository/auth_repository.dart';

/// "Archives" — the worker's terminated/archived chantiers. Each chantier is
/// expandable and shows, per ouvrage, the complete history the worker built up:
/// pointages, photos sent, documents joined, and réclamations/signalements.
/// Read-only: it's a record of past activity.
class WorkerArchivesScreen extends ConsumerStatefulWidget {
  final String workerId;

  const WorkerArchivesScreen({super.key, required this.workerId});

  @override
  ConsumerState<WorkerArchivesScreen> createState() =>
      _WorkerArchivesScreenState();
}

class _WorkerArchivesScreenState extends ConsumerState<WorkerArchivesScreen> {
  static const _navy = Color(0xFF1F2937);
  static const _green = Color(0xFF22C55E);
  static const _red = Color(0xFFDC2626);

  List<Map<String, dynamic>> _chantiers = [];
  bool _loading = true;
  String? _error;

  AuthRepository get _repo => ref.read(authRepositoryProvider);

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
      final data = await _repo.getWorkerArchives(widget.workerId);
      if (mounted) setState(() => _chantiers = data);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> _list(Map m, String key) {
    final raw = m[key];
    if (raw is List) return raw.cast<Map<String, dynamic>>();
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: _navy,
        title: const Text('Archives',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _errorView()
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _chantiers.isEmpty
                      ? _emptyView()
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
                          itemCount: _chantiers.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 14),
                          itemBuilder: (_, i) => _chantierCard(_chantiers[i]),
                        ),
                ),
    );
  }

  Widget _chantierCard(Map<String, dynamic> chantier) {
    final name = (chantier['chantier_reference'] as String?)?.trim();
    final address = (chantier['chantier_address'] as String?)?.trim() ?? '';
    final company = (chantier['company_name'] as String?)?.trim() ?? '';
    final ouvrages = _list(chantier, 'ouvrages');

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
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          leading: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.inventory_2_outlined,
                color: Color(0xFF64748B), size: 20),
          ),
          title: Text(
            (name != null && name.isNotEmpty) ? name : 'Chantier',
            style: const TextStyle(
                fontWeight: FontWeight.bold, fontSize: 15, color: _navy),
          ),
          subtitle: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (address.isNotEmpty)
                Text(address,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF64748B))),
              if (company.isNotEmpty)
                Text(company,
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF94A3B8))),
              Text('${ouvrages.length} ouvrage(s) réalisé(s)',
                  style: const TextStyle(
                      fontSize: 11.5,
                      color: _green,
                      fontWeight: FontWeight.w600)),
            ],
          ),
          children: ouvrages.isEmpty
              ? [_emptyHint('Aucun ouvrage.')]
              : ouvrages.map(_ouvrageBlock).toList(),
        ),
      ),
    );
  }

  Widget _ouvrageBlock(Map<String, dynamic> o) {
    final title = (o['title'] as String?)?.trim();
    final planned = (o['duration_minutes'] as num?)?.toInt() ?? 0;
    final worked = (o['worked_seconds'] as num?)?.toInt() ?? 0;
    final pointages = _list(o, 'pointages');
    final photos = _list(o, 'photos');
    final documents = _list(o, 'documents');
    final reports = _list(o, 'reports');

    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEF0F3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.check_circle, size: 18, color: _green),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                    (title != null && title.isNotEmpty) ? title : 'Ouvrage',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                        color: _navy)),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Prévu : ${_fmtMinutes(planned)}  ·  Pointé : ${_fmtSeconds(worked)}',
            style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
          ),

          // Historique des pointages
          if (pointages.isNotEmpty) ...[
            _sectionLabel('Pointages'),
            ...pointages.map((p) {
              final at = _parseDate(p['at']);
              return _historyLine(
                  _pointageLabel(p['kind'] as String? ?? ''),
                  at == null ? '' : _fmtDateTime(at));
            }),
          ],

          // Photos
          if (photos.isNotEmpty) ...[
            _sectionLabel('Photos envoyées (${photos.length})'),
            const SizedBox(height: 4),
            SizedBox(
              height: 70,
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
                          width: 70,
                          height: 70,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                              width: 70,
                              height: 70,
                              color: const Color(0xFFF1F5F9),
                              child: const Icon(Icons.broken_image_outlined,
                                  color: Color(0xFFCBD5E1)))),
                    ),
                  );
                },
              ),
            ),
          ],

          // Documents
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

          // Réclamations & signalements
          if (reports.isNotEmpty) ...[
            _sectionLabel('Réclamations & signalements'),
            ...reports.map((r) {
              final kind = r['kind'] as String? ?? '';
              final msg = r['message'] as String? ?? '';
              final at = _parseDate(r['created_at']);
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(_reportIcon(kind), size: 15, color: _reportColor(kind)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${_reportLabel(kind)}${at != null ? ' · ${_fmtDateTime(at)}' : ''}',
                            style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w600,
                                color: _reportColor(kind)),
                          ),
                          if (msg.isNotEmpty)
                            Text(msg,
                                style: const TextStyle(
                                    fontSize: 12.5, color: Color(0xFF475569))),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
        padding: const EdgeInsets.only(top: 10, bottom: 2),
        child: Text(text.toUpperCase(),
            style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
                color: Color(0xFF94A3B8))),
      );

  Widget _historyLine(String label, String trailing) => Padding(
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

  Widget _emptyHint(String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Text(text,
            style: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
      );

  Widget _emptyView() {
    return ListView(
      children: const [
        SizedBox(height: 120),
        Icon(Icons.inventory_2_outlined, size: 56, color: Color(0xFFCBD5E1)),
        SizedBox(height: 16),
        Center(
          child: Text('Aucun chantier terminé',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B))),
        ),
        SizedBox(height: 6),
        Center(
          child: Text(
              'Les chantiers terminés et leur historique apparaîtront ici.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
        ),
      ],
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Color(0xFFEF4444)),
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
  }

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

  String _fmtDateTime(DateTime d) => DateFormat('dd/MM/yy HH:mm').format(d);

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
