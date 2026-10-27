import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/auth_repository.dart';
import 'package:koji/features/auth/repository/user_repository.dart';

/// Client profile (design: "Client — Profil (particulier)").
class ClientProfilScreen extends ConsumerStatefulWidget {
  const ClientProfilScreen({super.key});

  @override
  ConsumerState<ClientProfilScreen> createState() => _ClientProfilScreenState();
}

class _ClientProfilScreenState extends ConsumerState<ClientProfilScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  bool _filled = false;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _address.dispose();
    super.dispose();
  }

  void _fill(KojiAccount a) {
    if (_filled) return;
    _filled = true;
    _name.text = a.fullName;
    _phone.text = a.phone;
    _address.text = a.address;
  }

  Future<void> _save(KojiAccount account) async {
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(userRepositoryProvider).updateClientProfile(
            uid: account.id,
            fullName: _name.text.trim(),
            phone: _phone.text.trim(),
            address: _address.text.trim(),
          );
      ref.invalidate(currentAccountProvider);
      messenger
          .showSnackBar(const SnackBar(content: Text('Profil enregistré')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(authErrorMessage(e))));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _resetPassword(String email) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(authRepositoryProvider).resetPassword(email: email);
      messenger.showSnackBar(SnackBar(
        content: Text(
            'Un lien pour changer votre mot de passe a été envoyé à $email.'),
      ));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(authErrorMessage(e))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    if (account != null) _fill(account);

    final steps = [
      ('Compte créé', true),
      ('Ajouter votre nom', _name.text.trim().isNotEmpty),
      ('Ajouter votre téléphone', _phone.text.trim().isNotEmpty),
      ('Renseigner votre adresse', _address.text.trim().isNotEmpty),
    ];
    final completion = steps.where((s) => s.$2).length / steps.length;

    return KojiPage(
      title: 'Mon profil',
      subtitle: account?.email,
      main: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Informations personnelles'),
              const SizedBox(height: 18),
              KojiField(
                label: 'Nom complet',
                controller: _name,
                hint: 'Prénom et nom',
                icon: KojiIcons.user,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),
              KojiField(
                label: 'Téléphone',
                controller: _phone,
                hint: '06 00 00 00 00',
                keyboardType: TextInputType.phone,
                helper: 'Visible par les artisans qui travaillent avec vous.',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),
              KojiField(
                label: 'Adresse',
                controller: _address,
                hint: 'Numéro, rue, code postal, ville',
                icon: KojiIcons.pin,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 22),
              Align(
                alignment: Alignment.centerRight,
                child: KojiButton(
                  label: 'Enregistrer les modifications',
                  loading: _saving,
                  onPressed: account == null ? null : () => _save(account),
                ),
              ),
            ],
          ),
        ),
      ],
      side: [
        // On phones Paramètres / Aide are not bottom-bar tabs: link them here.
        if (MediaQuery.sizeOf(context).width < KojiBreakpoints.wide)
          KojiCard(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
              children: [
                for (final (icon, label, route) in const [
                  (KojiIcons.parametres, 'Paramètres', '/client/parametres'),
                  (KojiIcons.aide, 'Aide', '/client/aide'),
                ])
                  ListTile(
                    leading: KojiIcon(icon, size: 19, color: p.heading),
                    title: Text(label,
                        style: TextStyle(
                            fontWeight: FontWeight.w700, color: p.ink)),
                    trailing: KojiIcon(KojiIcons.chevronRight,
                        size: 16, color: p.faint),
                    onTap: () => context.push(route),
                  ),
              ],
            ),
          ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Expanded(child: KojiSectionTitle('Profil complété')),
                  Text(
                    '${(completion * 100).round()} %',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: p.heading,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              KojiProgressBar(value: completion),
              const SizedBox(height: 12),
              for (final (label, done) in steps)
                KojiCheckLine(label, done: done),
            ],
          ),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Sécurité'),
              const SizedBox(height: 6),
              Text(
                'Recevez un lien par e-mail pour choisir un nouveau mot de passe.',
                style: TextStyle(fontSize: 13.5, color: p.muted, height: 1.45),
              ),
              const SizedBox(height: 14),
              KojiButton(
                label: 'Changer mon mot de passe',
                variant: KojiButtonVariant.secondary,
                leadingIcon: KojiIcons.lock,
                onPressed: account == null || account.email.isEmpty
                    ? null
                    : () => _resetPassword(account.email),
              ),
              const SizedBox(height: 10),
              KojiButton(
                label: 'Se déconnecter',
                variant: KojiButtonVariant.secondary,
                leadingIcon: KojiIcons.deconnexion,
                onPressed: () => openClientNav(context, ref, 'deconnexion'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
