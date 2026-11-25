import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/project_repository.dart';

class ChantierInfoScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> data;

  const ChantierInfoScreen({super.key, required this.data});

  @override
  ConsumerState<ChantierInfoScreen> createState() => _ChantierInfoScreenState();
}

class _ChantierInfoScreenState extends ConsumerState<ChantierInfoScreen> {
  final ProjectRepository _projectRepo = ProjectRepository();
  List<Map<String, dynamic>> _team = [];
  bool _loadingTeam = false;

  String get _reference => widget.data['reference'] as String? ?? 'Chantier';
  String get _street => widget.data['street'] as String? ?? '';
  String get _postalCode => widget.data['postalCode'] as String? ?? '';
  String get _city => widget.data['city'] as String? ?? '';

  // Client info from data (set when a chantier is linked to a quote)
  // Le nom saisi, sinon l'e-mail du client, sinon on dit qu'il manque.
  String get _clientName {
    final nom = (widget.data['clientName'] as String? ??
            widget.data['client_name'] as String? ??
            '')
        .trim();
    if (nom.isNotEmpty) return nom;
    return _clientEmail.isNotEmpty ? _clientEmail : 'Client non renseigné';
  }
  String get _clientPhone =>
      widget.data['clientPhone'] as String? ??
      widget.data['client_phone'] as String? ??
      '';
  String get _clientEmail =>
      widget.data['clientEmail'] as String? ??
      widget.data['client_email'] as String? ??
      '';

  String get _startDate =>
      widget.data['startDate'] as String? ??
      widget.data['start_date'] as String? ??
      '';
  String get _endDate =>
      widget.data['endDate'] as String? ??
      widget.data['end_date'] as String? ??
      '';
  String get _status => widget.data['status'] as String? ?? 'En attente';
  String get _propertyType {
    final type = (widget.data['propertyType'] as String? ?? '').trim();
    return type.isEmpty ? 'non renseigné' : type;
  }

  String get _fullAddress {
    final parts = [_street, _postalCode, _city].where((s) => s.isNotEmpty);
    return parts.join(', ');
  }

  @override
  void initState() {
    super.initState();
    _loadTeam();
  }

  Future<void> _loadTeam() async {
    final projectId = widget.data['id'] as String?;
    if (projectId == null) return;

    setState(() => _loadingTeam = true);
    try {
      final assignments =
          await _projectRepo.fetchAssignmentsForProject(projectId);
      if (mounted) {
        setState(() {
          _team = assignments
              .map((a) => {
                    'name': 'Ouvrier ${a.workerId.substring(0, 6)}',
                    'role': a.role ?? 'Artisan',
                  })
              .toList();
        });
      }
    } catch (_) {
      // Leave _team empty if fetch fails
    } finally {
      if (mounted) setState(() => _loadingTeam = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F2),
      body: SafeArea(
        child: Column(
          children: [
            // App Bar
            _buildAppBar(context),

            // Body
            Expanded(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  children: [
                    // Client card
                    _buildClientCard(),
                    const SizedBox(height: 16),

                    // Chantier details
                    _buildChantierDetailsCard(),
                    const SizedBox(height: 16),

                    // L'équipe Kôji
                    _buildTeamCard(),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  // APP BAR
  // ────────────────────────────────────────────────────────────
  Widget _buildAppBar(BuildContext context) {
    return Container(
      color: Theme.of(context).colorScheme.surface,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      child: Row(
        children: [
          GestureDetector(
            onTap: () => context.pop(),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F2),
                borderRadius: BorderRadius.circular(4),
                border: Border.all(color: const Color(0xFFCFCFC9)),
              ),
              child: const Icon(
                Icons.chevron_left_rounded,
                color: Color(0xFF171B1E),
                size: 22,
              ),
            ),
          ),
          const Expanded(
            child: Text(
              'Infos Chantier',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF171B1E),
              ),
            ),
          ),
          const SizedBox(width: 36),
        ],
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  // CLIENT CARD
  // ────────────────────────────────────────────────────────────
  Widget _buildClientCard() {
    return _buildCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar + name + contact icons
          Row(
            children: [
              // Avatar with initial
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  color: const Color(0xFFCFCFC9),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Center(
                  child: Text(
                    _clientName.isNotEmpty
                        ? _clientName[0].toUpperCase()
                        : 'C',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF171B1E),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _clientName,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF171B1E),
                      ),
                    ),
                    if (_clientEmail.isNotEmpty)
                      Text(
                        _clientEmail,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF8A8F98),
                        ),
                      ),
                  ],
                ),
              ),
              // Phone icon
              if (_clientPhone.isNotEmpty)
                _buildContactIcon(Icons.phone_rounded, () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Appel : $_clientPhone')),
                  );
                }),
              if (_clientPhone.isNotEmpty) const SizedBox(width: 8),
              // Email icon
              if (_clientEmail.isNotEmpty)
                _buildContactIcon(Icons.mail_outline_rounded, () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Email : $_clientEmail')),
                  );
                }),
            ],
          ),

          const SizedBox(height: 16),
          const Divider(color: Color(0xFFEFEFEA), height: 1),
          const SizedBox(height: 14),

          // Site address
          if (_fullAddress.isNotEmpty)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.location_on_outlined,
                    size: 16, color: Color(0xFF5B5F66)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _fullAddress,
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF3A3F44),
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            )
          else
            const Row(
              children: [
                Icon(Icons.location_on_outlined,
                    size: 16, color: Color(0xFF5B5F66)),
                SizedBox(width: 8),
                Text(
                  'Adresse non renseignée',
                  style: TextStyle(
                    fontSize: 14,
                    fontStyle: FontStyle.italic,
                    color: Color(0xFF8A8F98),
                  ),
                ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildContactIcon(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: const Color(0xFFEFEFEA),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Icon(icon, size: 18, color: const Color(0xFF3A3F44)),
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  // CHANTIER DETAILS CARD
  // ────────────────────────────────────────────────────────────
  Widget _buildChantierDetailsCard() {
    // Une date ne s'affiche que si l'artisan l'a donnée (retours du build
    // 64 : la fin estimée était inventée, trois mois après aujourd'hui).
    final startDisplay = _startDate.isNotEmpty ? _startDate : 'à définir';
    final endDisplay = _endDate.isNotEmpty ? _endDate : 'à définir';

    // Status badge color
    Color badgeColor;
    Color badgeTextColor;
    switch (_status.toLowerCase()) {
      case 'terminé':
      case 'termine':
        badgeColor = const Color(0xFFDCFCE7);
        badgeTextColor = const Color(0xFF15803D);
        break;
      case 'en attente':
        badgeColor = const Color(0xFFFEF9C3);
        badgeTextColor = const Color(0xFFCA8A04);
        break;
      default:
        badgeColor = const Color(0xFFDCFCE7);
        badgeTextColor = const Color(0xFF15803D);
    }

    return _buildCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(Icons.description_outlined,
                      size: 18, color: Color(0xFF171B1E)),
                  SizedBox(width: 8),
                  Text(
                    'Chantier',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF171B1E),
                    ),
                  ),
                ],
              ),
              // Status badge
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: badgeColor,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  _status,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: badgeTextColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Dates row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Date de début',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF8A8F98),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_outlined,
                            size: 13, color: Color(0xFF5B5F66)),
                        const SizedBox(width: 4),
                        Text(
                          startDisplay,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF171B1E),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Fin estimée',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF8A8F98),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_outlined,
                            size: 13, color: Color(0xFF5B5F66)),
                        const SizedBox(width: 4),
                        Text(
                          endDisplay,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF171B1E),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),
          const Text(
            'Description',
            style: TextStyle(
              fontSize: 12,
              color: Color(0xFF8A8F98),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Référence: $_reference\n'
            'Type de bien: $_propertyType',
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF3A3F44),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  // TEAM CARD
  // ────────────────────────────────────────────────────────────
  Widget _buildTeamCard() {
    return _buildCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.group_outlined, size: 20, color: Color(0xFF171B1E)),
              SizedBox(width: 8),
              Text(
                "L'équipe Koji",
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF171B1E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          if (_loadingTeam)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 12),
                child: CircularProgressIndicator(
                    color: Color(0xFF171B1E), strokeWidth: 2),
              ),
            )
          else ...[
            // Team members
            ..._team.map((member) => _buildTeamMemberRow(member)),

            if (_team.isEmpty)
              const Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'Aucun membre assigné',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF8A8F98),
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),

            // Add contact button
            GestureDetector(
              onTap: _onAddContact,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFEFEFEA),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Icon(
                        Icons.person_add_outlined,
                        size: 20,
                        color: Color(0xFF5B5F66),
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Ajouter un contact',
                            style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                              color: Color(0xFF171B1E),
                            ),
                          ),
                          Text(
                            'Artisans ou partenaires',
                            style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF8A8F98),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFF171B1E)),
                      ),
                      child: const Icon(Icons.add,
                          size: 16, color: Color(0xFF171B1E)),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTeamMemberRow(Map<String, dynamic> member) {
    final name = member['name'] as String? ?? 'Ouvrier';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFCFCFC9),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Center(
              child: Text(
                name.isNotEmpty ? name[0].toUpperCase() : '?',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF171B1E),
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF171B1E),
                  ),
                ),
                Text(
                  member['role'] as String? ?? 'Artisan',
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF8A8F98),
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded,
              color: Color(0xFF8A8F98), size: 20),
        ],
      ),
    );
  }

  // ────────────────────────────────────────────────────────────
  // HELPERS
  // ────────────────────────────────────────────────────────────
  Widget _buildCard({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(4),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }

  void _onAddContact() {
    final nameCtrl = TextEditingController();
    final roleCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
        title: const Text(
          'Ajouter un contact',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF171B1E),
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(hintText: 'Nom'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: roleCtrl,
              decoration: const InputDecoration(
                  hintText: 'Rôle (ex: Architecte)'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Annuler',
                style: TextStyle(color: Color(0xFF5B5F66))),
          ),
          ElevatedButton(
            onPressed: () {
              if (nameCtrl.text.trim().isNotEmpty) {
                setState(() {
                  _team.add({
                    'name': nameCtrl.text.trim(),
                    'role': roleCtrl.text.trim().isNotEmpty
                        ? roleCtrl.text.trim()
                        : 'Partenaire',
                  });
                });
                Navigator.pop(ctx);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF171B1E),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(4)),
              elevation: 0,
            ),
            child: Text('Ajouter',
                style: TextStyle(color: Theme.of(context).colorScheme.surface)),
          ),
        ],
      ),
    );
  }
}