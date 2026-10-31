import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

const _themes = [
  ('premiers-pas', '🚀', 'Premiers pas'),
  ('publier', '📣', 'Publier un chantier'),
  ('messages', '💬', 'Échanger avec un artisan'),
  ('chantiers', '🏗️', 'Mes chantiers et devis'),
  ('compte', '🛡️', 'Mon compte'),
];

const _articles = [
  (
    'premiers-pas',
    'Découvrir l\'espace particulier',
    "Accueil regroupe l'essentiel : vos demandes en cours et vos chantiers "
        'signés. Le menu donne accès à Mes demandes, Devis reçus, Mes '
        'chantiers et Messages.',
  ),
  (
    'publier',
    'Publier un chantier gratuitement',
    'Depuis "+ Publier un chantier", décrivez votre projet à l\'assistant '
        "koji (avec des photos si besoin) : il prépare une fourchette de "
        "prix indicative et publie votre demande aux entreprises de votre "
        "secteur. C'est gratuit et illimité.",
  ),
  (
    'publier',
    'Comment une entreprise me contacte',
    "Dès qu'une entreprise s'intéresse à votre demande, elle vous écrit "
        "dans Messages. Vous retrouvez aussi la demande elle-même depuis "
        "Mes demandes, avec son statut.",
  ),
  (
    'messages',
    'Répondre à une entreprise',
    "Chaque conversation est rattachée à une demande précise. Vous pouvez "
        "échanger librement, accepter ou refuser un rendez-vous proposé par "
        "l'entreprise, et choisir de débloquer vos photos du chantier pour "
        "elle.",
  ),
  (
    'messages',
    'Mes échanges restent sur koji',
    "Tant qu'aucun rendez-vous n'est confirmé, vos coordonnées complètes "
        "ne sont pas partagées — la discussion se fait depuis Koji.",
  ),
  (
    'chantiers',
    'Suivre un chantier signé',
    "Une fois un devis signé avec une entreprise, le chantier apparaît "
        "dans Mes chantiers avec son avancement, les prochaines étapes et "
        "les documents liés.",
  ),
  (
    'chantiers',
    'Télécharger un devis signé',
    'Depuis Devis reçus, chaque devis signé peut être téléchargé en PDF à '
        'tout moment.',
  ),
  (
    'compte',
    'Modifier mes informations',
    'Depuis Profil, mettez à jour vos coordonnées et votre mot de passe '
        "(l'ancien mot de passe vous sera redemandé).",
  ),
  (
    'compte',
    'Exporter ou supprimer mes données',
    'Depuis Paramètres, vous pouvez exporter une copie de vos données ou '
        'demander la suppression de votre compte à tout moment.',
  ),
];

const _faq = [
  (
    'Publier un chantier coûte-t-il quelque chose ?',
    'Non, publier un chantier via Radar des Chantiers est entièrement '
        'gratuit et sans limite, quel que soit le nombre de demandes.',
  ),
  (
    "Comment savoir si une entreprise s'intéresse à ma demande ?",
    'Vous recevez une notification et un message dans Messages dès '
        "qu'une entreprise vous contacte au sujet de votre demande.",
  ),
  (
    'Mon numéro de téléphone est-il visible par tout le monde ?',
    "Non. Il n'est communiqué qu'à l'entreprise que vous retenez, jamais "
        'affiché publiquement.',
  ),
  (
    'Où retrouver mes devis déjà signés ?',
    'Dans Devis reçus : chaque devis signé peut y être téléchargé en PDF '
        'à tout moment.',
  ),
  (
    'Comment supprimer mon compte ?',
    'Depuis Paramètres > Supprimer mon compte, envoyez votre demande : '
        'elle est traitée par notre équipe.',
  ),
];

/// "Aide" côté particulier (app/client/aide/page.jsx, lu en entier) — pas le
/// `KojiHelpScreen` partagé avec l'app entreprise (qui ne décrit pas du tout
/// le même parcours) : un écran dédié pour ne jamais risquer de modifier
/// l'Aide côté entreprise.
class ClientAideScreen extends ConsumerStatefulWidget {
  const ClientAideScreen({super.key});

  @override
  ConsumerState<ClientAideScreen> createState() => _ClientAideScreenState();
}

class _ClientAideScreenState extends ConsumerState<ClientAideScreen> {
  String _activeTheme = '';

  Future<void> _reportArtisan() async {
    final controller = TextEditingController();
    final send = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Signaler un problème avec un artisan'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Décrivez la situation (quelle entreprise, quel '
                'chantier, ce qui s\'est passé)…',
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Envoyer')),
        ],
      ),
    );
    if (send != true || controller.text.trim().isEmpty || !mounted) return;
    try {
      await ref.read(marketplaceRepositoryProvider).sendSupportReport(
          '[Signalement artisan] ${controller.text.trim()}');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Signalement envoyé, notre équipe revient vers vous.'),
      ));
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : 'Impossible d\'envoyer le signalement.'),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final visibleArticles = _activeTheme.isEmpty
        ? _articles
        : _articles.where((a) => a.$1 == _activeTheme).toList();

    return KojiPage(
      title: 'Aide',
      subtitle: 'Guides, questions fréquentes et support pour vos travaux.',
      appBarOnPhone: true,
      actions: [
        KojiButton(
          label: 'Contacter le support',
          onPressed: () =>
              launchUrl(Uri.parse('mailto:contact@kojibuild.com')),
        ),
      ],
      main: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const KojiSectionTitle('Parcourir par thème'),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _ThemeChip(
                    icon: '📋',
                    label: 'Tous les articles',
                    count: _articles.length,
                    selected: _activeTheme.isEmpty,
                    onTap: () => setState(() => _activeTheme = ''),
                  ),
                  for (final (key, icon, label) in _themes)
                    _ThemeChip(
                      icon: icon,
                      label: label,
                      count: _articles.where((a) => a.$1 == key).length,
                      selected: _activeTheme == key,
                      onTap: () => setState(() => _activeTheme = key),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              for (final (i, article) in visibleArticles.indexed) ...[
                if (i > 0) const Divider(height: 20),
                _ExpandableItem(title: article.$2, body: article.$3),
              ],
              const SizedBox(height: 24),
              const KojiSectionTitle('Questions fréquentes'),
              const SizedBox(height: 10),
              for (final (i, item) in _faq.indexed) ...[
                if (i > 0) const Divider(height: 20),
                _ExpandableItem(title: item.$1, body: item.$2),
              ],
            ],
          ),
        ),
      ],
      side: [
        KojiPromoCard(
          eyebrow: 'Besoin d\'aide pour choisir ?',
          text: "L'assistant koji vous aide à préciser votre projet et vos "
              'critères.',
          actionLabel: "Discuter avec l'assistant",
          onAction: () => context.push('/client/marketplace/new'),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Contacter le support'),
              const SizedBox(height: 6),
              Text('Réponse sous 24 à 48h par email.',
                  style: TextStyle(fontSize: 12.5, color: p.muted)),
              const SizedBox(height: 10),
              KojiButton(
                label: 'Écrire au support',
                variant: KojiButtonVariant.secondary,
                onPressed: () =>
                    launchUrl(Uri.parse('mailto:contact@kojibuild.com')),
              ),
            ],
          ),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Un problème avec un artisan ?'),
              const SizedBox(height: 6),
              Text(
                'Signalez un retard, un désaccord sur un devis ou un '
                'comportement inapproprié.',
                style: TextStyle(fontSize: 12.5, color: p.muted),
              ),
              const SizedBox(height: 10),
              KojiButton(
                label: 'Faire un signalement',
                variant: KojiButtonVariant.secondary,
                onPressed: _reportArtisan,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ThemeChip extends StatelessWidget {
  const _ThemeChip({
    required this.icon,
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String icon;
  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          border: Border.all(color: selected ? p.primary : p.line),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(icon, style: const TextStyle(fontSize: 15)),
            const SizedBox(width: 6),
            Text(
              '$label · $count',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: p.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExpandableItem extends StatelessWidget {
  const _ExpandableItem({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: const EdgeInsets.only(bottom: 10),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: p.heading,
          ),
        ),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              body,
              style: TextStyle(fontSize: 13.5, color: p.muted, height: 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
