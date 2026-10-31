import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/apps/client/screens/client_chantier_detail_screen.dart';
import 'package:koji/design/koji_theme.dart';

void main() {
  testWidgets('shows the reference, progress and tasks of the chantier',
      (tester) async {
    final chantier = ClientChantier('c1', 'Rénovation salle de bain', [
      {'id': 't1', 'label': 'Dépose carrelage', 'room': 'Salle de bain', 'is_done': true},
      {'id': 't2', 'label': 'Pose carrelage', 'room': 'Salle de bain', 'is_done': false},
    ]);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: KojiTheme.light(),
          home: ClientChantierDetailScreen(chantier: chantier),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Rénovation salle de bain'), findsOneWidget);
    expect(find.text('1 / 2 tâches'), findsOneWidget);
    expect(find.text('Dépose carrelage'), findsOneWidget);
    expect(find.text('Pose carrelage'), findsOneWidget);
    expect(find.text('Signaler une urgence'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
