import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';

/// "Aide" page of both apps (design: "Aide" / "Client — Aide"): frequent
/// questions about how koji works today, plus a way to reach support.
class KojiHelpScreen extends StatelessWidget {
  const KojiHelpScreen({super.key});

  static const _clientFaq = [
    (
      'Comment accéder à mon chantier ?',
      "Votre artisan vous envoie un identifiant et un mot de passe. Sur la page "
          "de connexion, choisissez « Identifiant chantier » et saisissez-les : "
          "vous retrouvez votre devis, le suivi des travaux et la messagerie.",
    ),
    (
      'Comment signer un devis ?',
      "Ouvrez le devis depuis « Devis reçus », vérifiez son contenu puis "
          "touchez « Signer ». Dessinez votre signature : l'artisan est "
          "prévenu immédiatement.",
    ),
    (
      'Je ne vois pas mes devis avec mon e-mail',
      "Les devis sont rattachés à l'adresse e-mail que votre artisan a "
          "renseignée sur le chantier. Vérifiez avec lui qu'il s'agit bien de "
          "l'adresse de votre compte, ou utilisez l'identifiant chantier.",
    ),
    (
      'Comment contacter mon artisan ?',
      "Depuis « Messages », choisissez le devis concerné et écrivez votre "
          "message : il est rattaché au chantier et visible par l'entreprise.",
    ),
    (
      'Que faire en cas de problème sur le chantier ?',
      "Dans « Mes chantiers », touchez « Signaler une urgence » sur le "
          "chantier concerné : l'entreprise reçoit une alerte.",
    ),
  ];

  static const _entrepriseFaq = [
    (
      'Comment créer mon premier devis ?',
      "Créez d'abord un chantier (« + Nouveau chantier ») avec l'adresse et "
          "l'e-mail du client, puis ouvrez l'onglet Devis du chantier pour "
          "ajouter vos lots, ouvrages et fournitures.",
    ),
    (
      'Comment mon client signe-t-il ?',
      "Envoyez le devis depuis le récapitulatif. Votre client le signe en "
          "ligne ou dans l'application Koji ; vous recevez une notification "
          "dès la signature.",
    ),
    (
      'Comment donner un accès à mes ouvriers ?',
      "Dans « Équipe », ouvrez vos ouvriers et créez-en un : un identifiant "
          "et un mot de passe sont générés. L'ouvrier se connecte dans Koji Pro "
          "avec l'onglet « Ouvrier » et voit ses tâches.",
    ),
    (
      'Où trouver mes factures ?',
      "Dans « Facturation », choisissez un chantier pour créer une facture "
          "(acompte, intermédiaire ou finale) et suivre les paiements.",
    ),
    (
      'Comment gérer mon abonnement ?',
      "Le menu affiche l'état de votre essai ou de votre abonnement. "
          "Touchez-le pour voir les offres et vous abonner.",
    ),
  ];

  Future<void> _mail() async {
    await launchUrl(
      Uri.parse('mailto:${KojiAppConfig.supportEmail}?subject=Aide%20Koji'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final faq = KojiAppConfig.isClient ? _clientFaq : _entrepriseFaq;
    final wide = MediaQuery.sizeOf(context).width >= 900;

    final questions = KojiCard(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const KojiSectionTitle('Questions fréquentes'),
          const SizedBox(height: 6),
          for (final (q, a) in faq) _FaqTile(question: q, answer: a),
        ],
      ),
    );

    final side = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KojiPromoCard(
          eyebrow: "Besoin d'un coup de main ?",
          text: "Écrivez-nous : notre équipe vous répond au plus vite.",
          actionLabel: 'Écrire au support',
          onAction: _mail,
        ),
        const SizedBox(height: 16),
        KojiCard(
          child: Row(
            children: [
              KojiIcon(KojiIcons.mail, size: 20, color: context.koji.heading),
              const SizedBox(width: 12),
              Expanded(
                child: SelectableText(
                  KojiAppConfig.supportEmail,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: context.koji.ink,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );

    return Scaffold(
      appBar: wide ? null : AppBar(title: const Text('Aide')),
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.fromLTRB(
              wide ? 32 : 20, wide ? 28 : 8, wide ? 32 : 20, 32),
          children: [
            KojiPageHeader(
              title: wide ? 'Aide' : 'Comment pouvons-nous aider ?',
              subtitle: KojiAppConfig.isClient
                  ? 'Questions fréquentes et support pour vos travaux.'
                  : 'Questions fréquentes et support pour tirer le meilleur de Koji.',
            ),
            const SizedBox(height: 20),
            if (wide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(flex: 18, child: questions),
                  const SizedBox(width: 20),
                  Expanded(flex: 10, child: side),
                ],
              )
            else ...[
              questions,
              const SizedBox(height: 16),
              side,
            ],
          ],
        ),
      ),
    );
  }
}

class _FaqTile extends StatefulWidget {
  const _FaqTile({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InkWell(
          onTap: () => setState(() => _open = !_open),
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.question,
                    style: TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: p.ink,
                    ),
                  ),
                ),
                AnimatedRotation(
                  turns: _open ? 0.25 : 0,
                  duration: const Duration(milliseconds: 150),
                  child: KojiIcon(KojiIcons.chevronRight,
                      size: 18, color: p.muted),
                ),
              ],
            ),
          ),
        ),
        AnimatedCrossFade(
          duration: const Duration(milliseconds: 160),
          crossFadeState:
              _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
          firstChild: const SizedBox(width: double.infinity),
          secondChild: Padding(
            padding: const EdgeInsets.only(bottom: 14, right: 24),
            child: Text(
              widget.answer,
              style: TextStyle(fontSize: 13.5, height: 1.55, color: p.inkSoft),
            ),
          ),
        ),
        Divider(color: p.lineSoft),
      ],
    );
  }
}
