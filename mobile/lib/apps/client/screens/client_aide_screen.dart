import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

/// Adresse du service client des particuliers.
const contactKoji = 'contact@getkoji.io';

/// Un thème de l'aide : titre et questions avec leur réponse courte.
typedef _Theme = (String, List<(String, String)>);

const List<_Theme> _themes = [
  (
    'Mon devis',
    [
      (
        'Comment comparer les propositions ?',
        'Ouvrez votre projet depuis Projets : chaque entreprise y a sa carte, '
            'avec le prix et le détail qu\'elle a donnés. Touchez une carte '
            'pour la choisir, puis suivez son bouton.',
      ),
      (
        'Puis-je changer d\'avis après signature ?',
        'Un devis signé à distance ou chez vous ouvre en général un délai de '
            'rétractation de 14 jours (Code de la consommation), sauf '
            'exceptions comme des travaux urgents demandés par vous. '
            'Prévenez l\'entreprise par écrit.',
      ),
      (
        'Publier une demande coûte-t-il quelque chose ?',
        'Non. Décrire vos travaux et recevoir des propositions est gratuit.',
      ),
    ],
  ),
  (
    'Le chantier',
    [
      (
        'Qui voit mes photos ?',
        'Les photos de votre demande sont masquées. Une entreprise peut '
            'demander à les voir : elle ne les voit que si vous acceptez, '
            'dans son fil de Messages.',
      ),
      (
        'Quand mon téléphone est-il transmis ?',
        'Seulement quand vous confirmez un rendez-vous avec une entreprise. '
            'Avant, vous échangez dans Koji.',
      ),
      (
        'Comment signaler un problème ?',
        'Écrivez d\'abord à l\'entreprise depuis Messages. Si rien ne se '
            'règle, utilisez « Signaler un problème » plus bas : l\'équipe '
            'Koji reçoit votre message.',
      ),
      (
        'Qu\'est-ce qu\'une réserve ?',
        'Un défaut ou un oubli noté par écrit à la réception des travaux. '
            'L\'entreprise doit le reprendre ; la garantie de parfait '
            'achèvement court un an après la réception.',
      ),
    ],
  ),
  (
    'Paiements',
    [
      (
        'Quand payer ?',
        'Aux échéances écrites dans le devis signé : souvent un acompte, '
            'puis le reste selon l\'avancement. En cas de doute, demandez '
            'l\'échéancier à l\'entreprise dans Messages.',
      ),
      (
        'Qu\'est-ce que la retenue de garantie ?',
        'Si le devis la prévoit, une part du prix (5 % au plus) que vous '
            'gardez jusqu\'à un an après la réception, le temps que les '
            'réserves soient levées.',
      ),
    ],
  ),
  (
    'Mon compte',
    [
      (
        'Comment changer mes coordonnées ?',
        'Profil › Coordonnées : prénom, nom, téléphone et mot de passe. '
            'L\'adresse se change dans Profil › Mon logement.',
      ),
      (
        'Comment changer de téléphone ?',
        'Installez Koji sur le nouveau téléphone et connectez-vous avec la '
            'même adresse e-mail : vos projets et vos messages vous suivent.',
      ),
      (
        'Comment télécharger ou supprimer mes données ?',
        'Profil › Mes données : un fichier avec vos données, ou la '
            'suppression du compte, faite sous 30 jours par l\'équipe Koji.',
      ),
    ],
  ),
];

/// Sans accents ni majuscules, pour chercher « reserve » comme « Réserve ».
String _simple(String texte) {
  const accents = {
    'à': 'a', 'â': 'a', 'ä': 'a', 'ç': 'c', 'é': 'e', 'è': 'e', 'ê': 'e',
    'ë': 'e', 'î': 'i', 'ï': 'i', 'ô': 'o', 'ö': 'o', 'ù': 'u', 'û': 'u',
    'ü': 'u', 'œ': 'oe', '’': "'",
  };
  final bas = texte.toLowerCase();
  final sortie = StringBuffer();
  for (final r in bas.runes) {
    final c = String.fromCharCode(r);
    sortie.write(accents[c] ?? c);
  }
  return sortie.toString();
}

/// « Aide » (maquette CLI-06) : un champ qui filtre les questions sur
/// l'appareil, quatre thèmes, puis l'ordre de recours : l'entreprise
/// (Messages), Koji (contact@getkoji.io, signalement /api/support/report),
/// le médiateur (à désigner). Aucune question sur un prix calculé par Koji.
class ClientAideScreen extends ConsumerStatefulWidget {
  const ClientAideScreen({super.key});

  @override
  ConsumerState<ClientAideScreen> createState() => _ClientAideScreenState();
}

class _ClientAideScreenState extends ConsumerState<ClientAideScreen> {
  final _question = TextEditingController();
  String? _ouvert;

  @override
  void dispose() {
    _question.dispose();
    super.dispose();
  }

  void _retour() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/client/profil');
    }
  }

  void _message(String texte) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texte)));
  }

  Future<void> _ecrireKoji() async {
    try {
      final ouvert = await launchUrl(Uri.parse('mailto:$contactKoji'));
      if (!ouvert) _message('Écrivez-nous à $contactKoji.');
    } catch (_) {
      _message('Écrivez-nous à $contactKoji.');
    }
  }

  /// Signalement à l'équipe Koji (/api/support/report), comme avant.
  Future<void> _signaler() async {
    final texte = TextEditingController();
    final envoyer = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: const RoundedRectangleBorder(),
        backgroundColor: ClCharte.riz,
        title: Text('Signaler un problème', style: ClCharte.titre(19)),
        content: ClChamp(
          label: 'Ce qui se passe',
          controller: texte,
          maxLines: 4,
          hint: 'Quelle entreprise, quel chantier, ce qui s\'est passé…',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Annuler', style: ClCharte.texte(14)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text('Envoyer',
                style: ClCharte.texte(14, graisse: FontWeight.w700)),
          ),
        ],
      ),
    );
    final message = texte.text.trim();
    if (envoyer != true || message.isEmpty || !mounted) return;
    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .sendSupportReport('[Signalement artisan] $message');
      _message("Signalement envoyé, l'équipe Koji revient vers vous.");
    } catch (err) {
      _message(err is KojiWebApiException
          ? err.message
          : "Impossible d'envoyer le signalement.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final recherche = _simple(_question.text.trim());
    final trouvees = recherche.isEmpty
        ? const <(String, String)>[]
        : [
            for (final (_, questions) in _themes)
              for (final q in questions)
                if (_simple('${q.$1} ${q.$2}').contains(recherche)) q,
          ];

    return ClEcran(
      titre: 'Aide',
      sousTitre: 'Koji',
      onRetour: _retour,
      corps: ClCorps(children: [
        ClChamp(
          label: 'Votre question',
          controller: _question,
          hint: 'Ex. : puis-je annuler après avoir signé ?',
          textInputAction: TextInputAction.search,
          onChanged: (_) => setState(() {}),
        ),
        if (recherche.isNotEmpty) ...[
          if (trouvees.isEmpty)
            Text(
                'Aucune réponse ne correspond. Écrivez à l\'entreprise ou à '
                'Koji, plus bas.',
                style: ClCharte.texte(13, couleur: ClCharte.gris)),
          for (final q in trouvees) _Reponse(question: q.$1, reponse: q.$2),
        ] else
          for (final (titre, questions) in _themes) ...[
            ClRangee(
              titre: titre,
              detail: questions.map((q) => q.$1).join(' '),
              // « › » tourné vers le bas quand le thème est ouvert.
              fin: RotatedBox(
                quarterTurns: _ouvert == titre ? 1 : 0,
                child: Text('›',
                    style: ClCharte.texte(20,
                        couleur: ClCharte.gris, hauteur: 1)),
              ),
              onTap: () =>
                  setState(() => _ouvert = _ouvert == titre ? null : titre),
            ),
            if (_ouvert == titre)
              for (final q in questions)
                _Reponse(question: q.$1, reponse: q.$2),
          ],
        const ClSection('Un problème avec une entreprise ?'),
        ClRangee(
          titre: "Écrire à l'entreprise",
          detail: 'la plupart des questions se règlent là',
          onTap: () => context.go('/client/messages'),
        ),
        ClRangee(
          titre: 'Contacter Koji',
          detail: contactKoji,
          onTap: _ecrireKoji,
        ),
        ClRangee(
          titre: 'Signaler un problème',
          detail: "l'équipe Koji reçoit votre message",
          onTap: _signaler,
        ),
        const ClRangee(
          titre: 'Médiateur de la consommation',
          detail: 'si le désaccord persiste (à désigner)',
        ),
        Text(
            'Koji met en relation ; le contrat est entre vous et '
            "l'entreprise.",
            style: ClCharte.texte(12, couleur: ClCharte.gris)),
      ]),
    );
  }
}

/// Une question ouverte : titre en gras, réponse courte.
class _Reponse extends StatelessWidget {
  const _Reponse({required this.question, required this.reponse});

  final String question;
  final String reponse;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: ClCharte.blanc,
        border: Border(left: BorderSide(color: ClCharte.marine, width: 2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(question, style: ClCharte.texte(14, graisse: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(reponse, style: ClCharte.texte(13, hauteur: 1.5)),
        ],
      ),
    );
  }
}
