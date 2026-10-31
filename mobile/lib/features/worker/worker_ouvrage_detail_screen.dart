import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/worker/models/urgent_alert_type.dart';

/// Detail of one ouvrage (a scheduled_task) for the worker. Lets the worker:
///   • point (pointage): début / pause / reprise / fin
///   • add progress photos and attach documents
///   • send a réclamation, signaler un retard ou un blocage, add comments
/// When the worked time exceeds the planned duration, the screen proposes
/// sending a "dépassement" notification (with a motif) to the entreprise.
class WorkerOuvrageDetailScreen extends ConsumerStatefulWidget {
  final String workerId;
  final String taskId;
  final String chantierId;
  final String chantierName;

  const WorkerOuvrageDetailScreen({
    super.key,
    required this.workerId,
    required this.taskId,
    required this.chantierId,
    required this.chantierName,
  });

  @override
  ConsumerState<WorkerOuvrageDetailScreen> createState() =>
      _WorkerOuvrageDetailScreenState();
}

class _WorkerOuvrageDetailScreenState
    extends ConsumerState<WorkerOuvrageDetailScreen> {
  static const _navy = Color(0xFF1F2937);
  static const _green = Color(0xFF22C55E);
  static const _red = Color(0xFFDC2626);

  Map<String, dynamic>? _detail;
  List<Map<String, dynamic>> _taskNotes = [];
  bool _loading = true;
  String? _error;
  bool _busy = false;
  // We only propose the dépassement notification once per visit, so re-pointing
  // doesn't nag the worker repeatedly.
  bool _overrunPrompted = false;

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
      final d = await _repo.getWorkerOuvrageDetail(
          workerId: widget.workerId, taskId: widget.taskId);
      if (mounted) setState(() => _detail = d);
      _maybePromptOverrun();
      // Notes from the entreprise addressed to workers/both — best-effort:
      // an RPC error here shouldn't block the rest of the ouvrage detail.
      try {
        final notes = await _repo.getWorkerTaskNotes(
            workerId: widget.workerId, taskId: widget.taskId);
        if (mounted) setState(() => _taskNotes = notes);
      } catch (_) {
        // Non-fatal — leave _taskNotes as-is.
      }
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── Pointage state helpers ──────────────────────────────────────────────
  List<Map<String, dynamic>> get _pointages {
    final raw = _detail?['pointages'];
    if (raw is List) return raw.cast<Map<String, dynamic>>();
    return const [];
  }

  /// Last pointage kind, drives which buttons are enabled.
  String? get _lastKind =>
      _pointages.isNotEmpty ? _pointages.last['kind'] as String? : null;

  bool get _isRunning => _lastKind == 'start' || _lastKind == 'resume';
  bool get _isPaused => _lastKind == 'pause';
  bool get _isEnded => _lastKind == 'end';
  bool get _notStarted => _lastKind == null;

  int get _plannedMinutes =>
      (_detail?['duration_minutes'] as num?)?.toInt() ?? 0;
  int get _workedSeconds => (_detail?['worked_seconds'] as num?)?.toInt() ?? 0;
  bool get _isOverrun =>
      _plannedMinutes > 0 && _workedSeconds > _plannedMinutes * 60;

  void _maybePromptOverrun() {
    if (_overrunPrompted || !_isOverrun || _isEnded) return;
    // Only nudge if no dépassement report was already sent.
    final reports = (_detail?['reports'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final already = reports.any((r) => r['kind'] == 'depassement');
    if (already) return;
    _overrunPrompted = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _promptOverrun();
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  Future<void> _pointage(String kind) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await _repo.addWorkerPointage(
          workerId: widget.workerId, taskId: widget.taskId, kind: kind);
      await _load();
    } catch (e) {
      _snack('Erreur : $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addPhoto() async {
    final picker = ImagePicker();
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Prendre une photo'),
              onTap: () => Navigator.pop(context, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Choisir dans la galerie'),
              onTap: () => Navigator.pop(context, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    final XFile? file =
        await picker.pickImage(source: source, imageQuality: 80);
    if (file == null) return;

    final caption = await _promptText(
        title: 'Légende (optionnel)', hint: 'Décrivez la photo…');
    // A null result means the worker cancelled the caption dialog → abort.
    if (caption == null) return;

    setState(() => _busy = true);
    try {
      final bytes = await file.readAsBytes();
      final ext = (file.name.split('.').lastOrNull ?? 'jpg').toLowerCase();
      await _repo.addWorkerPhoto(
        workerId: widget.workerId,
        taskId: widget.taskId,
        chantierId: widget.chantierId,
        bytes: bytes,
        fileExtension: ext,
        caption: caption,
      );
      await _load();
      _snack('Photo ajoutée');
    } catch (e) {
      _snack('Erreur : $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addDocument() async {
    final result = await FilePicker.platform.pickFiles(withData: true);
    if (result == null || result.files.isEmpty) return;
    final f = result.files.first;
    final bytes = f.bytes;
    if (bytes == null) {
      _snack('Impossible de lire le fichier.');
      return;
    }
    setState(() => _busy = true);
    try {
      await _repo.addWorkerDocument(
        workerId: widget.workerId,
        taskId: widget.taskId,
        chantierId: widget.chantierId,
        bytes: bytes,
        fileName: f.name,
      );
      await _load();
      _snack('Document joint');
    } catch (e) {
      _snack('Erreur : $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addReport(String kind, String label) async {
    final msg = await _promptText(
      title: label,
      hint: kind == 'commentaire'
          ? 'Votre commentaire ou observation…'
          : 'Décrivez le motif…',
      multiline: true,
    );
    if (msg == null || msg.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await _repo.addWorkerReport(
        workerId: widget.workerId,
        taskId: widget.taskId,
        kind: kind,
        message: msg.trim(),
      );
      await _load();
      _snack('Envoyé à l\'entreprise');
    } catch (e) {
      _snack('Erreur : $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Raise a safety urgent alert — distinct from [_addReport]'s task-progress
  /// reports (réclamation/retard/blocage/commentaire). Shown in its own
  /// higher-priority section of the UI, matching web's treatment of urgent
  /// alerts as more severe than regular claims.
  Future<void> _sendUrgentAlert(UrgentAlertType type) async {
    final msg = await _promptText(
      title: 'Alerte : ${type.label}',
      message: 'Cette alerte sera envoyée immédiatement à l\'entreprise.',
      hint: 'Décrivez la situation…',
      multiline: true,
      confirmLabel: 'Envoyer l\'alerte',
    );
    if (msg == null || msg.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await _repo.addWorkerUrgentAlert(
        workerId: widget.workerId,
        taskId: widget.taskId,
        type: type.value,
        message: msg.trim(),
      );
      _snack('Alerte urgente envoyée à l\'entreprise');
    } catch (e) {
      _snack('Erreur : $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _promptOverrun() async {
    final motif = await _promptText(
      title: 'Temps prévu dépassé',
      message:
          'Le temps pointé dépasse le temps prévu pour cet ouvrage. Souhaitez-vous '
          'notifier l\'entreprise du dépassement ? Précisez le motif.',
      hint: 'Motif du dépassement…',
      multiline: true,
      confirmLabel: 'Notifier l\'entreprise',
    );
    if (motif == null || motif.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      await _repo.addWorkerReport(
        workerId: widget.workerId,
        taskId: widget.taskId,
        kind: 'depassement',
        message: motif.trim(),
      );
      await _load();
      _snack('Dépassement signalé à l\'entreprise');
    } catch (e) {
      _snack('Erreur : $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ── UI ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final title = (_detail?['title'] as String?)?.trim();
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: _navy,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text((title != null && title.isNotEmpty) ? title : 'Ouvrage',
                style:
                    const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
            if (widget.chantierName.isNotEmpty)
              Text(widget.chantierName,
                  style:
                      const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _errorView()
              : _detail == null
                  ? const Center(child: Text('Ouvrage introuvable'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(16, 14, 16, 40),
                        children: [
                          _pointageCard(),
                          const SizedBox(height: 14),
                          _urgentAlertCard(),
                          const SizedBox(height: 14),
                          _actionsCard(),
                          const SizedBox(height: 14),
                          _photosCard(),
                          const SizedBox(height: 14),
                          _documentsCard(),
                          const SizedBox(height: 14),
                          _taskNotesCard(),
                          const SizedBox(height: 14),
                          _reportsCard(),
                        ],
                      ),
                    ),
    );
  }

  Widget _card({required String title, required Widget child, Widget? trailing}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
              color: Color(0x0F000000), blurRadius: 12, offset: Offset(0, 4)),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(title,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15, color: _navy)),
              const Spacer(),
              if (trailing != null) trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _pointageCard() {
    return _card(
      title: 'Pointage',
      trailing: _statusChip(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Worked vs planned time.
          Row(
            children: [
              Expanded(
                child: _timeStat('Temps pointé', _fmtSeconds(_workedSeconds),
                    _isOverrun ? _red : _green),
              ),
              if (_plannedMinutes > 0)
                Expanded(
                  child: _timeStat('Temps prévu', _fmtMinutes(_plannedMinutes),
                      const Color(0xFF64748B)),
                ),
            ],
          ),
          if (_isOverrun) ...[
            const SizedBox(height: 12),
            _overrunBanner(),
          ],
          const SizedBox(height: 14),
          // Pointage buttons. Enabled set depends on the current clock state.
          Row(
            children: [
              Expanded(
                child: _pointBtn(
                  label: _notStarted ? 'Début' : 'Reprise',
                  icon: Icons.play_arrow_rounded,
                  color: _green,
                  enabled: !_busy && (_notStarted || _isPaused),
                  onTap: () => _pointage(_notStarted ? 'start' : 'resume'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _pointBtn(
                  label: 'Pause',
                  icon: Icons.pause_rounded,
                  color: const Color(0xFFF59E0B),
                  enabled: !_busy && _isRunning,
                  onTap: () => _pointage('pause'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _pointBtn(
                  label: 'Fin',
                  icon: Icons.stop_rounded,
                  color: _red,
                  enabled: !_busy && (_isRunning || _isPaused),
                  onTap: () => _pointage('end'),
                ),
              ),
            ],
          ),
          if (_pointages.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Divider(height: 1),
            const SizedBox(height: 10),
            ..._pointages.reversed.take(6).map((p) {
              final kind = p['kind'] as String? ?? '';
              final at = _parseDate(p['at']);
              return Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  children: [
                    Icon(_pointageIcon(kind),
                        size: 16, color: _pointageColor(kind)),
                    const SizedBox(width: 8),
                    Text(_pointageLabel(kind),
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600)),
                    const Spacer(),
                    Text(at == null ? '' : _fmtDateTime(at),
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF94A3B8))),
                  ],
                ),
              );
            }),
          ],
        ],
      ),
    );
  }

  Widget _statusChip() {
    final status = (_detail?['status'] as String?) ?? '';
    final done = status.toLowerCase().contains('termin');
    final running = _isRunning;
    final (bg, fg, label) = done
        ? (const Color(0xFFDCFCE7), const Color(0xFF166534), 'Terminé')
        : running
            ? (const Color(0xFFDBEAFE), const Color(0xFF1D4ED8), 'En cours')
            : (const Color(0xFFF1F5F9), const Color(0xFF64748B),
                status.isEmpty ? 'À faire' : status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration:
          BoxDecoration(color: bg, borderRadius: BorderRadius.circular(99)),
      child: Text(label,
          style:
              TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg)),
    );
  }

  Widget _overrunBanner() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: _red, size: 20),
          const SizedBox(width: 10),
          const Expanded(
            child: Text(
              'Le temps prévu est dépassé.',
              style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF991B1B)),
            ),
          ),
          TextButton(
            onPressed: _busy ? null : _promptOverrun,
            style: TextButton.styleFrom(
                foregroundColor: _red,
                padding: const EdgeInsets.symmetric(horizontal: 8)),
            child: const Text('Notifier'),
          ),
        ],
      ),
    );
  }

  Widget _timeStat(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
        const SizedBox(height: 2),
        Text(value,
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  Widget _pointBtn({
    required String label,
    required IconData icon,
    required Color color,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return Opacity(
      opacity: enabled ? 1 : 0.4,
      child: Material(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              children: [
                Icon(icon, color: color, size: 26),
                const SizedBox(height: 4),
                Text(label,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: color)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _actionsCard() {
    return _card(
      title: 'Signalements & observations',
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          _actionChip(Icons.report_problem_outlined, 'Réclamation', _red,
              () => _addReport('reclamation', 'Réclamation')),
          _actionChip(Icons.schedule_outlined, 'Signaler un retard',
              const Color(0xFFF59E0B), () => _addReport('retard', 'Retard')),
          _actionChip(Icons.block_outlined, 'Signaler un blocage', _red,
              () => _addReport('blocage', 'Blocage')),
          _actionChip(Icons.chat_bubble_outline, 'Commentaire',
              const Color(0xFF2563EB),
              () => _addReport('commentaire', 'Commentaire / observation')),
        ],
      ),
    );
  }

  Widget _urgentAlertCard() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: _red, size: 20),
              const SizedBox(width: 8),
              const Text('Alerte urgente',
                  style: TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15, color: _red)),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Dégât, fuite, incendie… signalez immédiatement une urgence à l\'entreprise.',
            style: TextStyle(fontSize: 12, color: Color(0xFF7F1D1D)),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: UrgentAlertType.values
                .map((t) => _actionChip(
                    t.icon, t.label, _red, () => _sendUrgentAlert(t)))
                .toList(),
          ),
        ],
      ),
    );
  }

  Widget _actionChip(
      IconData icon, String label, Color color, VoidCallback onTap) {
    return InkWell(
      borderRadius: BorderRadius.circular(99),
      onTap: _busy ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 12.5, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _photosCard() {
    final photos =
        (_detail?['photos'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    return _card(
      title: 'Photos d\'avancement',
      trailing: TextButton.icon(
        onPressed: _busy ? null : _addPhoto,
        icon: const Icon(Icons.add_a_photo_outlined, size: 18),
        label: const Text('Ajouter'),
        style: TextButton.styleFrom(foregroundColor: _green),
      ),
      child: photos.isEmpty
          ? _emptyHint('Aucune photo pour le moment.')
          : SizedBox(
              height: 96,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: photos.length,
                separatorBuilder: (_, __) => const SizedBox(width: 10),
                itemBuilder: (_, i) {
                  final p = photos[i];
                  final url = _repo
                      .workerUploadUrl(p['storage_path'] as String? ?? '');
                  return GestureDetector(
                    onTap: () => _openUrl(url),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Image.network(
                        url,
                        width: 96,
                        height: 96,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 96,
                          height: 96,
                          color: const Color(0xFFF1F5F9),
                          child: const Icon(Icons.broken_image_outlined,
                              color: Color(0xFFCBD5E1)),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }

  Widget _documentsCard() {
    final docs =
        (_detail?['documents'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    return _card(
      title: 'Documents joints',
      trailing: TextButton.icon(
        onPressed: _busy ? null : _addDocument,
        icon: const Icon(Icons.attach_file, size: 18),
        label: const Text('Joindre'),
        style: TextButton.styleFrom(foregroundColor: _green),
      ),
      child: docs.isEmpty
          ? _emptyHint('Aucun document joint.')
          : Column(
              children: docs.map((d) {
                final name = d['file_name'] as String? ?? 'Document';
                final url =
                    _repo.workerUploadUrl(d['storage_path'] as String? ?? '');
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.insert_drive_file_outlined,
                      color: Color(0xFF64748B)),
                  title: Text(name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 14)),
                  trailing: const Icon(Icons.open_in_new, size: 18),
                  onTap: () => _openUrl(url),
                );
              }).toList(),
            ),
    );
  }

  Widget _taskNotesCard() {
    if (_taskNotes.isEmpty) {
      return _card(
        title: 'Notes de l\'entreprise',
        child: _emptyHint('Aucune note pour cet ouvrage.'),
      );
    }
    return _card(
      title: 'Notes de l\'entreprise',
      child: Column(
        children: _taskNotes.map((n) {
          final sender = (n['sender_name'] as String?)?.trim();
          final msg = n['message'] as String? ?? '';
          final at = _parseDate(n['created_at']);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.sticky_note_2_outlined,
                    size: 18, color: Color(0xFF2563EB)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text((sender != null && sender.isNotEmpty) ? sender : 'Entreprise',
                          style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF2563EB))),
                      if (msg.isNotEmpty)
                        Text(msg,
                            style: const TextStyle(
                                fontSize: 13, color: Color(0xFF475569))),
                      if (at != null)
                        Text(_fmtDateTime(at),
                            style: const TextStyle(
                                fontSize: 11, color: Color(0xFF94A3B8))),
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _reportsCard() {
    final reports =
        (_detail?['reports'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    if (reports.isEmpty) {
      return _card(
        title: 'Historique des signalements',
        child: _emptyHint('Aucun signalement envoyé.'),
      );
    }
    return _card(
      title: 'Historique des signalements',
      child: Column(
        children: reports.map((r) {
          final kind = r['kind'] as String? ?? '';
          final msg = r['message'] as String? ?? '';
          final at = _parseDate(r['created_at']);
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(_reportIcon(kind), size: 18, color: _reportColor(kind)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_reportLabel(kind),
                          style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: _reportColor(kind))),
                      if (msg.isNotEmpty)
                        Text(msg,
                            style: const TextStyle(
                                fontSize: 13, color: Color(0xFF475569))),
                      if (at != null)
                        Text(_fmtDateTime(at),
                            style: const TextStyle(
                                fontSize: 11, color: Color(0xFF94A3B8))),
                    ],
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _emptyHint(String text) => Text(text,
      style: const TextStyle(fontSize: 13, color: Color(0xFF94A3B8)));

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

  // ── Small helpers ──────────────────────────────────────────────────────
  Future<void> _openUrl(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      _snack('Impossible d\'ouvrir le fichier.');
    }
  }

  void _snack(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  /// Generic text-input dialog. Returns null when cancelled, the (possibly
  /// empty) text otherwise.
  Future<String?> _promptText({
    required String title,
    String? message,
    String hint = '',
    bool multiline = false,
    String confirmLabel = 'Envoyer',
  }) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (message != null) ...[
              Text(message,
                  style: const TextStyle(fontSize: 13, color: Color(0xFF64748B))),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: ctrl,
              autofocus: true,
              maxLines: multiline ? 4 : 1,
              decoration: InputDecoration(
                hintText: hint,
                border: const OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text),
              child: Text(confirmLabel)),
        ],
      ),
    );
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

  IconData _pointageIcon(String kind) => switch (kind) {
        'start' => Icons.play_arrow_rounded,
        'resume' => Icons.play_arrow_rounded,
        'pause' => Icons.pause_rounded,
        'end' => Icons.stop_rounded,
        _ => Icons.circle,
      };

  Color _pointageColor(String kind) => switch (kind) {
        'start' || 'resume' => _green,
        'pause' => const Color(0xFFF59E0B),
        'end' => _red,
        _ => const Color(0xFF94A3B8),
      };

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
