import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart' show openEntrepriseNav;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, num2;
import 'package:koji/features/factures/factures_widgets.dart' show errorText;

// Mon parcours · Premier mois (maquette PRO-26, version 1, téléphone) sur
// l'API du site (/api/parcours) : huit étapes constatées sur les vrais
// chantiers, jetons du Radar offerts à l'étape faite. Grade, hauts faits et
// talents (version 2) : features/parcours/mon_parcours_pro.dart.
const premierMoisRoute = '/parcours/premier-mois';

final premierMoisProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(kojiProApiProvider).get('/api/parcours'));

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
String _pl(int n, String mot) => '$n $mot${n > 1 ? 's' : ''}';

/// Étapes qui se font dans un onglet de l'accueil (retours du build 64) :
/// « Voir mes devis » ouvre l'onglet Devis, « Ouvrir mes chantiers » l'onglet
/// Chantiers. L'accueil n'a pas de route par onglet, d'où ce renvoi par
/// identifiant d'étape. Les autres étapes suivent la route donnée par le site.
const ongletDeLEtape = {'devis-signe': 'devis', 'photo': 'chantiers', 'pv': 'chantiers'};

void _ouvrirEtape(BuildContext context, WidgetRef ref, Json etape) {
  final onglet = ongletDeLEtape[_s(etape['id'])];
  if (onglet != null) {
    openEntrepriseNav(context, ref, onglet);
    return;
  }
  final route = _s(etape['app']);
  if (route.isNotEmpty) context.push(route);
}

class PremierMoisScreen extends ConsumerWidget {
  const PremierMoisScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(premierMoisProvider);
    if (a.hasError && !a.hasValue) return KojiPage(title: 'Mon parcours', appBarOnPhone: true, main: [KojiEmptyState(title: 'Parcours indisponible', subtitle: errorText(a.error!), icon: KojiIcons.accueil)]);
    if (!a.hasValue) return const KojiPage(title: 'Mon parcours', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    final d = a.value!;
    final f = _map(d['fenetre']);
    final faites = num2(d['faites']).round();
    final total = num2(d['total']).round();
    final offerts = num2(d['jetonsOfferts']).round();
    final restants = num2(f['joursRestants']).round();
    final ouverte = f['ouverte'] == true;
    final prochaine = d['prochaine'] is Map ? _map(d['prochaine']) : null;
    final nouveaux = num2(d['nouveauxJetons']).round();
    final p = context.koji;
    return KojiPage(
      title: 'Mon parcours',
      subtitle: ouverte ? 'Premier mois · ${_pl(restants, 'jour')} restant${restants > 1 ? 's' : ''}' : 'Premier mois',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(premierMoisProvider),
      main: [
        if (nouveaux > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text('${_pl(nouveaux, 'jeton')} offert${nouveaux > 1 ? 's' : ''} ajouté${nouveaux > 1 ? 's' : ''} à votre solde du Radar.', style: const TextStyle(fontWeight: FontWeight.w600)),
          ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          color: const Color(0xFF171B1E),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Premier mois · $faites sur $total', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('${_pl(offerts, 'jeton')} offert${offerts > 1 ? 's' : ''} sur ${num2(d['jetonsTotal']).round()}', style: const TextStyle(color: Color(0xFFC4C7CC), fontSize: 12)),
            const SizedBox(height: 8),
            ClipRect(
              child: SizedBox(
                height: 4,
                child: Stack(children: [
                  Container(color: const Color(0xFF3A3F43)),
                  FractionallySizedBox(widthFactor: total == 0 ? 0 : faites / total, child: Container(color: const Color(0xFFFFC400))),
                ]),
              ),
            ),
            const SizedBox(height: 8),
            const Text('Les étapes se font sur vos vrais chantiers, pas sur des exemples.', style: TextStyle(color: Color(0xFFC4C7CC), fontSize: 12)),
          ]),
        ),
        if (!ouverte && restants == 0 && faites < total)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text('Le premier mois est terminé : les étapes restent utiles, mais n\'offrent plus de jetons.', style: TextStyle(fontSize: 12, color: p.muted)),
          ),
        const SizedBox(height: 12),
        KojiCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Column(children: [
            for (final e in _liste(d['etapes']))
              Material(
                type: MaterialType.transparency,
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  onTap: () => _ouvrirEtape(context, ref, e),
                  leading: Container(
                    width: 26,
                    height: 26,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: e['faite'] == true ? const Color(0xFF171B1E) : null, border: Border.all(color: e['faite'] == true ? const Color(0xFF171B1E) : const Color(0xFFCFCFC9), width: 1.5)),
                    child: e['faite'] == true ? const Icon(Icons.check, size: 14, color: Color(0xFFFFC400)) : Text(_s(e['numero']), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: p.muted)),
                  ),
                  title: Text(_s(e['titre']), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text(e['faite'] == true || _s(e['reste']).isEmpty ? _s(e['detail']) : _s(e['reste']), style: TextStyle(fontSize: 12, color: p.muted)),
                  trailing: Text('+ ${_pl(num2(e['jetons']).round(), 'jeton')}${e['creditee'] == true ? '\noffert' : ''}', textAlign: TextAlign.right, style: TextStyle(fontSize: 12, color: p.muted)),
                ),
              ),
          ]),
        ),
        if (prochaine != null) ...[
          const SizedBox(height: 12),
          KojiButton(label: _s(prochaine['action']), onPressed: () => _ouvrirEtape(context, ref, prochaine)),
        ],
        const KojiSectionTitle('Pourquoi ces huit étapes'),
        Text('Chaque étape correspond à une fonction qui vous fait gagner du temps ou de l\'argent ; les jetons sont offerts quand l\'étape est faite, pas avant. Après le premier mois, la liste disparaît de l\'accueil. Rien n\'est obligatoire : Koji fonctionne sans.', style: TextStyle(fontSize: 13, color: p.muted)),
      ],
    );
  }
}
