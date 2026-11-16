import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/compte/compte_pro.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json;

// Maquettes PRO-15 à 15.6 (téléphone).
final compte = <String, dynamic>{
  'profil': {'prenom': 'Bilal', 'nom': 'A.', 'telephone': '06 00 00 00 12', 'email': 'entreprise@exemple.invalid', 'google': true, 'motDePasse': true},
  'entreprise': {'nom': 'ABL Expert Renov', 'siren': '992 ••• 651'},
  'etapes': {'faites': 4, 'total': 6, 'reste': "Il reste l'IBAN et le médiateur."},
  'plan': 'business',
  'jetons': {'solde': 18, 'reserves': 3, 'debitesMois': 6, 'inclus': 10, 'achetes': 8},
  'devis': {'regime': 'encaissements', 'regimes': {'encaissements': {'label': 'Assujetti, TVA sur les encaissements'}}, 'conditions': {'validiteJours': 30, 'acomptePct': 30, 'paiementJours': 30}, 'prochaineFacture': 'FAC-2026-0122', 'iban': false, 'mediateur': null, 'mentions': [{'id': 'mediateur', 'label': 'Médiateur de la consommation', 'ok': false, 'manque': 'médiateur à désigner'}]},
  'notifications': {'evenements': {'devis_signe': {'telephone': true, 'email': true, 'sms': false}}, 'silence': true},
  'evenements': [{'id': 'devis_signe', 'label': 'Un devis est signé'}],
  'langue': {'langue': 'fr', 'entrant': true, 'sortant': true, 'apercu': true, 'original': false},
  'langues': [{'id': 'fr', 'nom': 'Français', 'fr': 'par défaut'}, {'id': 'pt', 'nom': 'Português', 'fr': 'portugais'}, {'id': 'ar', 'nom': 'العربية', 'fr': 'arabe', 'rtl': true}],
};

class _FakeRepo extends CompteRepository {
  _FakeRepo() : super(KojiProApi(tokenProvider: () async => 'test'));
  final appels = <Json>[];
  @override
  Future<Json> compte() async => compte_;
  @override
  Future<Json> factures() async => {'abonnement': {'prochainLe': '2026-12-01T00:00:00Z', 'montantTtc': 70.8}, 'factures': [{'numero': 'KJ-ABO-2026-10', 'le': '2026-10-01T00:00:00Z', 'ttc': 70.8}], 'jetons': []};
  @override
  Future<Json> modifier(Json corps) async {
    appels.add(corps);
    return {'langue': {...compte_['langue'] as Map, ...((corps['langue'] as Map?) ?? {})}, 'notifications': corps['notifications'] ?? compte_['notifications']};
  }
}
final compte_ = compte;

String _n(String s) => s.replaceAll(RegExp('[  ]'), ' ');
Finder _contient(String s) => find.byWidgetPredicate((w) => (w is Text && _n(w.data ?? w.textSpan?.toPlainText() ?? '').contains(s)) || (w is RichText && _n(w.text.toPlainText()).contains(s)));

Future<void> _pump(WidgetTester tester, Widget home, _FakeRepo repo) async {
  tester.view.physicalSize = const Size(430, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(ProviderScope(overrides: [compteRepositoryProvider.overrideWithValue(repo)], child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: home)));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('paramètres : sections et étapes du profil', (tester) async {
    await _pump(tester, const ParametresScreen(), _FakeRepo());
    expect(_contient("Il reste l'IBAN et le médiateur."), findsWidgets);
    for (final s in ['Mon entreprise', 'Mon profil', 'Devis et factures', 'Langue et traduction', 'Notifications et sécurité', 'Abonnement et jetons', 'Éléments supprimés', 'Mes données', 'Se déconnecter']) {
      expect(_contient(s), findsWidgets, reason: s);
    }
    expect(_contient('18 jetons'), findsWidgets);
    expect(_contient('médiateur à désigner'), findsWidgets);
  });

  testWidgets('langue : choisir le portugais', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const LangueScreen(), repo);
    await tester.tap(find.text('Português'));
    await tester.pumpAndSettle();
    expect((repo.appels.last['langue'] as Map)['langue'], 'pt');
  });

  testWidgets('notifications : couper l\'e-mail d\'un devis signé', (tester) async {
    final repo = _FakeRepo();
    await _pump(tester, const NotificationsScreen(), repo);
    await tester.tap(find.widgetWithText(FilterChip, 'E-mail'));
    await tester.pumpAndSettle();
    final evt = ((repo.appels.last['notifications'] as Map)['evenements'] as Map)['devis_signe'] as Map;
    expect(evt['email'], false);
  });

  testWidgets('abonnement : rien ne se vend dans l\'app', (tester) async {
    await _pump(tester, const AbonnementScreen(), _FakeRepo());
    expect(_contient('KJ-ABO-2026-10'), findsWidgets);
    expect(_contient("Rien n'est vendu dans l'application"), findsWidgets);
  });
}
