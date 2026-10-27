import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/core/theme_provider.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';

/// Client settings (design: "Client — Paramètres"). Only settings that work
/// today: display theme, password, sign-out and account deletion.
class ClientParametresScreen extends ConsumerWidget {
  const ClientParametresScreen({super.key});

  /// Account deletion page of the koji signature site (Google Play policy).
  static const _deleteAccountUrl =
      'https://koji-signature.vercel.app/legal/delete-account';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
                subtitle:
                    'Recevez un lien par e-mail pour en choisir un nouveau.',
                trailing: KojiButton(
                  label: 'Modifier',
                  variant: KojiButtonVariant.secondary,
                  height: 38,
                  onPressed: account == null || account.email.isEmpty
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(context);
                          try {
                            await ref
                                .read(authRepositoryProvider)
                                .resetPassword(email: account.email);
                            messenger.showSnackBar(SnackBar(
                              content: Text('Lien envoyé à ${account.email}.'),
                            ));
                          } catch (e) {
                            messenger.showSnackBar(
                                SnackBar(content: Text(authErrorMessage(e))));
                          }
                        },
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
                'Votre profil et vos échanges peuvent être supprimés '
                'définitivement. Cette action est irréversible.',
                style: TextStyle(fontSize: 13.5, height: 1.45, color: p.muted),
              ),
              const SizedBox(height: 14),
              KojiButton(
                label: 'Supprimer mon compte',
                variant: KojiButtonVariant.secondary,
                leadingIcon: KojiIcons.corbeille,
                onPressed: () => launchUrl(
                  Uri.parse(_deleteAccountUrl),
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
