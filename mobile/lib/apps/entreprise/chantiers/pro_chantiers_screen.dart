import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/chantiers/chantiers_liste.dart';
import 'package:koji/apps/entreprise/chantiers/pro_lancer_chantier_screen.dart';
import 'package:koji/apps/entreprise/entreprise_search.dart';
import 'package:koji/apps/entreprise/pro_home/pro_da.dart';
import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/design/koji_brand_marks.dart';

/// Données de la liste, lues sur le site comme la fiche chantier : chantiers,
/// devis, tâches, rendez-vous, factures, alertes. Une liste illisible reste
/// vide : la liste s'affiche quand même.
final proChantiersProvider =
    FutureProvider.autoDispose<List<LigneChantier>>((ref) async {
  final api = ref.watch(proKojiWebProvider);
  Future<List<Map<String, dynamic>>> lire(String path, String key) =>
      api.liste(path, key).catchError((_) => <Map<String, dynamic>>[]);
  final r = await Future.wait([
    api.liste('/api/projects', 'projects'),
    lire('/api/quotes', 'quotes'),
    lire('/api/tasks', 'tasks'),
    lire('/api/calendar-events', 'calendarEvents'),
    lire('/api/invoices', 'invoices'),
    lire('/api/urgent-alerts', 'alerts'),
  ]);
  return lignesChantiers(
    projects: r[0],
    quotes: r[1],
    tasks: r[2],
    calendarEvents: r[3],
    invoices: r[4],
    alerts: r[5],
    maintenant: DateTime.now(),
  );
});

/// Koji Pro, Chantiers (maquette PRO-02, cadre téléphone) : barre graphite,
/// « Chantiers » et le résumé, « Nouveau chantier », la recherche, les
/// onglets En cours / À planifier / Clôturés, une carte par chantier (lots,
/// montant, avancement, prochain jalon, ce qui bloque).
class ProChantiersScreen extends ConsumerStatefulWidget {
  const ProChantiersScreen({super.key, this.barre = true});

  /// Barre graphite du haut (téléphone) ; la version large a déjà la sienne.
  final bool barre;

  @override
  ConsumerState<ProChantiersScreen> createState() => _ProChantiersScreenState();
}

class _ProChantiersScreenState extends ConsumerState<ProChantiersScreen> {
  String? _onglet;
  final _recherche = TextEditingController();

  @override
  void dispose() {
    _recherche.dispose();
    super.dispose();
  }

  /// Devis signé, rien de planifié : « Lancer le chantier » (PRO-02.1) ;
  /// sinon la fiche du chantier.
  Future<void> _ouvrir(LigneChantier l) async {
    if (!l.aLancer) {
      context.push('/chantier/dashboard', extra: {'id': l.id});
      return;
    }
    final lance = await Navigator.of(context, rootNavigator: true).push<bool>(
      MaterialPageRoute(
          builder: (_) => ProLancerChantierScreen(projectId: l.id)),
    );
    if (lance == true) ref.invalidate(proChantiersProvider);
  }

  @override
  Widget build(BuildContext context) {
    final da = ProDa.of(context);
    final asyncLignes = ref.watch(proChantiersProvider);
    final lignes = asyncLignes.valueOrNull ?? const <LigneChantier>[];
    final comptes = compterOnglets(lignes);
    final onglet = _onglet ??
        ((comptes['en_cours'] ?? 0) > 0 ? 'en_cours' : 'a_planifier');
    final cherche = _recherche.text.trim().toLowerCase();
    final visibles = lignes
        .where((l) => l.onglet == onglet)
        .where((l) => cherche.isEmpty || l.recherche.contains(cherche))
        .toList();

    final contenu = RefreshIndicator(
      color: da.ink,
      onRefresh: () async => ref.invalidate(proChantiersProvider),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Text('Chantiers',
              style: da.text(26, weight: FontWeight.w700, height: 1.2)),
          const SizedBox(height: 2),
          Text(
              asyncLignes.isLoading && lignes.isEmpty
                  ? 'Chargement…'
                  : resumeChantiers(comptes),
              style: da.text(13, color: da.grey)),
          const SizedBox(height: 14),
          ProPrimaryButton(
            label: 'Nouveau chantier',
            icon: Icons.add,
            expand: true,
            onPressed: () => context.push('/chantier/create'),
          ),
          const SizedBox(height: 12),
          _champRecherche(da),
          const SizedBox(height: 12),
          _onglets(da, onglet, comptes),
          const SizedBox(height: 12),
          if (asyncLignes.hasError && lignes.isEmpty)
            _message(da, 'Chantiers indisponibles pour le moment',
                'Vérifiez la connexion, puis tirez la liste vers le bas.')
          else if (asyncLignes.isLoading && lignes.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                  child: SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(strokeWidth: 2))),
            )
          else if (visibles.isEmpty)
            _message(
              da,
              cherche.isNotEmpty
                  ? 'Aucun chantier ne correspond à cette recherche.'
                  : lignes.isEmpty
                      ? 'Aucun chantier pour le moment'
                      : 'Aucun chantier dans cet onglet.',
              lignes.isEmpty
                  ? 'Créez-en un avec « Nouveau chantier » ou depuis un devis signé.'
                  : null,
            )
          else
            for (final l in visibles) ...[
              _carte(da, l),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );

    return ColoredBox(
      color: da.page,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.barre) _barre(da),
          Expanded(child: contenu),
        ],
      ),
    );
  }

  Widget _barre(ProDa da) {
    final entreprise =
        ref.watch(currentAccountProvider).valueOrNull?.displayName ?? '';
    return Container(
      color: const Color(0xFF171B1E),
      padding: EdgeInsets.fromLTRB(
          18, MediaQuery.paddingOf(context).top + 12, 8, 12),
      child: Row(
        children: [
          const KojiWordmark(height: 14, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(
            child: Text(entreprise,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: da.text(12, color: const Color(0xFFA7ABB2))),
          ),
          IconButton(
            tooltip: 'Rechercher',
            onPressed: () => showEntrepriseSearch(context, ref),
            icon: const Icon(Icons.search, color: Colors.white, size: 22),
          ),
        ],
      ),
    );
  }

  Widget _champRecherche(ProDa da) {
    OutlineInputBorder bord(Color c, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(4),
        borderSide: BorderSide(color: c, width: w));
    return TextField(
      controller: _recherche,
      onChanged: (_) => setState(() {}),
      style: da.text(14),
      decoration: InputDecoration(
        isDense: true,
        filled: true,
        fillColor: da.card,
        hintText: 'Rechercher un chantier',
        hintStyle: da.text(14, color: da.grey),
        prefixIcon: Icon(Icons.search, size: 18, color: da.grey),
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        enabledBorder: bord(da.frame),
        focusedBorder: bord(da.ink, 2),
      ),
    );
  }

  /// Onglets classeur (maquette « tabs-line ») : fond gris, l'onglet actif
  /// blanc avec le fil jaune.
  Widget _onglets(ProDa da, String actif, Map<String, int> comptes) {
    Widget onglet(String id, String label) {
      final on = id == actif;
      return Expanded(
        child: Semantics(
          button: true,
          selected: on,
          child: GestureDetector(
            onTap: () => setState(() => _onglet = id),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: const EdgeInsets.fromLTRB(4, 8, 4, 7),
              decoration: BoxDecoration(
                color: on ? Colors.white : const Color(0xFFDEDED6),
                border: Border(
                  top: BorderSide(
                      color: on ? ProDa.prim : Colors.transparent, width: 3),
                  left: const BorderSide(color: Color(0xFFCFCFC9)),
                  right: const BorderSide(color: Color(0xFFCFCFC9)),
                ),
              ),
              alignment: Alignment.center,
              child: Text('$label ${comptes[id] ?? 0}',
                  style: da.text(13,
                      weight: on ? FontWeight.w700 : FontWeight.w600,
                      color: on
                          ? const Color(0xFF171B1E)
                          : const Color(0xFF3A3F44))),
            ),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 0),
      decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: Color(0xFFCFCFC9)))),
      child: Row(
        children: [
          for (final (i, (id, label)) in ongletsChantiers.indexed) ...[
            if (i > 0) const SizedBox(width: 3),
            onglet(id, label),
          ],
        ],
      ),
    );
  }

  Widget _message(ProDa da, String titre, [String? detail]) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(titre, style: da.text(14, weight: FontWeight.w600)),
            if (detail != null) ...[
              const SizedBox(height: 4),
              Text(detail, style: da.text(13, color: da.grey)),
            ],
          ],
        ),
      );

  Widget _carte(ProDa da, LigneChantier l) {
    final ton = switch (l.ton) {
      TonEtiquette.plein => ProTagTone.solid,
      TonEtiquette.gris => ProTagTone.grey,
      TonEtiquette.encre => ProTagTone.ink,
    };
    final av = l.avancement;
    return Semantics(
      button: true,
      label: '${l.titre}, ${l.etiquette}',
      child: GestureDetector(
        onTap: () => _ouvrir(l),
        behavior: HitTestBehavior.opaque,
        child: ProCard(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l.titre,
                            style: da.text(15, weight: FontWeight.w600)),
                        if (l.client.isNotEmpty || l.ville.isNotEmpty)
                          Text(l.client.isNotEmpty ? l.client : l.ville,
                              style: da.text(12, color: da.grey)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  ProTag(l.etiquette, tone: ton),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(av?.texte ?? 'Pas encore de devis',
                        style: da.text(12, weight: FontWeight.w600)),
                  ),
                  Text(l.montant, style: da.text(12, weight: FontWeight.w600)),
                ],
              ),
              if (av != null) ...[
                const SizedBox(height: 8),
                ClipRect(
                  child: LinearProgressIndicator(
                    value: av.part,
                    minHeight: 6,
                    color: da.ink,
                    backgroundColor: const Color(0xFFE2E2DB),
                  ),
                ),
              ],
              const SizedBox(height: 8),
              Text(l.jalon.isEmpty ? 'Rien de prévu' : l.jalon,
                  style: da.text(13, color: l.jalon.isEmpty ? da.grey : null)),
              if (l.detail.isNotEmpty) ...[
                const SizedBox(height: 2),
                Text(l.detail, style: da.text(12, color: da.grey)),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
