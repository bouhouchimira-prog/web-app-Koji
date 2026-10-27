import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:go_router/go_router.dart';
import 'package:koji/features/synchronization/data/worker_model.dart';
import 'package:koji/features/synchronization/data/worker_repository.dart';

class WorkerSuccessScreen extends StatefulWidget {
  final Worker? worker;

  const WorkerSuccessScreen({super.key, this.worker});

  @override
  State<WorkerSuccessScreen> createState() => _WorkerSuccessScreenState();
}

class _WorkerSuccessScreenState extends State<WorkerSuccessScreen> {
  // Re-fetch the worker by id so we always have the access_code / password the
  // backend generated (the passed-in object may not carry them).
  late Worker? worker = widget.worker;

  @override
  void initState() {
    super.initState();
    _refreshWorker();
  }

  Future<void> _refreshWorker() async {
    final id = widget.worker?.id;
    if (id == null) return;
    final fresh = await WorkerRepository().getWorkerById(id);
    if (fresh != null && mounted) setState(() => worker = fresh);
  }

  /// Bottom sheet showing the worker's Identifiant + Mot de passe with copy.
  void _showCredentials() {
    final w = worker;
    if (w == null) return;
    final code = w.accessCode ?? '';
    final password = w.accessPassword ?? '';

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
            ),
            Text("Accès de ${w.firstName} ${w.lastName}",
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0A1227))),
            const SizedBox(height: 4),
            Text(
              "Communiquez ces identifiants à l'ouvrier pour qu'il consulte ses tâches dans l'Espace Particulier.",
              style: TextStyle(fontSize: 13, color: Colors.grey[500]),
            ),
            const SizedBox(height: 20),
            if (code.isEmpty && password.isEmpty)
              Text(
                "Identifiants indisponibles. Vérifiez que le script worker_access.sql a été exécuté dans Supabase.",
                style: TextStyle(fontSize: 13, color: Colors.red[400]),
              )
            else ...[
              _credField("Identifiant", code),
              const SizedBox(height: 12),
              _credField("Mot de passe", password),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Clipboard.setData(ClipboardData(
                        text:
                            "Identifiant : $code\nMot de passe : $password"));
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text("Identifiants copiés")),
                    );
                  },
                  icon: const Icon(Icons.copy, size: 18),
                  label: const Text("Copier les identifiants"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0A1227),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _credField(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFF5F8FF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE0E7FF)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style:
                        TextStyle(fontSize: 12, color: Colors.grey[500])),
                const SizedBox(height: 2),
                SelectableText(
                  value,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF0F3995),
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.copy, size: 18, color: Color(0xFF1D74FF)),
            onPressed: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text("$label copié")),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const darkNavy = Color(0xFF0A1227);
    const appBg = Color(0xFFFBFBFC);

    return Scaffold(
      backgroundColor: appBg,
      body: Stack(
        children: [
          // Background Gradient
          Positioned(
            top: -50,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFFBE4D2).withValues(alpha: 0.6),
                    const Color(0xFFFBE4D2).withValues(alpha: 0.0),
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32.0),
              child: Column(
                children: [
                  const Spacer(flex: 2),

                  // Green checkmark
                  Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF10B981)
                                  .withValues(alpha: 0.3),
                              blurRadius: 20,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Icon(Icons.check,
                            color: Theme.of(context).colorScheme.surface, size: 36),
                      ),
                    ),
                  ),

                  const SizedBox(height: 32),

                  // Title
                  const Text(
                    "Profil Créé avec Succès!",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: darkNavy,
                    ),
                  ),

                  const SizedBox(height: 12),

                  Text(
                    "Le nouveau collaborateur a été ajouté\nà votre base de données",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[400],
                      height: 1.5,
                    ),
                  ),

                  const SizedBox(height: 40),

                  // Worker card — tap to reveal the Identifiant + Mot de passe.
                  if (worker != null)
                    GestureDetector(
                      onTap: _showCredentials,
                      child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          // Avatar
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFD93D)
                                  .withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: const Icon(Icons.person,
                                color: Color(0xFFFFD93D), size: 28),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "${worker!.firstName} ${worker!.lastName}",
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: darkNavy,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Container(
                                      width: 8,
                                      height: 8,
                                      decoration: const BoxDecoration(
                                        color: Color(0xFF10B981),
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      "${worker!.profession} - ${worker!.status}",
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Colors.grey[400],
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.chevron_right,
                              color: Colors.grey[300], size: 22),
                        ],
                      ),
                    ),
                    ),

                  if (worker != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      "Touchez la carte pour voir l'identifiant et le mot de passe",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Colors.grey[400]),
                    ),
                  ],

                  const Spacer(flex: 3),

                  // Affecter à un chantier Button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () {
                        context.go('/projects');
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: darkNavy,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            "Affecter à un chantier",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: Theme.of(context).colorScheme.surface,
                            ),
                          ),
                          SizedBox(width: 8),
                          Icon(Icons.arrow_forward,
                              color: Theme.of(context).colorScheme.surface, size: 20),
                        ],
                      ),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Voir la liste button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: OutlinedButton(
                      onPressed: () => context.go('/workers'),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                        side: BorderSide.none,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                        elevation: 1,
                        shadowColor:
                            Colors.black.withValues(alpha: 0.06),
                      ),
                      child: const Text(
                        "Voir la liste des ouvriers",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: darkNavy,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
