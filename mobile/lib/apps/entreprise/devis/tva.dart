// TVA automatique (maquette PRO-03.5) : port de lib/tva.js, mêmes exemples
// dans test/tva_test.dart et tests/unit/tva.test.js. Koji choisit le taux
// sur trois questions (client, local, travaux), les déduit quand il les
// connaît et les pose sinon. Règles à faire valider par l'expert-comptable.

const clientsTva = [
  ('particulier', 'Particulier'),
  ('entreprise', 'Entreprise'),
  ('sous-traitance', 'Entreprise du bâtiment qui vous sous-traite'),
];

const locauxTva = [
  ('logement-ancien', 'Logement de plus de 2 ans'),
  ('logement-neuf', 'Logement neuf'),
  ('professionnel', 'Local professionnel'),
];

const travauxTva = [
  ('renovation', 'Rénovation'),
  ('energetique', 'Rénovation énergétique'),
  ('construction', 'Construction ou agrandissement'),
];

const mentionTauxReduit =
    "Je soussigné(e), preneur de la prestation, certifie que les travaux réalisés concernent des locaux à usage d'habitation achevés depuis plus de deux ans, qu'ils n'ont pas pour effet de produire un immeuble neuf ni d'augmenter de plus de 10 % la surface de plancher des locaux existants, et que je conserverai ce document signé.";

const mentionAutoliquidation = 'Autoliquidation : TVA due par le preneur assujetti (art. 283, 2 nonies du CGI).';

class DecisionTva {
  const DecisionTva({
    required this.taux,
    required this.autoliquidation,
    required this.question,
    required this.titre,
    required this.verifications,
    required this.mention,
  });

  /// null tant que le local n'est pas connu.
  final num? taux;
  final bool autoliquidation;
  final String question;
  final String titre;
  final List<String> verifications;
  final String mention;
}

DecisionTva decisionTva({String client = 'particulier', String local = '', String travaux = ''}) {
  if (client == 'sous-traitance') {
    return const DecisionTva(
      taux: 0,
      autoliquidation: true,
      question: '',
      titre: 'Autoliquidation',
      verifications: ['Client : entreprise du bâtiment qui vous sous-traite', 'Travaux de construction pour son chantier', "Le donneur d'ordre déclare et déduit la TVA"],
      mention: mentionAutoliquidation,
    );
  }
  final qui = client == 'entreprise' ? 'Client entreprise' : 'Client particulier';
  if (local.isEmpty) {
    return DecisionTva(taux: null, autoliquidation: false, question: 'local', titre: '', verifications: [qui], mention: '');
  }
  if (local == 'professionnel') {
    return DecisionTva(taux: 20, autoliquidation: false, question: '', titre: 'TVA 20 %', verifications: [qui, 'Local professionnel'], mention: '');
  }
  if (local == 'logement-neuf') {
    return DecisionTva(taux: 20, autoliquidation: false, question: '', titre: 'TVA 20 %', verifications: [qui, 'Logement neuf (moins de 2 ans)'], mention: '');
  }
  final base = [qui, 'Logement achevé depuis plus de 2 ans'];
  if (travaux == 'construction') {
    return DecisionTva(taux: 20, autoliquidation: false, question: '', titre: 'TVA 20 %', verifications: [...base, 'Construction ou agrandissement de plus de 10 %'], mention: '');
  }
  if (travaux == 'energetique') {
    return DecisionTva(taux: 5.5, autoliquidation: false, question: '', titre: 'TVA 5,5 %', verifications: [...base, 'Rénovation énergétique'], mention: mentionTauxReduit);
  }
  return DecisionTva(
    taux: 10,
    autoliquidation: false,
    question: '',
    titre: 'TVA 10 %',
    verifications: [...base, "Pas d'agrandissement de plus de 10 %", 'Pas de reconstruction à neuf'],
    mention: mentionTauxReduit,
  );
}

bool estTauxReduit(num? taux) => taux == 10 || taux == 5.5;

/// Question de Koji et ses réponses en un clic : (texte, [(libellé, valeur)]).
(String, List<(String, String)>)? questionTva(String question, String client) {
  if (question != 'local') return null;
  if (client == 'entreprise') {
    return ('Les travaux concernent quel local ?', const [
      ('Local professionnel', 'professionnel'),
      ('Logement de plus de 2 ans', 'logement-ancien'),
      ('Logement neuf', 'logement-neuf'),
    ]);
  }
  return ('Le logement a-t-il plus de 2 ans ?', const [('Oui', 'logement-ancien'), ('Non, il est neuf', 'logement-neuf')]);
}

String confirmationTva(DecisionTva d, {String client = '', String nom = ''}) {
  if (d.taux == null) return '';
  if (d.autoliquidation) return "Devis en autoliquidation, sans TVA : le donneur d'ordre la déclarera.";
  final taux = d.taux.toString().replaceAll('.', ',');
  if (estTauxReduit(d.taux)) return 'TVA à $taux % appliquée. ${nom.isEmpty ? 'Le client' : nom} signera la mention en acceptant le devis.';
  if (client == 'entreprise') return "C'est un local professionnel ou neuf : TVA à $taux %.";
  return 'TVA à $taux % appliquée.';
}

/// Libellé court du taux pour le bandeau (« 10 % », « Autoliq. »).
String libelleTauxCourt(num taux, {bool autoliquidation = false}) =>
    autoliquidation ? 'Autoliq.' : '${(taux == taux.roundToDouble() ? taux.toInt() : taux).toString().replaceAll('.', ',')} %';
