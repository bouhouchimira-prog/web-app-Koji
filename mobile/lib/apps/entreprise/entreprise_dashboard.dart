import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/entreprise_actions.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/home/widgets/home_today_tasks.dart';
import 'package:koji/features/quote/models/quote_status.dart';
import 'package:koji/features/quote/providers/chantier_provider.dart';
import 'package:koji/features/quote/quote_list_screen.dart';
import 'package:koji/features/subscription/data/subscription_repository.dart';
import 'package:koji/features/subscription/paywall_screen.dart';
import 'package:koji/features/subscription/providers/subscription_provider.dart';

enum _ChantierFilter { actifs, tous, termines }

/// Tableau de bord of the entreprise app (home tab 0), laid out like the
/// design's "Chantiers" board: KPIs, chantiers in progress, devis waiting for
/// a signature, today's tasks and things to keep an eye on.
class EntrepriseDashboard extends ConsumerStatefulWidget {
  const EntrepriseDashboard({super.key, this.bottomPadding = 32});

  /// Room left under the content (the phone bottom bar overlaps the page).
  final double bottomPadding;

  @override
  ConsumerState<EntrepriseDashboard> createState() =>
      _EntrepriseDashboardState();
}

class _EntrepriseDashboardState extends ConsumerState<EntrepriseDashboard> {
  _ChantierFilter _filter = _ChantierFilter.actifs;

  void _openTab(int tab) {
    ref.read(entrepriseHomeTabProvider.notifier).state = tab;
  }

  /// One quote per devis number (the list is newest first, so the first
  /// occurrence is the latest version).
  List<Map<String, dynamic>> _uniqueQuotes(List<Map<String, dynamic>> quotes) {
    final seen = <String>{};
    return quotes.where((q) {
      final key =
          (q['quoteNumber'] ?? q['reference'] ?? q['id'] ?? '').toString();
      if (key.isEmpty) return true;
      return seen.add(key);
    }).toList();
  }

  static double _ttc(Map<String, dynamic> q) {
    final totals = q['totals'] as Map<String, dynamic>? ?? const {};
    return (totals['ttc'] as num?)?.toDouble() ?? 0;
  }

  static DateTime? _date(dynamic v) =>
      v == null ? null : DateTime.tryParse(v.toString())?.toLocal();

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authRepositoryProvider).currentUser;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final chantiersAsync = user == null
        ? const AsyncData<List<Map<String, dynamic>>>([])
        : ref.watch(userChantiersProvider(user.id));
    final quotesAsync = user == null
        ? const AsyncData<List<Map<String, dynamic>>>([])
        : ref.watch(userQuotesProvider(user.id));

    final chantiers = chantiersAsync.valueOrNull ?? const [];
    final quotes = _uniqueQuotes(quotesAsync.valueOrNull ?? const []);
    final now = DateTime.now();
    bool thisMonth(DateTime? d) =>
        d != null && d.year == now.year && d.month == now.month;

    final active = chantiers.where(isChantierActive).toList();
    final inProgress = quotes.where(QuoteStatus.isInProgress).toList();
    final signed = quotes.where(QuoteStatus.isSigned).toList();
    final signedTotal = signed.fold<double>(0, (s, q) => s + _ttc(q));
    final awaitingTotal = inProgress.fold<double>(0, (s, q) => s + _ttc(q));
    final newThisMonth =
        active.where((c) => thisMonth(_date(c['created_at']))).length;
    final signedThisMonth = signed
        .where((q) => thisMonth(_date(q['signed_at'] ?? q['created_at'])))
        .length;

    final greetingName = account == null
        ? null
        : (account.fullName.isNotEmpty
            ? account.firstName
            : account.displayName);

    return LayoutBuilder(builder: (context, c) {
      final wide = c.maxWidth >= 1000;
      final pad = wide ? 32.0 : 20.0;

      final chantiersCard = _ChantiersCard(
        all: chantiers,
        filter: _filter,
        onFilter: (f) => setState(() => _filter = f),
        loading: chantiersAsync.isLoading && chantiers.isEmpty,
        error: chantiersAsync.hasError ? chantiersAsync.error.toString() : null,
        onSeeAll: () => _openTab(2),
        showColumns: wide,
        onArchived: () {
          if (user != null) ref.invalidate(userChantiersProvider(user.id));
        },
      );
      final devisCard = _DevisCard(
        quotes: inProgress,
        loading: quotesAsync.isLoading && quotes.isEmpty,
        onSeeAll: () => _openTab(1),
      );
      final todayCard = KojiCard(
        padding: const EdgeInsets.fromLTRB(22, 20, 22, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            KojiSectionTitle(
              "À faire aujourd'hui",
              action: 'Planning',
              onAction: () => context.push('/planning'),
            ),
            const SizedBox(height: 12),
            if (user == null)
              const KojiEmptyState(
                compact: true,
                icon: KojiIcons.calendrier,
                title: 'Connexion requise',
              )
            else
              const HomeTodayTasks(),
          ],
        ),
      );
      final watchCard = _WatchCard(
          staleQuotes: inProgress.where((q) {
        final d = _date(q['created_at']);
        return d != null && now.difference(d).inDays >= 14;
      }).length);

      return ListView(
        padding:
            EdgeInsets.fromLTRB(pad, wide ? 28 : 22, pad, widget.bottomPadding),
        children: [
          KojiPageHeader(
            title: greetingName == null
                ? 'Tableau de bord'
                : 'Bonjour $greetingName',
            subtitle:
                "Suivez l'avancement de vos chantiers et anticipez la semaine.",
            actions: [
              KojiButton(
                label: 'Nouveau chantier',
                leadingIcon: KojiIcons.plus,
                onPressed: () => createChantier(context, ref),
              ),
            ],
          ),
          const SizedBox(height: 20),
          KojiKpiRow(children: [
            KojiKpi(
              label: 'Chantiers en cours',
              value: '${active.length}',
              sub: newThisMonth > 0 ? '+$newThisMonth ce mois-ci' : '',
              tone: KojiTone.green,
              icon: KojiIcons.chantiers,
              onTap: () => _openTab(2),
            ),
            KojiKpi(
              label: 'Devis en attente',
              value: '${inProgress.length}',
              sub: awaitingTotal > 0
                  ? kojiEuro(awaitingTotal)
                  : 'à faire signer',
              tone: KojiTone.amber,
              icon: KojiIcons.clock,
              onTap: () => _openTab(1),
            ),
            KojiKpi(
              label: 'Devis signés',
              value: '${signed.length}',
              sub: '$signedThisMonth ce mois-ci',
              tone: KojiTone.navy,
              icon: KojiIcons.check,
              onTap: () => _openTab(1),
            ),
            KojiKpi(
              label: "Chiffre d'affaires signé",
              value: kojiEuro(signedTotal),
              sub: 'TTC',
              tone: KojiTone.amber,
              icon: KojiIcons.comptabilite,
            ),
          ]),
          const SizedBox(height: 20),
          if (wide)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 175,
                  child: Column(children: [
                    chantiersCard,
                    const SizedBox(height: 20),
                    devisCard,
                  ]),
                ),
                const SizedBox(width: 20),
                Expanded(
                  flex: 100,
                  child: Column(children: [
                    todayCard,
                    const SizedBox(height: 20),
                    watchCard,
                  ]),
                ),
              ],
            )
          else ...[
            todayCard,
            const SizedBox(height: 16),
            chantiersCard,
            const SizedBox(height: 16),
            devisCard,
            const SizedBox(height: 16),
            watchCard,
          ],
        ],
      );
    });
  }
}

// ── Chantiers ────────────────────────────────────────────────────────────────

class _ChantiersCard extends ConsumerWidget {
  const _ChantiersCard({
    required this.all,
    required this.filter,
    required this.onFilter,
    required this.loading,
    required this.error,
    required this.onSeeAll,
    required this.showColumns,
    required this.onArchived,
  });

  final List<Map<String, dynamic>> all;
  final _ChantierFilter filter;
  final ValueChanged<_ChantierFilter> onFilter;
  final bool loading;
  final String? error;
  final VoidCallback onSeeAll;
  final bool showColumns;
  final VoidCallback onArchived;

  static bool _isArchived(Map<String, dynamic> c) =>
      ((c['status'] as String?) ?? '').toLowerCase() == 'archived';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final visibleAll = all.where((c) => !_isArchived(c)).toList();
    final actifs = visibleAll.where(isChantierActive).toList();
    final termines = visibleAll.where((c) => !isChantierActive(c)).toList();
    final rows = switch (filter) {
      _ChantierFilter.actifs => actifs,
      _ChantierFilter.tous => visibleAll,
      _ChantierFilter.termines => termines,
    };
    const maxRows = 6;

    Widget headerCell(String label,
            {int flex = 1, TextAlign align = TextAlign.left}) =>
        Expanded(
          flex: flex,
          child: Text(
            label.toUpperCase(),
            textAlign: align,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.7,
              color: p.faint,
            ),
          ),
        );

    return KojiCard(
      padding: const EdgeInsets.fromLTRB(22, 20, 22, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            runSpacing: 10,
            spacing: 12,
            children: [
              Text(
                'Chantiers',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: p.heading,
                ),
              ),
              KojiFilterChips<_ChantierFilter>(
                options: {
                  _ChantierFilter.actifs: 'En cours · ${actifs.length}',
                  _ChantierFilter.tous: 'Tous · ${visibleAll.length}',
                  _ChantierFilter.termines: 'Terminés · ${termines.length}',
                },
                value: filter,
                onChanged: onFilter,
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (error != null)
            KojiEmptyState(
              compact: true,
              icon: KojiIcons.alert,
              title: 'Erreur de chargement',
              subtitle: error,
            )
          else if (rows.isEmpty)
            KojiEmptyState(
              compact: true,
              icon: KojiIcons.chantiers,
              title: filter == _ChantierFilter.termines
                  ? 'Aucun chantier terminé'
                  : 'Aucun chantier en cours',
              subtitle:
                  'Créez un chantier pour préparer vos devis et votre planning.',
              action: KojiButton(
                label: 'Nouveau chantier',
                leadingIcon: KojiIcons.plus,
                variant: KojiButtonVariant.secondary,
                onPressed: () => createChantier(context, ref),
              ),
            )
          else ...[
            if (showColumns)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: p.line)),
                ),
                child: Row(
                  children: [
                    headerCell('Chantier', flex: 24),
                    headerCell('Statut', flex: 10),
                    headerCell('Créé le', flex: 7, align: TextAlign.right),
                    const SizedBox(width: 40),
                  ],
                ),
              ),
            for (final c in rows.take(maxRows))
              _ChantierRow(
                  chantier: c,
                  showColumns: showColumns,
                  onArchived: onArchived),
            if (rows.length > maxRows)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: KojiSectionTitle(
                  '+ ${rows.length - maxRows} autres',
                  action: 'Voir tous les chantiers',
                  onAction: onSeeAll,
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class _ChantierRow extends ConsumerWidget {
  const _ChantierRow({
    required this.chantier,
    required this.showColumns,
    required this.onArchived,
  });

  final Map<String, dynamic> chantier;
  final bool showColumns;
  final VoidCallback onArchived;

  static (String, KojiTone) statusOf(Map<String, dynamic> c) {
    final raw = ((c['status'] as String?) ?? '').trim();
    final s = raw.toLowerCase();
    if (s.isEmpty || s == 'en attente') return ('En attente', KojiTone.grey);
    if (!isChantierActive(c)) return ('Terminé', KojiTone.green);
    if (s.contains('retard')) return (raw, KojiTone.coral);
    return (raw, KojiTone.info);
  }

  Future<void> _archive(BuildContext context, WidgetRef ref) async {
    final id = chantier['id'] as String?;
    if (id == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Archiver ce chantier ?'),
        content: const Text('Il sera masqué de la liste active.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Archiver')),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(chantierRepositoryProvider)
          .updateChantierStatus(id, 'archived');
      onArchived();
      messenger.showSnackBar(const SnackBar(content: Text('Chantier archivé')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('Erreur: $e')));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final (label, tone) = statusOf(chantier);
    final place = chantierPlace(chantier);
    final reference = (chantier['reference'] as String?)?.trim() ?? '';
    final title = chantierTitle(chantier);
    final subtitle = [
      if (reference.isNotEmpty && reference != title) reference,
      if (place.isNotEmpty) place,
    ].join(' · ');
    final created = DateTime.tryParse('${chantier['created_at']}')?.toLocal();

    final menu = PopupMenuButton<String>(
      tooltip: 'Actions',
      icon: KojiIcon(KojiIcons.more, size: 20, color: p.muted, strokeWidth: 3),
      onSelected: (v) {
        if (v == 'open') openChantier(context, chantier);
        if (v == 'archive') _archive(context, ref);
      },
      itemBuilder: (_) => const [
        PopupMenuItem(value: 'open', child: Text('Ouvrir le chantier')),
        PopupMenuItem(value: 'archive', child: Text('Archiver')),
      ],
    );

    final info = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
              fontSize: 14.5, fontWeight: FontWeight.w700, color: p.ink),
        ),
        if (subtitle.isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            subtitle,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12.5, color: p.muted),
          ),
        ],
      ],
    );

    return InkWell(
      onTap: () => openChantier(context, chantier),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: p.lineSoft)),
        ),
        child: showColumns
            ? Row(
                children: [
                  Expanded(flex: 24, child: info),
                  Expanded(
                    flex: 10,
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: KojiPill(label, tone: tone),
                    ),
                  ),
                  Expanded(
                    flex: 7,
                    child: Text(
                      created == null
                          ? '—'
                          : DateFormat('d MMM y', 'fr_FR').format(created),
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: p.ink,
                      ),
                    ),
                  ),
                  SizedBox(width: 40, child: menu),
                ],
              )
            : Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: p.navActiveBg,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: KojiIcon(KojiIcons.chantiers,
                        size: 18, color: p.heading),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: info),
                  const SizedBox(width: 8),
                  KojiPill(label, tone: tone),
                  menu,
                ],
              ),
      ),
    );
  }
}

// ── Devis ────────────────────────────────────────────────────────────────────

class _DevisCard extends ConsumerWidget {
  const _DevisCard({
    required this.quotes,
    required this.loading,
    required this.onSeeAll,
  });

  final List<Map<String, dynamic>> quotes;
  final bool loading;
  final VoidCallback onSeeAll;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    const maxRows = 5;
    return KojiCard(
      padding: const EdgeInsets.fromLTRB(22, 20, 22, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          KojiSectionTitle(
            'Devis à faire signer',
            action: 'Tous les devis',
            onAction: onSeeAll,
          ),
          const SizedBox(height: 8),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (quotes.isEmpty)
            const KojiEmptyState(
              compact: true,
              icon: KojiIcons.devis,
              title: 'Aucun devis en cours',
              subtitle: 'Les devis non signés apparaîtront ici.',
            )
          else
            for (final q in quotes.take(maxRows))
              InkWell(
                onTap: () => openSavedQuote(context, ref, q),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 11),
                  decoration: BoxDecoration(
                    border: Border(bottom: BorderSide(color: p.lineSoft)),
                  ),
                  child: Builder(builder: (context) {
                    final client =
                        q['client'] as Map<String, dynamic>? ?? const {};
                    final rawName = (client['name'] as String?)?.trim() ?? '';
                    final name = rawName.isNotEmpty ? rawName : 'Client';
                    final number =
                        (q['quoteNumber'] ?? q['reference'] ?? '').toString();
                    final totals =
                        q['totals'] as Map<String, dynamic>? ?? const {};
                    final ttc = (totals['ttc'] as num?)?.toDouble() ?? 0;
                    return Row(
                      children: [
                        KojiAvatar(name, size: 40),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 14.5,
                                  fontWeight: FontWeight.w700,
                                  color: p.ink,
                                ),
                              ),
                              if (number.isNotEmpty && number != 'N/A')
                                Text(
                                  'Devis $number',
                                  style:
                                      TextStyle(fontSize: 12.5, color: p.muted),
                                ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              kojiEuro(ttc),
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                                color: p.heading,
                              ),
                            ),
                            Text('TTC',
                                style: TextStyle(fontSize: 12, color: p.faint)),
                          ],
                        ),
                        const SizedBox(width: 12),
                        KojiIcon(KojiIcons.chevronRight,
                            size: 16, color: p.faint),
                      ],
                    );
                  }),
                ),
              ),
          if (quotes.length > maxRows)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                '+ ${quotes.length - maxRows} autres devis en attente',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: p.muted,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── À surveiller ─────────────────────────────────────────────────────────────

class _WatchCard extends ConsumerWidget {
  const _WatchCard({required this.staleQuotes});

  /// Devis still unsigned two weeks after creation.
  final int staleQuotes;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(subscriptionStatusProvider).valueOrNull;
    void paywall() => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const PaywallScreen()),
        );

    final alerts = <Widget>[
      if (status?.state == AccessState.expired)
        KojiAlertBox(
          title: 'Essai terminé',
          message:
              'Abonnez-vous pour continuer à créer vos devis et chantiers.',
          tone: KojiTone.coral,
          onTap: paywall,
        )
      else if (status?.state == AccessState.trial)
        KojiAlertBox(
          title: status!.trialDaysLeft <= 1
              ? "Dernier jour d'essai"
              : 'Essai gratuit · ${status.trialDaysLeft} jours restants',
          message: 'Choisissez votre offre pour garder l’accès à Koji Pro.',
          tone: KojiTone.amber,
          icon: KojiIcons.clock,
          onTap: paywall,
        ),
      if (staleQuotes > 0)
        KojiAlertBox(
          title: staleQuotes == 1
              ? '1 devis sans réponse'
              : '$staleQuotes devis sans réponse',
          message:
              'En attente de signature depuis plus de 2 semaines : pensez à relancer.',
          tone: KojiTone.amber,
          icon: KojiIcons.devis,
          onTap: () => ref.read(entrepriseHomeTabProvider.notifier).state = 1,
        ),
    ];

    return KojiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const KojiSectionTitle('À surveiller'),
          const SizedBox(height: 12),
          if (alerts.isEmpty)
            const KojiAlertBox(
              title: 'Tout est à jour',
              message: 'Aucune alerte pour le moment.',
              tone: KojiTone.green,
              icon: KojiIcons.check,
            )
          else
            for (final (i, a) in alerts.indexed) ...[
              if (i > 0) const SizedBox(height: 10),
              a,
            ],
        ],
      ),
    );
  }
}
