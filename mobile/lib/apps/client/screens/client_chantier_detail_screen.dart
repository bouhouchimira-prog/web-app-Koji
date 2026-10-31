import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';

/// Détail d'un chantier (pas de maquette) — gabarit web :
/// app/client/chantier/[id]/page.jsx, lu en entier. Volontairement plus
/// sobre que le site sur deux points, documentés dans le rapport de la
/// mission plutôt que devinés ici :
///  - pas d'en-tête "montant/numéro de devis/date de signature" : sur le
///    site cet écran EST un devis (son id est un id de devis) ; côté
///    Flutter, `ClientChantier` vient d'une vraie table `chantiers`
///    distincte des devis (voir UserRepository.getClientTasks) — les deux
///    notions ne sont pas interchangeables ici sans un vrai lien à
///    confirmer.
///  - pas de bouton "Valider cette tâche" ni de fil de réponses/notes : sur
///    le site, ça passe par /api/client/tasks, /api/task-replies et
///    /api/client/task-notes, qui opèrent sur les tâches DANS un devis
///    (quotes.items) — pas sur `chantier_tasks`, la table que lit cet
///    écran. Écrire à l'aveugle sur l'une ou l'autre risquerait de ne rien
///    changer là où l'entreprise/le site regardent.
class ClientChantierDetailScreen extends ConsumerWidget {
  const ClientChantierDetailScreen({super.key, required this.chantier});

  final ClientChantier chantier;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final c = chantier;
    final (label, tone) = c.status;

    return KojiPage(
      title: c.reference,
      appBarOnPhone: true,
      top: [
        KojiCard(
          child: Row(
            children: [
              KojiProgressRing(percent: (c.progress * 100).round(), size: 64),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          '${c.done} / ${c.total} tâches',
                          style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: p.ink,
                          ),
                        ),
                        const SizedBox(width: 10),
                        KojiPill(label, tone: tone),
                      ],
                    ),
                    const SizedBox(height: 8),
                    KojiProgressBar(
                      value: c.progress,
                      track: p.isDark ? null : const Color(0xFFF1EEE8),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
      main: [
        if (c.id != null)
          KojiButton(
            label: 'Signaler une urgence',
            variant: KojiButtonVariant.secondary,
            leadingIcon: KojiIcons.alert,
            expand: true,
            onPressed: () => showClientUrgentAlert(context, ref, c.id!),
          ),
        const SizedBox(height: 12),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const KojiSectionTitle('Travaux'),
              const SizedBox(height: 10),
              if (c.tasks.isEmpty)
                Text(
                  'Aucun ouvrage pour le moment.',
                  style: TextStyle(fontSize: 13, color: p.muted),
                )
              else
                for (final (i, t) in c.tasks.indexed) ...[
                  if (i > 0) const Divider(height: 18),
                  _TaskRow(task: t),
                ],
            ],
          ),
        ),
      ],
    );
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task});

  final Map<String, dynamic> task;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final done = task['is_done'] == true;
    final label =
        (task['label'] as String?) ?? (task['name'] as String?) ?? 'Tâche';
    final room = task['room'] as String?;

    return Row(
      children: [
        KojiIcon(
          done ? KojiIcons.check : KojiIcons.clock,
          size: 16,
          color: done ? p.toneFg(KojiTone.green) : p.muted,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: p.ink,
                ),
              ),
              if (room?.isNotEmpty == true)
                Text(room!, style: TextStyle(fontSize: 12, color: p.muted)),
            ],
          ),
        ),
        KojiPill(
          done ? 'Terminé' : 'À faire',
          tone: done ? KojiTone.green : KojiTone.amber,
        ),
      ],
    );
  }
}
