import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/providers/client_providers.dart';

enum _Filter { tous, enCours, aVenir, termines }

/// "Mes chantiers": progress of each chantier addressed to the client, built
/// from the works (chantier_tasks) the entreprise ticks off.
class ClientChantiersScreen extends ConsumerStatefulWidget {
  const ClientChantiersScreen({super.key});

  @override
  ConsumerState<ClientChantiersScreen> createState() =>
      _ClientChantiersScreenState();
}

class _ClientChantiersScreenState extends ConsumerState<ClientChantiersScreen> {
  _Filter _filter = _Filter.tous;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final tasksAsync = ref.watch(clientTasksProvider);
    final chantiers = ClientChantier.group(tasksAsync.valueOrNull ?? const []);
    final enCours =
        chantiers.where((c) => !c.finished && !c.notStarted).toList();
    final aVenir = chantiers.where((c) => c.notStarted && !c.finished).toList();
    final termines = chantiers.where((c) => c.finished).toList();
    final visible = switch (_filter) {
      _Filter.tous => chantiers,
      _Filter.enCours => enCours,
      _Filter.aVenir => aVenir,
      _Filter.termines => termines,
    };
    final remaining = chantiers.fold<int>(0, (s, c) => s + c.total - c.done);
    final totalTasks = chantiers.fold<int>(0, (s, c) => s + c.total);
    final doneTasks = chantiers.fold<int>(0, (s, c) => s + c.done);

    // Next works still to do, across chantiers.
    final next = <(String, String)>[
      for (final c in chantiers)
        for (final t in c.tasks)
          if (t['is_done'] != true)
            ((t['label'] as String?) ?? 'Tâche', c.reference),
    ];

    final Widget list;
    if (tasksAsync.isLoading && chantiers.isEmpty) {
      list = const Padding(
        padding: EdgeInsets.symmetric(vertical: 40),
        child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    } else if (tasksAsync.hasError) {
      list = KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.alert,
          title: 'Impossible de charger le suivi',
          subtitle: '${tasksAsync.error}',
        ),
      );
    } else if (visible.isEmpty) {
      list = KojiCard(
        child: KojiEmptyState(
          icon: KojiIcons.chantiers,
          title: chantiers.isEmpty
              ? 'Aucun chantier pour le moment'
              : 'Aucun chantier dans cette liste',
          subtitle: chantiers.isEmpty
              ? 'Les travaux suivis par votre artisan apparaîtront ici.'
              : null,
        ),
      );
    } else {
      list = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (i, c) in visible.indexed) ...[
            if (i > 0) const SizedBox(height: 14),
            _ChantierCard(chantier: c),
          ],
        ],
      );
    }

    return KojiPage(
      title: 'Mes chantiers',
      subtitle: "Suivez l'avancement de vos travaux, étape par étape.",
      onRefresh: () async => ref.invalidate(clientTasksProvider),
      top: [
        KojiKpiRow(children: [
          KojiKpi(
            label: 'En cours',
            value: '${enCours.length}',
            sub:
                'sur ${chantiers.length} chantier${chantiers.length > 1 ? 's' : ''}',
            tone: KojiTone.navy,
            icon: KojiIcons.chantiers,
          ),
          KojiKpi(
            label: 'À venir',
            value: '${aVenir.length}',
            tone: KojiTone.amber,
            icon: KojiIcons.calendrier,
          ),
          KojiKpi(
            label: 'Terminés',
            value: '${termines.length}',
            tone: KojiTone.green,
            icon: KojiIcons.check,
          ),
          KojiKpi(
            label: 'Tâches restantes',
            value: '$remaining',
            sub: totalTasks == 0
                ? ''
                : '${(doneTasks * 100 / totalTasks).round()} % réalisé',
            tone: KojiTone.navy,
            icon: KojiIcons.interventions,
          ),
        ]),
      ],
      main: [
        KojiFilterChips<_Filter>(
          options: {
            _Filter.tous: 'Tous · ${chantiers.length}',
            _Filter.enCours: 'En cours · ${enCours.length}',
            _Filter.aVenir: 'À venir · ${aVenir.length}',
            _Filter.termines: 'Terminés · ${termines.length}',
          },
          value: _filter,
          onChanged: (f) => setState(() => _filter = f),
        ),
        list,
      ],
      side: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Prochaines étapes'),
              const SizedBox(height: 10),
              if (next.isEmpty)
                Text(
                  chantiers.isEmpty
                      ? 'Rien de prévu pour l’instant.'
                      : 'Toutes les tâches sont terminées.',
                  style: TextStyle(fontSize: 13.5, color: p.muted),
                )
              else
                for (final (label, place) in next.take(5))
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: p.surfaceMuted,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: p.navActiveBg,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: KojiIcon(KojiIcons.clock,
                              size: 17, color: p.heading),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(label,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: p.ink)),
                              Text(place,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style:
                                      TextStyle(fontSize: 12, color: p.muted)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
        KojiPromoCard(
          eyebrow: 'Une question sur les travaux ?',
          text: 'Votre artisan vous répond dans la messagerie du devis.',
          actionLabel: 'Écrire à mon artisan',
          onAction: () => context.go('/client/messages'),
        ),
      ],
    );
  }
}

class _ChantierCard extends ConsumerStatefulWidget {
  const _ChantierCard({required this.chantier});

  final ClientChantier chantier;

  @override
  ConsumerState<_ChantierCard> createState() => _ChantierCardState();
}

class _ChantierCardState extends ConsumerState<_ChantierCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final c = widget.chantier;
    final (label, tone) = c.status;
    final tasks = _expanded ? c.tasks : c.tasks.take(4).toList();

    return KojiCard(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: p.navActiveBg,
                  borderRadius: BorderRadius.circular(13),
                ),
                alignment: Alignment.center,
                child:
                    KojiIcon(KojiIcons.chantiers, size: 20, color: p.heading),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      c.reference,
                      style: TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w800,
                        color: p.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${c.total} tâche${c.total > 1 ? 's' : ''} · ${c.done} terminée${c.done > 1 ? 's' : ''}',
                      style: TextStyle(fontSize: 13, color: p.muted),
                    ),
                  ],
                ),
              ),
              KojiPill(label, tone: tone),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: KojiProgressBar(
                  value: c.progress,
                  track: p.isDark ? null : const Color(0xFFF1EEE8),
                ),
              ),
              const SizedBox(width: 14),
              Text(
                '${(c.progress * 100).round()} %',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: p.heading,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          for (final t in tasks)
            KojiCheckLine(
              (t['label'] as String?) ?? 'Tâche',
              done: t['is_done'] == true,
            ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () => context.push(
                  '/client/chantier/${Uri.encodeComponent(c.id ?? c.reference)}',
                  extra: c,
                ),
                child: const Text('Voir le détail'),
              ),
              if (c.tasks.length > 4)
                TextButton(
                  onPressed: () => setState(() => _expanded = !_expanded),
                  child: Text(_expanded
                      ? 'Réduire'
                      : 'Voir les ${c.tasks.length} tâches'),
                ),
              if (c.id != null)
                TextButton.icon(
                  onPressed: () => showClientUrgentAlert(context, ref, c.id!),
                  style: TextButton.styleFrom(
                    foregroundColor: p.toneFg(KojiTone.coral),
                  ),
                  icon: KojiIcon(KojiIcons.alert,
                      size: 16,
                      color: p.toneFg(KojiTone.coral),
                      strokeWidth: 2),
                  label: const Text('Signaler une urgence'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
