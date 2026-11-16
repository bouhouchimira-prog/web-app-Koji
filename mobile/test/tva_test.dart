import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/entreprise/devis/tva.dart';

// TVA automatique (maquette PRO-03.5) : mêmes exemples que le site
// (tests/unit/tva.test.js).
void main() {
  test('choisit le taux sur les trois questions', () {
    expect(decisionTva(client: 'particulier', local: 'logement-ancien').taux, 10);
    expect(decisionTva(client: 'particulier', local: 'logement-ancien', travaux: 'energetique').taux, 5.5);
    expect(decisionTva(client: 'particulier', local: 'logement-ancien', travaux: 'construction').taux, 20);
    expect(decisionTva(client: 'particulier', local: 'logement-neuf').taux, 20);
    expect(decisionTva(client: 'entreprise', local: 'professionnel').taux, 20);
    expect(decisionTva(client: 'entreprise', local: 'logement-ancien').taux, 10);
    final st = decisionTva(client: 'sous-traitance');
    expect([st.taux, st.autoliquidation, st.titre], [0, true, 'Autoliquidation']);
    expect(st.mention, contains('art. 283, 2 nonies'));
    final inconnu = decisionTva(client: 'particulier');
    expect([inconnu.taux, inconnu.question], [null, 'local']);
  });

  test('explique ce que Koji a vérifié et la mention', () {
    final d = decisionTva(client: 'particulier', local: 'logement-ancien');
    expect(d.verifications, ['Client particulier', 'Logement achevé depuis plus de 2 ans', "Pas d'agrandissement de plus de 10 %", 'Pas de reconstruction à neuf']);
    expect(d.mention, startsWith('Je soussigné(e)'));
    expect(decisionTva(client: 'entreprise', local: 'professionnel').mention, '');
    expect(estTauxReduit(5.5), isTrue);
    expect(estTauxReduit(20), isFalse);
  });

  test('pose la bonne question et confirme', () {
    final q = questionTva('local', 'particulier')!;
    expect(q.$1, 'Le logement a-t-il plus de 2 ans ?');
    expect(q.$2, [('Oui', 'logement-ancien'), ('Non, il est neuf', 'logement-neuf')]);
    expect(questionTva('local', 'entreprise')!.$2.first.$2, 'professionnel');
    expect(questionTva('', 'particulier'), isNull);
    expect(confirmationTva(decisionTva(client: 'particulier', local: 'logement-ancien'), nom: 'Claire'),
        'TVA à 10 % appliquée. Claire signera la mention en acceptant le devis.');
    expect(confirmationTva(decisionTva(client: 'entreprise', local: 'professionnel'), client: 'entreprise'), "C'est un local professionnel ou neuf : TVA à 20 %.");
    expect(libelleTauxCourt(10), '10 %');
    expect(libelleTauxCourt(5.5), '5,5 %');
    expect(libelleTauxCourt(0, autoliquidation: true), 'Autoliq.');
  });
}
