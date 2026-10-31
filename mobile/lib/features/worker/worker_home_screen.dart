import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/worker/worker_ouvrage_detail_screen.dart';

/// "Mes chantiers en cours" — the worker's active chantiers. For each chantier:
/// its name, address, the company it works with, and the ouvrages assigned to
/// the worker. A worker can be on several chantiers at once (all listed here).
class WorkerHomeScreen extends ConsumerStatefulWidget {
  final String workerId;
  final String? workerName;

  const WorkerHomeScreen({
    super.key,
    required this.workerId,
    this.workerName,
  });

  @override
  ConsumerState<WorkerHomeScreen> createState() => _WorkerHomeScreenState();
}

class _WorkerHomeScreenState extends ConsumerState<WorkerHomeScreen> {
  static const _navy = Color(0xFF1F2937);
  static const _green = Color(0xFF22C55E);

  List<Map<String, dynamic>> _chantiers = [];
  bool _loading = true;
  String? _error;

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
      final data =
          await ref.read(authRepositoryProvider).getWorkerChantiers(widget.workerId);
      if (mounted) setState(() => _chantiers = data);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _isDone(String? status) {
    final s = (status ?? '').toLowerCase();
    return s.contains('termin') || s == 'done' || s == 'fait';
  }

  List<Map<String, dynamic>> _ouvrages(Map<String, dynamic> chantier) {
    final raw = chantier['ouvrages'];
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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Mes chantiers en cours',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            if (widget.workerName != null && widget.workerName!.isNotEmpty)
              Text(widget.workerName!,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ],
        ),
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
    final ouvrages = _ouvrages(chantier);
    final doneCount =
        ouvrages.where((o) => _isDone(o['status'] as String?)).length;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
              color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: name, address, company
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.handyman, color: _green, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        (name != null && name.isNotEmpty) ? name : 'Chantier',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: _navy),
                      ),
                    ),
                  ],
                ),
                if (address.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  _infoRow(Icons.location_on_outlined, address),
                ],
                if (company.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  _infoRow(Icons.business_outlined, company),
                ],
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFF1F5F9)),
          // Ouvrages
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Row(
              children: [
                const Text('Ouvrages affectés',
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.2,
                        color: Color(0xFF64748B))),
                const Spacer(),
                Text('$doneCount / ${ouvrages.length}',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: _green)),
              ],
            ),
          ),
          if (ouvrages.isEmpty)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text('Aucun ouvrage affecté pour le moment.',
                  style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8))),
            )
          else
            ...ouvrages.map((o) => _ouvrageTile(chantier, o)),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: const Color(0xFF94A3B8)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              style: const TextStyle(fontSize: 13, color: Color(0xFF475569))),
        ),
      ],
    );
  }

  Widget _ouvrageTile(Map<String, dynamic> chantier, Map<String, dynamic> o) {
    final title = (o['title'] as String?)?.trim();
    final done = _isDone(o['status'] as String?);
    final planned = (o['duration_minutes'] as num?)?.toInt() ?? 0;
    final workedSec = (o['worked_seconds'] as num?)?.toInt() ?? 0;
    final overrun = planned > 0 && workedSec > planned * 60;

    return InkWell(
      onTap: () => _openOuvrage(chantier, o),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Icon(
              done ? Icons.check_circle : Icons.radio_button_unchecked,
              color: done ? _green : const Color(0xFFCBD5E1),
              size: 22,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (title != null && title.isNotEmpty) ? title : 'Ouvrage',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: done ? const Color(0xFF94A3B8) : _navy,
                      decoration: done ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  if (planned > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'Prévu : ${_fmtMinutes(planned)} · Pointé : ${_fmtSeconds(workedSec)}',
                        style: TextStyle(
                          fontSize: 11.5,
                          color: overrun
                              ? const Color(0xFFDC2626)
                              : const Color(0xFF94A3B8),
                          fontWeight:
                              overrun ? FontWeight.w700 : FontWeight.w400,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            if (overrun)
              Container(
                margin: const EdgeInsets.only(right: 6),
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(99),
                ),
                child: const Text('Dépassé',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFB91C1C))),
              ),
            const Icon(Icons.chevron_right, color: Color(0xFFCBD5E1)),
          ],
        ),
      ),
    );
  }

  Future<void> _openOuvrage(
      Map<String, dynamic> chantier, Map<String, dynamic> ouvrage) async {
    final taskId = ouvrage['id']?.toString();
    final chantierId = chantier['chantier_id']?.toString();
    if (taskId == null || chantierId == null) return;
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WorkerOuvrageDetailScreen(
          workerId: widget.workerId,
          taskId: taskId,
          chantierId: chantierId,
          chantierName: (chantier['chantier_reference'] as String?) ?? '',
        ),
      ),
    );
    // Returning from the detail screen may have changed pointage/status.
    _load();
  }

  String _fmtMinutes(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h > 0 && m > 0) return '${h}h${m.toString().padLeft(2, '0')}';
    if (h > 0) return '${h}h';
    return '${m}min';
  }

  String _fmtSeconds(int seconds) {
    final totalMin = seconds ~/ 60;
    return _fmtMinutes(totalMin);
  }

  Widget _emptyView() {
    return ListView(
      children: const [
        SizedBox(height: 120),
        Icon(Icons.home_work_outlined, size: 56, color: Color(0xFFCBD5E1)),
        SizedBox(height: 16),
        Center(
          child: Text('Aucun chantier en cours',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B))),
        ),
        SizedBox(height: 6),
        Center(
          child: Text(
              'Vos chantiers apparaîtront ici dès qu\'une entreprise vous y affectera.',
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
}
