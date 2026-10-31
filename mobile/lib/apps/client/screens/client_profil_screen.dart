import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/apps/client/client_widgets.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

enum _Kind { particulier, professionnel }

/// "Mon profil" (app/client/profil/page.jsx, lu en entier). Remplace
/// l'ancien écran, qui éditait la table Supabase `users` — les vraies
/// coordonnées d'un compte particulier (prénom/nom/téléphone/adresse, type
/// de compte, mot de passe) vivent dans le système cookie de koji-web
/// (lib/particulier-users.js), pas dans Supabase. Voir le rapport de
/// mission pour le détail de cet écart.
class ClientProfilScreen extends ConsumerStatefulWidget {
  const ClientProfilScreen({super.key});

  @override
  ConsumerState<ClientProfilScreen> createState() => _ClientProfilScreenState();
}

class _ClientProfilScreenState extends ConsumerState<ClientProfilScreen> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _phone = TextEditingController();
  final _address = TextEditingController();
  final _city = TextEditingController();
  final _postalCode = TextEditingController();
  final _raisonSociale = TextEditingController();
  final _siret = TextEditingController();
  final _currentPassword = TextEditingController();
  final _newPassword = TextEditingController();

  bool _filled = false;
  _Kind _kind = _Kind.particulier;
  bool _saving = false;
  String? _error;
  String? _email;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _phone.dispose();
    _address.dispose();
    _city.dispose();
    _postalCode.dispose();
    _raisonSociale.dispose();
    _siret.dispose();
    _currentPassword.dispose();
    _newPassword.dispose();
    super.dispose();
  }

  void _fill(Map<String, dynamic> user) {
    if (_filled) return;
    _filled = true;
    _email = user['email'] as String?;
    final personal = (user['personal'] as Map?)?.cast<String, dynamic>() ?? const {};
    final pro = (user['pro'] as Map?)?.cast<String, dynamic>() ?? const {};
    _firstName.text = (personal['firstName'] as String?) ?? '';
    _lastName.text = (personal['lastName'] as String?) ?? '';
    _phone.text = (personal['phone'] as String?) ?? '';
    _address.text = (personal['address'] as String?) ?? '';
    _city.text = (personal['city'] as String?) ?? '';
    _postalCode.text = (personal['postalCode'] as String?) ?? '';
    _raisonSociale.text = (pro['raisonSociale'] as String?) ?? '';
    _siret.text = (pro['siret'] as String?) ?? '';
    _kind = user['profileKind'] == 'professionnel'
        ? _Kind.professionnel
        : _Kind.particulier;
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(marketplaceRepositoryProvider).updateClientProfile(
        personal: {
          'firstName': _firstName.text.trim(),
          'lastName': _lastName.text.trim(),
          'phone': _phone.text.trim(),
          'address': _address.text.trim(),
          'city': _city.text.trim(),
          'postalCode': _postalCode.text.trim(),
        },
        profileKind: _kind == _Kind.professionnel ? 'professionnel' : 'particulier',
        pro: _kind == _Kind.professionnel
            ? {
                'raisonSociale': _raisonSociale.text.trim(),
                'siret': _siret.text.trim(),
              }
            : null,
        password: _newPassword.text.trim().isEmpty ? null : _newPassword.text.trim(),
        currentPassword:
            _currentPassword.text.trim().isEmpty ? null : _currentPassword.text.trim(),
      );
      _newPassword.clear();
      _currentPassword.clear();
      ref.invalidate(clientPortalProfileProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profil enregistré')));
    } catch (err) {
      setState(() => _error =
          err is KojiWebApiException ? err.message : "Impossible d'enregistrer.");
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _confirmDelete() async {
    final reasonController = TextEditingController();
    final sent = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer mon compte'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Votre profil, vos offres et vos échanges seront supprimés '
              'définitivement. Cette action est irréversible.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                  hintText: 'Décrivez brièvement la raison (optionnel)'),
            ),
          ],
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
    if (sent != true || !mounted) return;
    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .requestAccountDeletion(reasonController.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Demande envoyée.')),
      );
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : "Impossible d'envoyer la demande. Réessayez."),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final profileAsync = ref.watch(clientPortalProfileProvider);
    final user = profileAsync.valueOrNull;
    if (user != null) _fill(user);

    final steps = [
      ('Compte créé', true),
      ('Prénom et nom', _firstName.text.trim().isNotEmpty && _lastName.text.trim().isNotEmpty),
      ('Téléphone', _phone.text.trim().isNotEmpty),
      ('Adresse', _address.text.trim().isNotEmpty && _city.text.trim().isNotEmpty),
    ];
    final completion = steps.where((s) => s.$2).length / steps.length;

    if (profileAsync.isLoading && user == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (profileAsync.hasError) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: KojiEmptyState(
            icon: KojiIcons.alert,
            title: 'Impossible de charger votre profil',
            subtitle: '${profileAsync.error}',
            action: KojiButton(
              label: 'Réessayer',
              variant: KojiButtonVariant.secondary,
              onPressed: () => ref.invalidate(clientPortalProfileProvider),
            ),
          ),
        ),
      );
    }

    return KojiPage(
      title: 'Mon profil',
      subtitle: _email,
      main: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const KojiSectionTitle('Vous êtes'),
              const SizedBox(height: 10),
              KojiSegmented<_Kind>(
                options: const {
                  _Kind.particulier: 'Particulier',
                  _Kind.professionnel: 'Professionnel',
                },
                value: _kind,
                onChanged: (k) => setState(() => _kind = k),
              ),
              const SizedBox(height: 20),
              const KojiSectionTitle('Mes informations'),
              const SizedBox(height: 14),
              KojiField(label: 'Prénom', controller: _firstName),
              const SizedBox(height: 12),
              KojiField(label: 'Nom', controller: _lastName),
              const SizedBox(height: 12),
              KojiField(
                label: 'Téléphone',
                controller: _phone,
                keyboardType: TextInputType.phone,
                helper: "Visible uniquement par l'artisan que vous retenez.",
              ),
              const SizedBox(height: 12),
              KojiField(label: 'Adresse', controller: _address),
              const SizedBox(height: 12),
              KojiField(label: 'Ville', controller: _city),
              const SizedBox(height: 12),
              KojiField(label: 'Code postal', controller: _postalCode),
              if (_kind == _Kind.professionnel) ...[
                const SizedBox(height: 20),
                const KojiSectionTitle('Ma structure'),
                const SizedBox(height: 14),
                KojiField(label: 'Raison sociale', controller: _raisonSociale),
                const SizedBox(height: 12),
                KojiField(label: 'SIRET', controller: _siret),
              ],
              const SizedBox(height: 20),
              const KojiSectionTitle('Sécurité'),
              const SizedBox(height: 14),
              KojiField(
                label: 'Mot de passe actuel',
                controller: _currentPassword,
                obscure: true,
                helper: 'Nécessaire uniquement pour changer de mot de passe.',
              ),
              const SizedBox(height: 12),
              KojiField(
                label: 'Nouveau mot de passe',
                controller: _newPassword,
                obscure: true,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 20),
              Align(
                alignment: Alignment.centerRight,
                child: KojiButton(
                  label: 'Enregistrer les modifications',
                  loading: _saving,
                  onPressed: _save,
                ),
              ),
            ],
          ),
        ),
      ],
      side: [
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
              for (final (label, done) in steps) KojiCheckLine(label, done: done),
            ],
          ),
        ),
        KojiCard(
          color: p.toneBg(KojiTone.coral),
          borderColor: p.toneFg(KojiTone.coral).withValues(alpha: 0.3),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Supprimer mon compte',
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: p.toneFg(KojiTone.coral))),
              const SizedBox(height: 6),
              Text(
                'Votre profil, vos offres et vos échanges seront supprimés '
                'définitivement. Cette action est irréversible.',
                style: TextStyle(fontSize: 12.5, color: p.ink, height: 1.4),
              ),
              const SizedBox(height: 10),
              KojiButton(
                label: 'Supprimer mon compte',
                variant: KojiButtonVariant.secondary,
                onPressed: _confirmDelete,
              ),
            ],
          ),
        ),
        KojiButton(
          label: 'Se déconnecter',
          variant: KojiButtonVariant.secondary,
          leadingIcon: KojiIcons.deconnexion,
          expand: true,
          onPressed: () => openClientNav(context, ref, 'deconnexion'),
        ),
      ],
    );
  }
}
