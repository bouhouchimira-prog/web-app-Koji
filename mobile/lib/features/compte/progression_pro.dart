import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, num2;
import 'package:koji/features/factures/factures_widgets.dart' show errorText;

// Ma progression (maquette PRO-21, téléphone) sur l'API du site
// (/api/progression) : niveau, points, défis de la semaine, sceau Vérifié.
const progressionRoute = '/progression';

final progressionProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(kojiProApiProvider).get('/api/progression'));

List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
String _s(Object? v) => v == null ? '' : '$v';
String _nombre(Object? n) => num2(n).round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');

class ProgressionScreen extends ConsumerWidget {
  const ProgressionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(progressionProvider);
    if (a.hasError && !a.hasValue) return KojiPage(title: 'Ma progression', appBarOnPhone: true, main: [KojiEmptyState(title: 'Progression indisponible', subtitle: errorText(a.error!), icon: KojiIcons.accueil)]);
    if (!a.hasValue) return const KojiPage(title: 'Ma progression', appBarOnPhone: true, main: [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
    final d = a.value!;
    final niveau = _map(d['niveau']);
    final prochain = d['prochain'] is Map ? _map(d['prochain']) : null;
    final sceau = _map(d['sceau']);
    final p = context.koji;
    Widget coche(bool ok) => Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(shape: BoxShape.circle, color: ok ? const Color(0xFF171B1E) : null, border: Border.all(color: ok ? const Color(0xFF171B1E) : const Color(0xFF8A8F98))),
          child: ok ? const Icon(Icons.check, size: 12, color: Colors.white) : null,
        );
    return KojiPage(
      title: 'Ma progression',
      subtitle: '${_s(niveau['label'])} · ${_nombre(d['points'])} points',
      appBarOnPhone: true,
      onRefresh: () async => ref.invalidate(progressionProvider),
      main: [
        KojiCard(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            for (final n in _liste(d['niveaux']))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  coche(n['atteint'] == true),
                  const SizedBox(width: 10),
                  Text(_s(n['label']), style: TextStyle(fontWeight: n['actuel'] == true ? FontWeight.w700 : FontWeight.w400, color: n['atteint'] == true ? p.ink : p.muted)),
                ]),
              ),
            if (prochain != null) ...[
              const SizedBox(height: 8),
              Text('Prochain niveau : ${_s(prochain['label'])} · ${_s(d['condition'])}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            ],
            const SizedBox(height: 6),
            Text('Les niveaux récompensent l\'usage complet de Koji. Ils n\'achètent aucune place sur le Radar.', style: TextStyle(fontSize: 12, color: p.muted)),
          ]),
        ),
        const KojiSectionTitle('Défis de la semaine'),
        KojiCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          child: Column(children: [
            for (final x in _liste(d['defis']))
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: coche(x['fait'] == true),
                title: Text(_s(x['label']), style: const TextStyle(fontSize: 14)),
                trailing: Text(_s(x['etat']), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
              ),
          ]),
        ),
        Text('se renouvellent lundi', style: TextStyle(fontSize: 12, color: p.muted)),
        const KojiSectionTitle('Sceau Vérifié'),
        KojiCard(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(sceau['affiche'] == true ? 'Vérifié par Koji · affiché sur votre KojiPage' : 'Pas encore affiché', style: const TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            for (final c in _liste(sceau['criteres']))
              Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [coche(c['ok'] == true), const SizedBox(width: 10), Expanded(child: Text(_s(c['label']), style: const TextStyle(fontSize: 13)))])),
            TextButton(onPressed: () => context.push('/profile/company'), child: const Text('Compléter mon profil')),
          ]),
        ),
      ],
    );
  }
}
