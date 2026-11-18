import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_widgets.dart' show errorText, showFacturesMessage;
import 'package:koji/features/koji/koji_assistant.dart' show ouvrirKoji;

// Aide et support dans Koji Pro (maquette PRO-22, téléphone) : « Demander à
// Koji » en tête, guides par thème (même texte que lib/aide-guides.js du
// site), écrire au support (/api/support/report).
const themesAide = [
  ('Démarrer', 'compte, prix, premier devis', [
    ('Compléter votre profil', "Paramètres › Mon entreprise : six étapes (identité, métiers et zone, vos prix, décennale, IBAN, médiateur). Chaque étape dit ce qu'elle débloque, par exemple la décennale sur vos devis et votre KojiPage."),
    ('Régler vos prix', 'Bibliothèque › Mes prix : votre taux horaire et vos ouvrages. Koji calcule chaque ligne de devis avec vos propres prix, jamais avec des prix inventés.'),
    ('Faire un premier devis avec Koji', "Accueil › Démarrer un devis guidé : Koji pose les questions oubliées, vous validez chaque ligne avant l'envoi."),
  ]),
  ('Devis et signature', 'versions, rétractation, acompte', [
    ('Faire signer un devis', 'Depuis le devis : envoi par e-mail, le client signe en ligne ; ou signature sur place, sur votre téléphone.'),
    ("Pourquoi je ne peux pas envoyer l'acompte ?", "Un devis signé au domicile du client ouvre 14 jours de rétractation et interdit tout paiement avant 7 jours : Koji bloque la facture d'acompte jusqu'à cette date et l'affiche."),
    ('Modifier un devis signé', 'Un devis signé ne se modifie pas : faites une nouvelle version ou un avenant (menu Avenant), que le client signe à son tour.'),
    ('Relancer un devis', 'Devis › Envoyés : un devis sans réponse depuis 7 jours passe « À relancer », avec un message prêt à envoyer.'),
  ]),
  ('Chantier', 'photos, réserves, réception', [
    ('Photos avant, pendant, après', "Fiche du chantier › Photos : la date, l'heure et l'auteur sont ajoutés. Le client ne les voit jamais sans votre accord."),
    ('Réserves et réception', 'Fiche du chantier › Réserves : attribuez chaque réserve, faites-la lever avec une photo. La clôture produit le procès-verbal de réception, avec les réserves non levées.'),
    ('Suivre le coût du chantier', 'Dépenses › Coût des chantiers : dépensé face au prévu du devis, lot par lot, et la marge estimée à la fin.'),
  ]),
  ('Factures', 'situations, avoir, relances', [
    ('Acompte, situation, solde', "Factures › Nouvelle facture, depuis un devis signé : Koji calcule l'acompte, la situation de travaux ou le solde restant dû."),
    ('Comment faire un avoir ?', 'Une facture émise ne se supprime pas. Ouvrez-la et créez un avoir qui la référence, puis une nouvelle facture si besoin.'),
    ('Relancer un impayé', 'Factures › En retard › Relancer : relance aimable puis ferme, par e-mail. La mise en demeure part en recommandé ; Koji la note.'),
  ]),
  ('Radar et jetons', 'se positionner, rendez-vous', [
    ('Se positionner sur un chantier', 'Radar : Koji calcule votre prix avec votre bibliothèque. Des jetons sont réservés quand vous vous positionnez, débités si le client confirme le rendez-vous, rendus sinon.'),
    ('Acheter des jetons', "Paramètres › Abonnement et jetons › Recharger, sur le site. L'app ne vend rien."),
  ]),
  ('Équipe et sous-traitants', 'invitations, documents', [
    ('Inviter un compagnon', 'Équipe › Ajouter un compagnon : il reçoit un lien par SMS, sans mot de passe, et voit sa journée, jamais vos prix.'),
    ('Valider les heures', 'Équipe › Heures : touchez une case pour corriger, puis « Valider la semaine » et « Envoyer au comptable ».'),
    ('Documents des sous-traitants', 'Contacts › fiche du sous-traitant : Kbis, URSSAF, décennale. Koji prévient avant chaque expiration ; le contrat de sous-traitance se prépare depuis Réseau pro.'),
  ]),
];

class AideProScreen extends ConsumerWidget {
  const AideProScreen({super.key});

  Future<void> _ecrire(BuildContext context, WidgetRef ref) async {
    final ctrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Écrire au support', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const Text('Réponse en moins de 4 h ouvrées', style: TextStyle(color: Color(0xFF5B5F66))),
          const SizedBox(height: 12),
          TextField(controller: ctrl, maxLines: 5, decoration: const InputDecoration(hintText: 'Votre question ou le problème', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          KojiButton(label: 'Envoyer', expand: true, onPressed: () => Navigator.pop(ctx, true)),
        ]),
      ),
    );
    if (ok != true || ctrl.text.trim().isEmpty) return;
    try {
      await ref.read(kojiProApiProvider).post('/api/support/report', {'message': ctrl.text.trim(), 'page': 'app/aide', 'accountType': 'entreprise'});
      if (context.mounted) showFacturesMessage(context, 'Message envoyé au support.');
    } catch (e) {
      if (context.mounted) showFacturesMessage(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    return KojiPage(
      title: 'Aide',
      subtitle: 'guides et support',
      appBarOnPhone: true,
      main: [
        Material(
          color: const Color(0xFF171B1E),
          child: InkWell(
            onTap: () => ouvrirKoji(context),
            child: const Padding(
              padding: EdgeInsets.all(16),
              child: Row(children: [
                Icon(Icons.auto_awesome, color: Color(0xFFFFC400)),
                SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Demander à Koji', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                  Text('votre question, à l\'écrit ou à la voix', style: TextStyle(color: Color(0xFFC4C7CC), fontSize: 12)),
                ])),
              ]),
            ),
          ),
        ),
        for (final t in themesAide)
          KojiCard(
            padding: EdgeInsets.zero,
            child: ExpansionTile(
              title: Text(t.$1, style: TextStyle(fontWeight: FontWeight.w700, color: p.heading)),
              subtitle: Text(t.$2, style: TextStyle(fontSize: 12, color: p.muted)),
              childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              children: [
                for (final g in t.$3)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(g.$1, style: const TextStyle(fontWeight: FontWeight.w600)),
                      Text(g.$2, style: TextStyle(fontSize: 13, height: 1.45, color: p.ink)),
                    ]),
                  ),
              ],
            ),
          ),
        KojiButton(label: 'Écrire au support', expand: true, onPressed: () => _ecrire(context, ref)),
        TextButton(onPressed: () => launchUrl(Uri.parse('mailto:entreprise@getkoji.io')), child: const Text('ou entreprise@getkoji.io')),
      ],
    );
  }
}
