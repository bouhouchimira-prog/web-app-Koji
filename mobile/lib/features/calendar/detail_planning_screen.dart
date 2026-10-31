import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/project_model.dart';
import 'data/calendar_event_model.dart';
import 'data/calendar_repository.dart';

class DetailPlanningScreen extends StatefulWidget {
  final String eventId;
  const DetailPlanningScreen({super.key, required this.eventId});

  @override
  State<DetailPlanningScreen> createState() => _DetailPlanningScreenState();
}

class _DetailPlanningScreenState extends State<DetailPlanningScreen> {
  static const _darkNavy = Color(0xFF0A1227);
  static const _bg = Color(0xFFF7F8FA);
  static const _blue = Color(0xFF2E65F3);

  final _repo = CalendarRepository();
  CalendarEvent? _event;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final event = await _repo.fetchEventById(widget.eventId);
      if (mounted) setState(() { _event = event; _isLoading = false; });
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _openTeamAssignment(CalendarEvent event) {
    if (event.projectId != null) {
      // Build a minimal Project from the event data and go to assignment screen
      final project = Project(
        id: event.projectId!,
        title: event.title,
        clientName: event.clientName ?? '',
        address: event.address,
        status: event.status,
      );
      context.push('/projects/assign/${event.projectId}', extra: project);
    } else {
      // No linked project — let the user pick one
      context.push('/projects');
    }
  }

  Color get _statusColor {
    switch (_event?.status) {
      case 'Terminé': return const Color(0xFF10B981);
      case 'Annulé': return const Color(0xFFEF4444);
      case 'En attente': return const Color(0xFFFF9800);
      default: return _blue;
    }
  }

  String _formatDate(DateTime? d) {
    if (d == null) return '—';
    const months = ['', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun',
        'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    return '${d.day} ${months[d.month]}. ${d.year}';
  }

  // ─── BUILD ──────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: _bg,
        body: Center(child: CircularProgressIndicator(color: _blue)),
      );
    }
    if (_event == null) {
      return Scaffold(
        backgroundColor: _bg,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.grey),
              const SizedBox(height: 12),
              const Text('Événement introuvable'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => context.pop(),
                child: const Text('Retour'),
              ),
            ],
          ),
        ),
      );
    }

    final event = _event!;
    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(event),
              const SizedBox(height: 8),

              // Status badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: _statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  event.status,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: _statusColor,
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Title
              Text(
                event.title,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: _darkNavy,
                ),
              ),
              const SizedBox(height: 20),

              // Progress card
              _buildProgressCard(event),
              const SizedBox(height: 20),

              // Quick actions
              _buildQuickActions(event),
              const SizedBox(height: 24),

              // General info
              _sectionTitle('Informations Générales'),
              const SizedBox(height: 12),
              _buildInfoCard(event),
              const SizedBox(height: 24),

              // Tasks
              if (event.tasks.isNotEmpty) ...[
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Taches en Cours',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: _darkNavy,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () {},
                      child: const Text(
                        'Voir tout',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: _blue,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...event.tasks.map((t) => _buildTaskCard(t)),
                const SizedBox(height: 24),
              ],

              // Team
              if (event.workers.isNotEmpty) ...[
                _sectionTitle('Équipe Affectée'),
                const SizedBox(height: 14),
                _buildTeamRow(event),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(CalendarEvent event) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: Container(
              width: 40, height: 40,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: _darkNavy.withValues(alpha: 0.06),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(Icons.chevron_left, color: _darkNavy, size: 26),
            ),
          ),
          const Expanded(
            child: Text(
              'Detail planning',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: _darkNavy,
              ),
            ),
          ),
          _iconBtn(Icons.share_outlined, () {}),
          const SizedBox(width: 8),
          _iconBtn(Icons.edit_outlined, () async {
            if (_event != null) {
              await context.push('/calendrier/new-event', extra: _event);
              _load(); // refresh after returning from edit
            }
          }),
        ],
      ),
    );
  }

  Widget _iconBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40, height: 40,
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(
              color: _darkNavy.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Icon(icon, color: _darkNavy, size: 20),
      ),
    );
  }

  Widget _buildProgressCard(CalendarEvent event) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _darkNavy.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Avancement Global',
            style: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${event.progress}%',
                style: const TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w800,
                  color: _darkNavy,
                ),
              ),
              const Spacer(),
              if (event.daysRemaining != null)
                Text(
                  '${event.daysRemaining} jours restants',
                  style: const TextStyle(
                    fontSize: 13,
                    color: Color(0xFF94A3B8),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: event.progress / 100,
              minHeight: 8,
              backgroundColor: const Color(0xFFE2E8F0),
              valueColor: const AlwaysStoppedAnimation<Color>(_darkNavy),
            ),
          ),
          const SizedBox(height: 20),
          // Mini actions row
          Row(
            children: [
              _progressAction(Icons.calendar_month_outlined, 'Planning'),
              const SizedBox(width: 16),
              _progressAction(Icons.description_outlined, 'Devis lié'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _progressAction(IconData icon, String label) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F8FA),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          children: [
            Icon(icon, size: 24, color: _darkNavy),
            const SizedBox(height: 6),
            Text(label,
                style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _darkNavy)),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions(CalendarEvent event) {
    return Row(
      children: [
        _actionChip(Icons.check_circle_outline, 'Terminer', const Color(0xFF10B981), () async {
          await _repo.updateEvent(event.id, {'status': 'Terminé'});
          _load();
        }),
        const SizedBox(width: 10),
        _actionChip(Icons.cancel_outlined, 'Annuler', const Color(0xFFEF4444), () async {
          await _repo.updateEvent(event.id, {'status': 'Annulé'});
          _load();
        }),
      ],
    );
  }

  Widget _actionChip(IconData icon, String label, Color color, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.3)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w700, color: color)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoCard(CalendarEvent event) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: _darkNavy.withValues(alpha: 0.05),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          _infoRow(
            Icons.person_outline,
            'Client',
            event.clientName ?? '—',
            subtitle: null,
          ),
          _divider(),
          _infoRow(
            Icons.location_on_outlined,
            'Adresse',
            event.address ?? '—',
            subtitle: null,
          ),
          _divider(),
          _infoRowDates(event),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value, {String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFFF7F8FA),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 20, color: _darkNavy),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF94A3B8))),
              const SizedBox(height: 2),
              Text(value,
                  style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _darkNavy)),
              if (subtitle != null)
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 13, color: Color(0xFF94A3B8))),
            ],
          ),
        ],
      ),
    );
  }

  Widget _infoRowDates(CalendarEvent event) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 40, height: 40,
            decoration: const BoxDecoration(
              color: Color(0xFFF7F8FA),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.calendar_month_outlined,
                size: 20, color: _darkNavy),
          ),
          const SizedBox(width: 14),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Dates',
                  style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
              const SizedBox(height: 2),
              Row(
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Début',
                          style: TextStyle(
                              fontSize: 11, color: Color(0xFF94A3B8))),
                      Text(_formatDate(event.startAt),
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: _darkNavy)),
                    ],
                  ),
                  const SizedBox(width: 32),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Fin Prévue',
                          style: TextStyle(
                              fontSize: 11, color: Color(0xFF94A3B8))),
                      Text(_formatDate(event.endAt),
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: _darkNavy)),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTaskCard(CalendarEventTask task) {
    final isTermine = task.status == 'Terminé';
    final isEnCours = task.status == 'En cours';
    final statusColor = isTermine
        ? const Color(0xFF10B981)
        : isEnCours
            ? _blue
            : const Color(0xFF94A3B8);
    final statusLabel = isTermine
        ? 'En cours'  // shown as "En cours" per design (progress % text)
        : 'Attente';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: _darkNavy.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Checkbox circle
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: isTermine
                  ? _darkNavy
                  : const Color(0xFFF7F8FA),
              shape: BoxShape.circle,
              border: Border.all(
                color: isTermine ? _darkNavy : const Color(0xFFE2E8F0),
              ),
            ),
            child: isTermine
                ? Icon(Icons.check, color: Theme.of(context).colorScheme.surface, size: 18)
                : null,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _darkNavy,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isTermine
                      ? 'Terminé à ${task.progress}%'
                      : 'Pas encore démarré',
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF94A3B8)),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              isTermine ? 'En cours' : statusLabel,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: statusColor,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTeamRow(CalendarEvent event) {
    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        ...event.workers.map((w) => _workerChip(w)),
        // Add button
        GestureDetector(
          onTap: () => _openTeamAssignment(event),
          child: Column(
            children: [
              Container(
                width: 56, height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: const Color(0xFF94A3B8),
                    width: 1.5,
                  ),
                ),
                child: const Icon(Icons.add, color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 6),
              const Text('Ajouter',
                  style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
            ],
          ),
        ),
      ],
    );
  }

  Widget _workerChip(CalendarEventWorker w) {
    return Column(
      children: [
        Stack(
          children: [
            Container(
              width: 56, height: 56,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                shape: BoxShape.circle,
                border: w.isChef
                    ? Border.all(color: _darkNavy, width: 2.5)
                    : null,
                image: w.profilePictureUrl != null
                    ? DecorationImage(
                        image: NetworkImage(w.profilePictureUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: w.profilePictureUrl == null
                  ? Icon(Icons.person, size: 30, color: Colors.blueGrey[300])
                  : null,
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          w.isChef
              ? '${w.firstName ?? ''} (Chef)'
              : (w.firstName ?? ''),
          style: const TextStyle(fontSize: 11, color: _darkNavy),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }

  Widget _sectionTitle(String text) {
    return Text(
      text,
      style: const TextStyle(
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: _darkNavy,
      ),
    );
  }

  Widget _divider() {
    return const Divider(
      height: 1,
      thickness: 1,
      indent: 16,
      endIndent: 16,
      color: Color(0xFFF1F5F9),
    );
  }
}
