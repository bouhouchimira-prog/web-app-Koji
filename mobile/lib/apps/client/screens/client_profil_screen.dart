import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

String _s(dynamic v) => v is String ? v.trim() : '';

/// « 06 •• •• 41 18 » : les deux premiers et les quatre derniers chiffres.
String masquerTelephone(String tel) {
  var chiffres = tel.replaceAll(RegExp(r'\D'), '');
  // +33 6… s'écrit 06…
  if (chiffres.length == 11 && chiffres.startsWith('33')) {
    chiffres = '0${chiffres.substring(2)}';
  }
  if (chiffres.length < 8) return chiffres.isEmpty ? '' : '•• ••';
  final fin = chiffres.substring(chiffres.length - 4);
  return '${chiffres.substring(0, 2)} •• •• ${fin.substring(0, 2)} ${fin.substring(2)}';
}

/// « s••••@••••.fr » : la première lettre et l'extension.
String masquerEmail(String email) {
  final at = email.indexOf('@');
  if (at < 1) return '';
  final point = email.lastIndexOf('.');
  final ext = point > at ? email.substring(point) : '';
  return '${email[0]}••••@••••$ext';
}

enum _Vue { liste, coordonnees, logement }

/// « Profil » (maquette CLI-03) : Coordonnées masquées, Mon logement, Mes
/// données, puis Aide. Les champs viennent du compte du site
/// (/api/client/profile, lib/particulier-users.js) : prénom, nom, téléphone,
/// adresse, code postal, ville, mot de passe. Langue et réglages des
/// notifications n'existent pas encore : leurs lignes sont absentes.
class ClientProfilScreen extends ConsumerStatefulWidget {
  const ClientProfilScreen({super.key});

  @override
  ConsumerState<ClientProfilScreen> createState() => _ClientProfilScreenState();
}

class _ClientProfilScreenState extends ConsumerState<ClientProfilScreen> {
  final _prenom = TextEditingController();
  final _nom = TextEditingController();
  final _telephone = TextEditingController();
  final _email = TextEditingController();
  final _adresse = TextEditingController();
  final _codePostal = TextEditingController();
  final _ville = TextEditingController();
  final _motDePasse = TextEditingController();
  final _nouveauMotDePasse = TextEditingController();

  _Vue _vue = _Vue.liste;
  bool _rempli = false;
  bool _enregistrement = false;
  String? _erreur;

  @override
  void dispose() {
    for (final c in [
      _prenom,
      _nom,
      _telephone,
      _email,
      _adresse,
      _codePostal,
      _ville,
      _motDePasse,
      _nouveauMotDePasse,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _remplir(Map<String, dynamic> user) {
    if (_rempli) return;
    _rempli = true;
    final perso = user['personal'] is Map
        ? (user['personal'] as Map).cast<String, dynamic>()
        : const <String, dynamic>{};
    _email.text = _s(user['email']);
    _prenom.text = _s(perso['firstName']);
    _nom.text = _s(perso['lastName']);
    _telephone.text = _s(perso['phone']);
    _adresse.text = _s(perso['address']);
    _codePostal.text = _s(perso['postalCode']);
    _ville.text = _s(perso['city']);
  }

  void _ouvrirVue(_Vue vue) => setState(() {
        _vue = vue;
        _erreur = null;
      });

  /// Enregistre les coordonnées et l'adresse ; le type de compte et la
  /// structure déjà saisis ne sont pas envoyés, donc restent tels quels.
  Future<void> _enregistrer() async {
    final nouveau = _nouveauMotDePasse.text.trim();
    final actuel = _motDePasse.text.trim();
    setState(() {
      _enregistrement = true;
      _erreur = null;
    });
    try {
      await ref.read(marketplaceRepositoryProvider).updateClientProfile(
            personal: {
              'firstName': _prenom.text.trim(),
              'lastName': _nom.text.trim(),
              'phone': _telephone.text.trim(),
              'address': _adresse.text.trim(),
              'city': _ville.text.trim(),
              'postalCode': _codePostal.text.trim(),
            },
            password: nouveau.isEmpty ? null : nouveau,
            currentPassword: actuel.isEmpty ? null : actuel,
          );
      _motDePasse.clear();
      _nouveauMotDePasse.clear();
      ref.invalidate(clientPortalProfileProvider);
      if (!mounted) return;
      setState(() => _vue = _Vue.liste);
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profil enregistré.')));
    } catch (err) {
      if (mounted) {
        setState(() => _erreur = err is KojiWebApiException
            ? err.message
            : "Impossible d'enregistrer.");
      }
    } finally {
      if (mounted) setState(() => _enregistrement = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final connecte = ref.watch(kojiWebApiClientProvider).isLoggedIn;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final AsyncValue<Map<String, dynamic>> async = connecte
        ? ref.watch(clientPortalProfileProvider)
        : const AsyncData(<String, dynamic>{});
    final user = connecte ? async.valueOrNull : null;
    if (user != null) _remplir(user);

    final nomComplet = [_prenom.text.trim(), _nom.text.trim()]
        .where((p) => p.isNotEmpty)
        .join(' ');
    final sousTitre = nomComplet.isNotEmpty
        ? nomComplet
        : (user != null ? _s(user['name']) : (account?.displayName ?? ''));

    return PopScope(
      canPop: _vue == _Vue.liste,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _ouvrirVue(_Vue.liste);
      },
      child: switch (_vue) {
        _Vue.liste => _liste(connecte, async, user, sousTitre),
        _Vue.coordonnees => _coordonnees(sousTitre),
        _Vue.logement => _logement(sousTitre),
      },
    );
  }

  Widget _liste(bool connecte, AsyncValue<Map<String, dynamic>> async,
      Map<String, dynamic>? user, String sousTitre) {
    final coordonnees = [
      masquerTelephone(_telephone.text),
      masquerEmail(_email.text),
    ].where((p) => p.isNotEmpty).join(' · ');
    final logement = [
      _adresse.text.trim(),
      [_codePostal.text.trim(), _ville.text.trim()]
          .where((p) => p.isNotEmpty)
          .join(' '),
    ].where((p) => p.isNotEmpty).join(', ');

    final blocs = <Widget>[
      if (!connecte) ...[
        const ClInfo('Connectez-vous à votre espace Koji pour voir et modifier '
            'vos coordonnées.'),
        ClBouton('Se connecter',
            onPressed: () => context.push('/client/marketplace/login')),
      ] else if (user == null && async.isLoading)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 14),
          child: Center(
            child: SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: ClCharte.marine),
            ),
          ),
        )
      else if (user == null) ...[
        Text('Impossible de charger votre profil.',
            style: ClCharte.texte(14, couleur: ClCharte.gris)),
        ClBouton('Réessayer',
            secondaire: true,
            onPressed: () => ref.invalidate(clientPortalProfileProvider)),
      ] else ...[
        ClRangee(
          titre: 'Coordonnées',
          detail: coordonnees.isEmpty ? 'à compléter' : coordonnees,
          onTap: () => _ouvrirVue(_Vue.coordonnees),
        ),
        ClRangee(
          titre: 'Mon logement',
          detail: logement.isEmpty ? 'adresse à compléter' : logement,
          onTap: () => _ouvrirVue(_Vue.logement),
        ),
      ],
      ClRangee(
        titre: 'Mes données',
        detail: 'télécharger, supprimer mon compte',
        onTap: () => context.push('/client/parametres'),
      ),
      ClRangee(
        titre: 'Aide',
        detail: 'questions fréquentes, contacter Koji',
        onTap: () => context.push('/client/aide'),
      ),
      ClBouton('Se déconnecter',
          secondaire: true,
          onPressed: () => openClientNav(context, ref, 'deconnexion')),
    ];

    return ClEcran(
      titre: 'Profil',
      sousTitre: sousTitre,
      onRetour: () => context.go('/client-home'),
      corps: ClCorps(
        onRefresh: connecte
            ? () async => ref.invalidate(clientPortalProfileProvider)
            : null,
        children: blocs,
      ),
    );
  }

  Widget _coordonnees(String sousTitre) {
    return ClEcran(
      titre: 'Coordonnées',
      sousTitre: sousTitre,
      onRetour: () => _ouvrirVue(_Vue.liste),
      corps: ClCorps(children: [
        ClChamp(
            label: 'Prénom',
            controller: _prenom,
            textInputAction: TextInputAction.next),
        ClChamp(
            label: 'Nom',
            controller: _nom,
            textInputAction: TextInputAction.next),
        ClChamp(
            label: 'Téléphone',
            controller: _telephone,
            keyboardType: TextInputType.phone),
        ClChamp(label: 'E-mail', controller: _email, lectureSeule: true),
        const ClSection('Mot de passe'),
        ClChamp(
            label: 'Mot de passe actuel', controller: _motDePasse, masque: true),
        ClChamp(
            label: 'Nouveau mot de passe',
            controller: _nouveauMotDePasse,
            masque: true),
        Text("Laissez-les vides pour garder votre mot de passe.",
            style: ClCharte.texte(12, couleur: ClCharte.gris)),
        if (_erreur != null)
          Text(_erreur!, style: ClCharte.texte(13, graisse: FontWeight.w600)),
        ClBouton('Enregistrer',
            charge: _enregistrement, onPressed: _enregistrer),
        Text(
            "Votre téléphone n'est transmis qu'à l'entreprise avec laquelle un "
            'rendez-vous est confirmé.',
            style: ClCharte.texte(12, couleur: ClCharte.gris)),
      ]),
    );
  }

  Widget _logement(String sousTitre) {
    return ClEcran(
      titre: 'Mon logement',
      sousTitre: sousTitre,
      onRetour: () => _ouvrirVue(_Vue.liste),
      corps: ClCorps(children: [
        ClChamp(
            label: 'Adresse',
            controller: _adresse,
            textInputAction: TextInputAction.next),
        ClChamp(
            label: 'Code postal',
            controller: _codePostal,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next),
        ClChamp(label: 'Ville', controller: _ville),
        if (_erreur != null)
          Text(_erreur!, style: ClCharte.texte(13, graisse: FontWeight.w600)),
        ClBouton('Enregistrer',
            charge: _enregistrement, onPressed: _enregistrer),
      ]),
    );
  }
}
