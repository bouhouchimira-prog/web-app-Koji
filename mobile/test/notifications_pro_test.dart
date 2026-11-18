import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;
import 'package:koji/features/notifications_pro/notifications_pro.dart';

// Maquette PRO-23 (téléphone) : mardi 3 novembre, 9 h 41.
final _maintenant = DateTime(2026, 11, 3, 9, 41);
final _liste = <Json>[
  {'id': 'n1', 'source': 'web', 'type': 'quote.signed', 'categorie': 'devis', 'title': 'Mme Lefèvre a signé le devis 2026-041', 'message': 'Appartement Caulaincourt · 6 034,82 € TTC · acompte à demander', 'read': false, 'createdAt': DateTime(2026, 11, 3, 9, 12).toIso8601String()},
  {'id': 'n2', 'source': 'web', 'type': 'radar.positionnement', 'categorie': 'radar', 'title': 'Nouveau chantier dans votre zone', 'message': 'Peinture 3 pièces, Paris 18e', 'read': true, 'createdAt': DateTime(2026, 11, 3, 8, 5).toIso8601String()},
  {'id': 'n3', 'source': 'app', 'type': 'worker.rappel_pointage', 'categorie': 'equipe', 'title': 'Heures de la semaine à valider', 'message': '112 h · avant vendredi', 'read': false, 'createdAt': DateTime(2026, 11, 2, 17, 0).toIso8601String()},
  {'id': 'n4', 'source': 'web', 'type': 'invoice.created', 'categorie': 'paiement', 'title': 'Ancienne', 'message': '', 'read': true, 'createdAt': DateTime(2026, 9, 1, 10).toIso8601String()},
];

class _FakeRepo extends CentreNotificationsRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'), null);
  final appels = <String>[];
  @override
  Future<List<Json>> toutes() async => _liste;
  @override
  Future<void> toutLu(List<Json> liste) async => appels.add('toutLu');
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  test('catégories, groupes, heures, archivage à 30 jours', () {
    expect(categorieDe('quote.signed'), 'devis');
    expect(categorieDe('radar.rdv_confirme'), 'rdv');
    expect(groupeDe(DateTime(2026, 11, 3, 8), _maintenant), "Aujourd'hui");
    expect(groupeDe(DateTime(2026, 11, 2, 17), _maintenant), 'Hier');
    expect(groupeDe(DateTime(2026, 10, 20), _maintenant), 'Octobre 2026');
    expect(heureListe(DateTime(2026, 11, 3, 9, 12), _maintenant), '09:12');
    expect(estArchivee(_liste[3], _maintenant), isTrue);
    expect(estArchivee(_liste[0], _maintenant), isFalse);
  });

  testWidgets('centre : groupes par jour, non lues, archivées, tout marquer lu', (tester) async {
    tester.view.physicalSize = const Size(430, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final repo = _FakeRepo();
    await tester.pumpWidget(ProviderScope(
      overrides: [centreNotificationsRepositoryProvider.overrideWithValue(repo)],
      child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: NotificationsCentreScreen(maintenant: _maintenant)),
    ));
    await tester.pumpAndSettle();
    expect(find.text("AUJOURD'HUI"), findsOneWidget);
    expect(find.text('HIER'), findsOneWidget);
    expect(find.text('Mme Lefèvre a signé le devis 2026-041'), findsOneWidget);
    expect(find.text('09:12'), findsOneWidget);
    expect(find.text('Ancienne'), findsNothing);
    expect(find.textContaining('2 non lues'), findsWidgets);
    await tester.tap(find.text('Archivées'));
    await tester.pumpAndSettle();
    expect(find.text('Ancienne'), findsOneWidget);
    await tester.tap(find.text('Tout marquer lu'));
    await tester.pumpAndSettle();
    expect(repo.appels, contains('toutLu'));
  });
}
