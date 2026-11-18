import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:koji/design/liste_vide.dart';

// Maquette PRO-19 : liste vide = comment elle se remplit, une action, une alternative.
void main() {
  testWidgets('liste vide : texte, action principale et alternative', (tester) async {
    var action = 0;
    var alternative = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ListeVide(
          titre: "Aucun chantier pour l'instant",
          texte: 'Un chantier se crée tout seul quand un client signe un devis.',
          action: 'Démarrer un devis guidé',
          onAction: () => action++,
          alternative: 'Voir le Radar des chantiers',
          onAlternative: () => alternative++,
        ),
      ),
    ));
    expect(find.text("Aucun chantier pour l'instant"), findsOneWidget);
    await tester.tap(find.text('Démarrer un devis guidé'));
    await tester.tap(find.text('Voir le Radar des chantiers'));
    expect([action, alternative], [1, 1]);
  });
}
