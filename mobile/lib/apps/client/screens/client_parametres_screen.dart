import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/apps/client/client_nav.dart';
import 'package:koji/core/theme_provider.dart';
import 'package:koji/design/koji_client_charte.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

/// Pages légales du site (conditions particuliers, confidentialité,
/// cookies) : la première, avec le sommaire des autres.
const pagesLegalesUrl = 'https://getkoji.io/legal/conditions-particuliers';

/// Page de suppression du site, quand aucune session n'est ouverte dans
/// l'app (accès par code de chantier).
const _suppressionWebUrl = 'https://signature.getkoji.io/legal/delete-account';

bool _sessionAppOuverte() {
  try {
    return Supabase.instance.client.auth.currentSession != null;
  } catch (_) {
    // Supabase non initialisé (tests) : pas de session d'app.
    return false;
  }
}

/// Envoie la demande de suppression (/api/account/deletion-request) avec la
/// session ouverte : compte de l'app d'abord, sinon compte du site. Renvoie
/// faux quand aucune session n'est ouverte.
final clientDemandeSuppressionProvider =
    Provider<Future<bool> Function()>((ref) => () async {
          if (_sessionAppOuverte()) {
            await ref.read(kojiProApiProvider).post(
                '/api/account/deletion-request',
                {'accountType': 'client', 'reason': ''});
            return true;
          }
          if (ref.read(kojiWebApiClientProvider).isLoggedIn) {
            await ref
                .read(marketplaceRepositoryProvider)
                .requestAccountDeletion('');
            return true;
          }
          return false;
        });

/// « Paramètres » (maquette CLI-06) avec ce qui existe : affichage (thème),
/// Mes données (télécharger : /api/account/export ; supprimer :
/// /api/account/deletion-request), déconnexion, pages légales. Pas de
/// réglage des notifications ni de langue : ils n'existent pas encore.
/// « Supprimer mon compte » est le second écran de la maquette.
class ClientParametresScreen extends ConsumerStatefulWidget {
  const ClientParametresScreen({super.key});

  @override
  ConsumerState<ClientParametresScreen> createState() =>
      _ClientParametresScreenState();
}

class _ClientParametresScreenState
    extends ConsumerState<ClientParametresScreen> {
  bool _suppression = false;
  bool _compris = false;
  bool _envoi = false;
  bool _demandeEnvoyee = false;
  bool _export = false;

  void _retour() {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/client/profil');
    }
  }

  void _voirSuppression(bool ouvert) => setState(() {
        _suppression = ouvert;
        _compris = false;
      });

  void _message(String texte) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(texte)));
  }

  Future<void> _telecharger() async {
    if (_export) return;
    setState(() => _export = true);
    try {
      final octets =
          await ref.read(marketplaceRepositoryProvider).getAccountExportJson();
      final dossier = await getTemporaryDirectory();
      final jour = DateTime.now().toIso8601String().substring(0, 10);
      final fichier = File('${dossier.path}/koji-donnees-$jour.json');
      await fichier.writeAsBytes(octets);
      await Share.shareXFiles([XFile(fichier.path)]);
    } catch (err) {
      _message(err is KojiWebApiException
          ? err.message
          : "Impossible d'exporter vos données.");
    } finally {
      if (mounted) setState(() => _export = false);
    }
  }

  Future<void> _supprimer() async {
    setState(() => _envoi = true);
    try {
      final envoyee = await ref.read(clientDemandeSuppressionProvider)();
      if (!envoyee) {
        await launchUrl(Uri.parse(_suppressionWebUrl),
            mode: LaunchMode.externalApplication);
        return;
      }
      if (mounted) setState(() => _demandeEnvoyee = true);
    } catch (err) {
      _message(err is KojiWebApiException
          ? err.message
          : "Impossible d'envoyer la demande. Réessayez ou écrivez à "
              'contact@getkoji.io.');
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<void> _ouvrirPagesLegales() async {
    try {
      await launchUrl(Uri.parse(pagesLegalesUrl),
          mode: LaunchMode.externalApplication);
    } catch (_) {
      _message("Impossible d'ouvrir les pages légales.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final nom = account?.displayName ?? '';
    return PopScope(
      canPop: !_suppression,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _voirSuppression(false);
      },
      child: _suppression
          ? _ecranSuppression(nom)
          : _ecranParametres(nom, account?.email ?? ''),
    );
  }

  /// Pictogramme document sur l'écran de suppression seulement (maquette).
  Widget _telechargement({bool icone = false}) => ClRangee(
        icone: icone ? ClIcones.document : null,
        titre: 'Télécharger mes données',
        detail: 'profil, demandes, messages, en un fichier',
        fin: _export
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: ClCharte.marine),
              )
            : null,
        onTap: _telecharger,
      );

  Widget _ecranParametres(String nom, String email) {
    final mode = ref.watch(themeProvider);
    Widget theme(ThemeMode m, String titre, [String detail = '']) => ClRangee(
          titre: titre,
          detail: detail,
          fin: mode == m
              ? const KojiIcon(KojiIcons.check,
                  size: 18, color: ClCharte.marine, strokeWidth: 2.4)
              : const SizedBox(width: 18),
          onTap: () => ref.read(themeProvider.notifier).setTheme(m),
        );

    return ClEcran(
      titre: 'Paramètres',
      sousTitre: nom,
      onRetour: _retour,
      corps: ClCorps(children: [
        const ClSection('Affichage'),
        theme(ThemeMode.light, 'Clair'),
        theme(ThemeMode.dark, 'Sombre'),
        theme(ThemeMode.system, 'Automatique', 'comme le téléphone'),
        const ClSection('Mes données'),
        _telechargement(),
        ClRangee(
          titre: 'Supprimer mon compte',
          detail: "sous 30 jours ; les factures restent chez l'entreprise",
          onTap: () => _voirSuppression(true),
        ),
        const ClSection('Compte'),
        ClRangee(
          titre: 'Se déconnecter',
          detail: email,
          onTap: () => openClientNav(context, ref, 'deconnexion'),
        ),
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text('Conditions particuliers, confidentialité et cookies : ',
                style: ClCharte.texte(12, couleur: ClCharte.gris)),
            ClLien('pages légales', taille: 12, onTap: _ouvrirPagesLegales),
            Text('.', style: ClCharte.texte(12, couleur: ClCharte.gris)),
          ],
        ),
      ]),
    );
  }

  Widget _ecranSuppression(String nom) {
    final blocs = _demandeEnvoyee
        ? <Widget>[
            Text('Votre demande est envoyée.', style: ClCharte.titre(22)),
            Text(
                "L'équipe Koji supprime votre compte et vos données sous 30 "
                'jours et vous le confirme par e-mail.',
                style: ClCharte.texte(14, hauteur: 1.5)),
            ClBouton('Retour aux paramètres',
                secondaire: true, onPressed: () => _voirSuppression(false)),
          ]
        : <Widget>[
            Text(
                'Vos projets, messages et photos seront effacés sous 30 jours ; '
                "l'équipe Koji vous le confirme par e-mail.",
                style: ClCharte.texte(14, hauteur: 1.5)),
            const ClInfo('Les devis signés et les factures sont conservés par '
                'chaque entreprise pendant la durée légale. Vous pouvez '
                'télécharger vos données avant.'),
            _telechargement(icone: true),
            ClCase(
              cochee: _compris,
              onChanged: (v) => setState(() => _compris = v),
              label:
                  'Je comprends que mon compte et mes projets seront supprimés',
            ),
            ClBouton('Supprimer mon compte',
                contour: true,
                charge: _envoi,
                onPressed: _compris ? _supprimer : null),
            ClBouton('Garder mon compte',
                secondaire: true, onPressed: () => _voirSuppression(false)),
          ];
    return ClEcran(
      titre: 'Supprimer mon compte',
      sousTitre: nom,
      onRetour: () => _voirSuppression(false),
      corps: ClCorps(children: blocs),
    );
  }
}
