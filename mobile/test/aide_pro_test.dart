import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_theme.dart';
import 'package:koji/features/help/aide_pro.dart';

// Maquette PRO-22 (téléphone) : Demander à Koji, guides par thème, support.
void main() {
  setUp(() => KojiAppConfig.use(KojiAppKind.entreprise));

  testWidgets('aide : Koji en tête, six thèmes, guides, support', (tester) async {
    tester.view.physicalSize = const Size(430, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(ProviderScope(child: MaterialApp(theme: KojiTheme.light(KojiAppKind.entreprise), home: const AideProScreen())));
    await tester.pumpAndSettle();
    expect(find.text('Demander à Koji'), findsOneWidget);
    expect(themesAide.length, 6);
    expect(find.text('Radar et jetons'), findsOneWidget);
    await tester.tap(find.text('Factures'));
    await tester.pumpAndSettle();
    expect(find.text('Comment faire un avoir ?'), findsOneWidget);
    expect(find.text('Écrire au support'), findsOneWidget);
  });
}
