import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/core/theme_provider.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

/// "Paramètres" (components/SettingsPanel.jsx, variant="particulier", lu en
/// entier). Pas de ligne Langue (pas d'i18n dans l'app) ni Abonnement
/// (masquée côté particulier sur le site aussi — Radar des Chantiers est
/// gratuit). Le thème et la déconnexion existaient déjà et fonctionnent
/// réellement ; conservés tels quels.
class ClientParametresScreen extends ConsumerStatefulWidget {
  const ClientParametresScreen({super.key});

  /// Account deletion page of the koji signature site (Google Play policy).
  static const _deleteAccountUrl =
      'https://koji-signature.vercel.app/legal/delete-account';

  @override
  ConsumerState<ClientParametresScreen> createState() =>
      _ClientParametresScreenState();
}

class _ClientParametresScreenState
    extends ConsumerState<ClientParametresScreen> {
  bool _exporting = false;

  Future<void> _exportData() async {
    setState(() => _exporting = true);
    try {
      final bytes =
          await ref.read(marketplaceRepositoryProvider).getAccountExportJson();
      final dir = await getTemporaryDirectory();
      final file = File(
          '${dir.path}/koji-donnees-${DateTime.now().toIso8601String().substring(0, 10)}.json');
      await file.writeAsBytes(bytes);
      await Share.shareXFiles([XFile(file.path)]);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : "Impossible d'exporter vos données."),
      ));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  Future<void> _reportProblem() async {
    final controller = TextEditingController();
    final send = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Signaler un problème'),
        content: TextField(
          controller: controller,
          maxLines: 4,
          autofocus: true,
          decoration:
              const InputDecoration(hintText: 'Décrivez le problème…'),
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
      await ref
          .read(marketplaceRepositoryProvider)
          .sendSupportReport(controller.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Signalement envoyé.')));
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : "Impossible d'envoyer le signalement."),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final mode = ref.watch(themeProvider);
    final account = ref.watch(currentAccountProvider).valueOrNull;

    Widget row({
      required String title,
      required String subtitle,
      required Widget trailing,
    }) =>
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            runSpacing: 10,
            spacing: 16,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title,
                        style: TextStyle(
                            fontSize: 14.5,
                            fontWeight: FontWeight.w700,
                            color: p.ink)),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: TextStyle(fontSize: 13, color: p.muted)),
                  ],
                ),
              ),
              trailing,
            ],
          ),
        );

    return KojiPage(
      title: 'Paramètres',
      subtitle: 'Affichage et sécurité de votre compte.',
      appBarOnPhone: true,
      main: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Affichage'),
              row(
                title: 'Thème',
                subtitle: "Choisissez l'apparence de l'application.",
                trailing: SizedBox(
                  width: 320,
                  child: KojiSegmented<ThemeMode>(
                    compact: true,
                    options: const {
                      ThemeMode.light: 'Clair',
                      ThemeMode.dark: 'Sombre',
                      ThemeMode.system: 'Automatique',
                    },
                    value: mode,
                    onChanged: (m) =>
                        ref.read(themeProvider.notifier).setTheme(m),
                  ),
                ),
              ),
            ],
          ),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Sécurité'),
              row(
                title: 'Mot de passe',
                subtitle: 'Modifiable depuis votre profil.',
                trailing: KojiButton(
                  label: 'Mon profil',
                  variant: KojiButtonVariant.secondary,
                  height: 38,
                  onPressed: () => context.push('/client/profil'),
                ),
              ),
              Divider(color: p.lineSoft),
              row(
                title: 'Signaler un problème',
                subtitle: 'Un bug ou un comportement inattendu dans l\'app.',
                trailing: KojiButton(
                  label: 'Signaler',
                  variant: KojiButtonVariant.secondary,
                  height: 38,
                  onPressed: _reportProblem,
                ),
              ),
              Divider(color: p.lineSoft),
              row(
                title: 'Aide',
                subtitle: 'Guides et questions fréquentes.',
                trailing: KojiButton(
                  label: 'Ouvrir',
                  variant: KojiButtonVariant.secondary,
                  height: 38,
                  onPressed: () => context.push('/client/aide'),
                ),
              ),
              Divider(color: p.lineSoft),
              row(
                title: 'Déconnexion',
                subtitle:
                    account?.email ?? 'Fermer la session sur cet appareil.',
                trailing: KojiButton(
                  label: 'Se déconnecter',
                  variant: KojiButtonVariant.secondary,
                  height: 38,
                  leadingIcon: KojiIcons.deconnexion,
                  onPressed: () => openClientNav(context, ref, 'deconnexion'),
                ),
              ),
            ],
          ),
        ),
      ],
      side: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Mes données'),
              const SizedBox(height: 6),
              Text(
                'Exportez une copie de vos données (RGPD) ou demandez la '
                'suppression de votre compte à tout moment.',
                style: TextStyle(fontSize: 13.5, height: 1.45, color: p.muted),
              ),
              const SizedBox(height: 14),
              KojiButton(
                label: 'Exporter mes données',
                variant: KojiButtonVariant.secondary,
                leadingIcon: KojiIcons.download,
                loading: _exporting,
                onPressed: _exportData,
              ),
              const SizedBox(height: 10),
              KojiButton(
                label: 'Supprimer mon compte',
                variant: KojiButtonVariant.secondary,
                leadingIcon: KojiIcons.corbeille,
                onPressed: () => launchUrl(
                  Uri.parse(ClientParametresScreen._deleteAccountUrl),
                  mode: LaunchMode.externalApplication,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
