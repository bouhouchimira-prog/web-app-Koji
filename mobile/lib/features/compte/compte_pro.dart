import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_config.dart';
import 'package:koji/apps/entreprise/visite/pro_visite_screen.dart' show visiteStoreProvider;
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/account/account_deletion.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/depenses/depenses_logic.dart' show Json, jourCourt, num2;
import 'package:koji/features/factures/factures_widgets.dart' show FactureKv, errorText, showFacturesMessage;
import 'package:koji/features/factures/paiement_en_ligne_pro.dart' show PaiementEnLigneCarte;

// Paramètres de Koji Pro (maquettes PRO-15 à 15.6, téléphone) sur l'API du
// site (/api/compte) : une page qui regroupe Mon entreprise, Mon profil,
// Devis et factures, Langue et traduction, Notifications, Abonnement et
// jetons, Éléments supprimés, Mes données, Se déconnecter.
const parametresRoute = '/parametres';
const langueRoute = '/parametres/langue';
const notificationsRoute = '/parametres/notifications';
const devisFacturesRoute = '/parametres/devis';
const abonnementRoute = '/parametres/abonnement';

final compteRepositoryProvider = Provider<CompteRepository>((ref) => CompteRepository(ref.watch(kojiProApiProvider)));
final compteProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(compteRepositoryProvider).compte());
final facturesKojiProvider = FutureProvider.autoDispose<Json>((ref) => ref.watch(compteRepositoryProvider).factures());

class CompteRepository {
  CompteRepository(this._api);
  final KojiProApi _api;

  Future<Json> compte() => _api.get('/api/compte');
  Future<Json> modifier(Json corps) => _api.patch('/api/compte', corps);
  Future<Json> profilEntreprise(Json business) => _api.patch('/api/auth/profile', {'business': business});
  Future<Json> factures() => _api.get('/api/billing/factures');
}

Json _map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};
List<Json> _liste(Object? v) => (v as List? ?? const []).whereType<Map>().map((x) => Map<String, dynamic>.from(x)).toList();
String _s(Object? v) => v == null ? '' : '$v';
const _plans = {'start': 'Start', 'pro': 'Pro', 'business': 'Business', 'trial': 'Essai'};

Future<void> ouvrirSite(String chemin) => launchUrl(Uri.parse('${KojiWebApiConfig.baseUrl}$chemin'), mode: LaunchMode.externalApplication);

Widget _attente(String titre, AsyncValue<Json> a) {
  if (a.hasError && !a.hasValue) return KojiPage(title: titre, appBarOnPhone: true, main: [KojiEmptyState(title: '$titre indisponible', subtitle: errorText(a.error!), icon: KojiIcons.parametres)]);
  return KojiPage(title: titre, appBarOnPhone: true, main: const [Padding(padding: EdgeInsets.all(40), child: Center(child: CircularProgressIndicator()))]);
}

/// Déconnexion (PRO-15.6) : immédiate, sauf si des relevés de visite pris
/// hors ligne ne sont pas encore envoyés.
Future<bool> confirmerDeconnexion(BuildContext context, WidgetRef ref) async {
  final store = ref.read(visiteStoreProvider);
  var n = store.relevesEnAttente;
  if (n == 0) return true;
  final choix = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text('$n relevé${n > 1 ? 's' : ''} de visite pas encore envoyé${n > 1 ? 's' : ''}'),
      content: const Text('Pris hors ligne (mode visite). Si vous vous déconnectez maintenant, ils resteront sur ce téléphone jusqu\'à la prochaine connexion.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, 'annuler'), child: const Text('Annuler')),
        TextButton(onPressed: () => Navigator.pop(ctx, 'quand-meme'), child: const Text('Me déconnecter quand même')),
        FilledButton(onPressed: () => Navigator.pop(ctx, 'envoyer'), child: const Text('Envoyer puis me déconnecter')),
      ],
    ),
  );
  if (choix == 'quand-meme') return true;
  if (choix != 'envoyer') return false;
  await store.envoyerTout();
  n = store.relevesEnAttente;
  if (n > 0 && context.mounted) {
    showFacturesMessage(context, 'Envoi impossible (pas de réseau ?) : $n relevé${n > 1 ? 's' : ''} encore sur le téléphone.');
    return false;
  }
  return true;
}

class ParametresScreen extends ConsumerWidget {
  const ParametresScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(compteProvider);
    if (!a.hasValue) return _attente('Paramètres', a);
    final d = a.value!;
    final e = _map(d['entreprise']);
    final p = _map(d['profil']);
    final etapes = _map(d['etapes']);
    final devis = _map(d['devis']);
    final jetons = d['jetons'] is Map ? _map(d['jetons']) : null;
    final langue = _map(d['langue']);
    final langues = _liste(d['langues']);
    final nomLangue = _s(langues.firstWhere((l) => l['id'] == langue['langue'], orElse: () => {'nom': 'Français'})['nom']);
    Widget entree(String titre, String sous, VoidCallback onTap, {String icon = KojiIcons.chevronRight}) => KojiCard(
          onTap: onTap,
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(titre, style: TextStyle(fontWeight: FontWeight.w700, color: context.koji.heading)),
              Text(sous, style: TextStyle(fontSize: 12.5, color: context.koji.muted)),
            ])),
            const Icon(Icons.chevron_right),
          ]),
        );
    return KojiPage(
      title: 'Paramètres',
      subtitle: '${_s(e['nom'])} · ${_plans[_s(d['plan'])] ?? _s(d['plan'])}',
      appBarOnPhone: true,
      onRefresh: () async {
        ref.invalidate(compteProvider);
        await ref.read(compteProvider.future);
      },
      main: [
        if (num2(etapes['faites']) < num2(etapes['total']))
          KojiAlertBox(title: 'Profil · ${num2(etapes['faites']).round()} étapes sur ${num2(etapes['total']).round()}', message: _s(etapes['reste']), tone: KojiTone.amber, onTap: () => context.push('/profile/company')),
        entree('Mon entreprise', [e['nom'], if (_s(e['siren']).isNotEmpty) 'SIREN ${e['siren']}', 'TVA, décennale, RIB'].where((v) => _s(v).isNotEmpty).join(' · '), () => context.push('/profile/company')),
        entree('Mon profil', [[p['prenom'], p['nom']].where((v) => _s(v).isNotEmpty).join(' '), p['telephone'], 'mot de passe'].where((v) => _s(v).isNotEmpty).join(' · '), () => _monProfil(context, ref, p)),
        entree('Devis et factures', [devis['mediateur'] == null ? 'médiateur à désigner' : 'médiateur ${_map(devis['mediateur'])['nom']}', 'prochaine facture ${devis['prochaineFacture']}'].join(' · '), () => context.push(devisFacturesRoute)),
        entree('Langue et traduction', langue['langue'] == 'fr' ? 'Français' : '$nomLangue · traduction automatique activée', () => context.push(langueRoute)),
        entree('Notifications et sécurité', 'alertes, silence le soir, appareils', () => context.push(notificationsRoute)),
        entree('Abonnement et jetons', ['Koji ${_plans[_s(d['plan'])] ?? _s(d['plan'])}', if (jetons != null) '${num2(jetons['solde']).round()} jetons'].join(' · '), () => context.push(abonnementRoute)),
        entree('Éléments supprimés', 'gardés 30 jours · sur le site', () => ouvrirSite('/corbeille')),
        entree('Mes données', 'télécharger mes données · supprimer le compte', () => _mesDonnees(context, ref)),
        KojiButton(
          label: 'Se déconnecter',
          variant: KojiButtonVariant.secondary,
          expand: true,
          leadingIcon: KojiIcons.deconnexion,
          onPressed: () async {
            if (!await confirmerDeconnexion(context, ref)) return;
            await ref.read(authProvider.notifier).signOut();
            if (context.mounted) context.go('/login');
          },
        ),
      ],
    );
  }

  Future<void> _monProfil(BuildContext context, WidgetRef ref, Json p) async {
    final prenom = TextEditingController(text: _s(p['prenom']));
    final nom = TextEditingController(text: _s(p['nom']));
    final tel = TextEditingController(text: _s(p['telephone']));
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Mon profil', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            KojiField(label: 'Prénom', controller: prenom),
            const SizedBox(height: 10),
            KojiField(label: 'Nom', controller: nom),
            const SizedBox(height: 10),
            KojiField(label: 'Téléphone', controller: tel, keyboardType: TextInputType.phone),
            const SizedBox(height: 10),
            FactureKv('E-mail de connexion', _s(p['email'])),
            FactureKv('Connexion avec Google', p['google'] == true ? 'liée' : 'non liée'),
            const FactureKv('Double vérification', 'bientôt (fournisseur SMS à choisir)'),
            const SizedBox(height: 12),
            KojiButton(label: 'Enregistrer', expand: true, onPressed: () => Navigator.pop(ctx, true)),
            TextButton(onPressed: () => ouvrirSite('/parametres?section=profil'), child: const Text('Mot de passe et appareils, sur le site')),
          ]),
        ),
      ),
    );
    if (ok != true) return;
    try {
      await ref.read(compteRepositoryProvider).modifier({'profil': {'prenom': prenom.text.trim(), 'nom': nom.text.trim(), 'telephone': tel.text.trim()}});
      ref.invalidate(compteProvider);
      if (context.mounted) showFacturesMessage(context, 'Profil enregistré.');
    } catch (e) {
      if (context.mounted) showFacturesMessage(context, errorText(e));
    }
  }

  Future<void> _mesDonnees(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const ListTile(title: Text('Mes données', style: TextStyle(fontWeight: FontWeight.w700))),
          ListTile(leading: const Icon(Icons.download), title: const Text('Tout télécharger'), subtitle: const Text('devis, factures, chantiers, contacts · sur le site'), onTap: () => ouvrirSite('/parametres?section=donnees')),
          ListTile(leading: const Icon(Icons.upload_file), title: const Text('Importer mes données'), subtitle: const Text('clients, prix, tarifs fournisseurs · sur le site'), onTap: () => ouvrirSite('/parametres?section=donnees')),
          ListTile(
            leading: const Icon(Icons.delete_outline),
            title: const Text('Supprimer le compte'),
            subtitle: const Text('vos factures restent conservées 10 ans, comme la loi l\'exige'),
            onTap: () async {
              Navigator.pop(ctx);
              await confirmAccountDeletion(context, ref, accountType: 'entreprise');
            },
          ),
        ]),
      ),
    );
  }
}

/// Langue et traduction (maquette PRO-15.1).
class LangueScreen extends ConsumerStatefulWidget {
  const LangueScreen({super.key});

  @override
  ConsumerState<LangueScreen> createState() => _LangueScreenState();
}

class _LangueScreenState extends ConsumerState<LangueScreen> {
  Json? _r;

  Future<void> _maj(Json champs) async {
    final suivant = {...?_r, ...champs};
    setState(() => _r = suivant);
    try {
      final x = await ref.read(compteRepositoryProvider).modifier({'langue': suivant});
      setState(() => _r = _map(x['langue']));
      ref.invalidate(compteProvider);
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(compteProvider);
    if (!a.hasValue) return _attente('Langue et traduction', a);
    final d = a.value!;
    final r = _r ?? _map(d['langue']);
    final fr = r['langue'] == 'fr';
    final langues = _liste(d['langues']);
    Widget bascule(String cle, String label) => SwitchListTile(contentPadding: EdgeInsets.zero, title: Text(label), value: r[cle] == true, onChanged: fr ? null : (v) => _maj({cle: v}));
    return KojiPage(
      title: 'Langue et traduction',
      subtitle: 'messages, Devis guidé, dictée',
      appBarOnPhone: true,
      main: [
        const KojiSectionTitle('Ma langue'),
        for (final l in langues)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(r['langue'] == l['id'] ? Icons.radio_button_checked : Icons.radio_button_unchecked),
            title: Text(_s(l['nom']), textDirection: l['rtl'] == true ? TextDirection.rtl : TextDirection.ltr),
            subtitle: Text(_s(l['fr'])),
            onTap: () => _maj({'langue': l['id']}),
          ),
        Text("L'interface de Koji Pro reste en français pour l'instant.", style: TextStyle(fontSize: 12, color: context.koji.faint)),
        const KojiSectionTitle('Traduction automatique'),
        bascule('entrant', 'Traduire les messages reçus dans ma langue'),
        bascule('sortant', 'Traduire mes messages en français pour le client'),
        bascule('apercu', 'Montrer ce que le client va lire avant l\'envoi'),
        bascule('original', 'Toujours afficher le texte d\'origine'),
        const KojiAlertBox(title: 'Documents officiels', message: 'Devis, factures, avenants et contrats restent en français, comme la loi l\'exige. Montants, dates et quantités ne sont jamais traduits.', tone: KojiTone.info),
      ],
    );
  }
}

/// Notifications et sécurité (maquette PRO-15.4).
class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  Json? _n;

  Future<void> _maj(Json suivant) async {
    setState(() => _n = suivant);
    try {
      final x = await ref.read(compteRepositoryProvider).modifier({'notifications': suivant});
      setState(() => _n = _map(x['notifications']));
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(compteProvider);
    if (!a.hasValue) return _attente('Notifications', a);
    final d = a.value!;
    final n = _n ?? _map(d['notifications']);
    final evts = _map(n['evenements']);
    final p = context.koji;
    return KojiPage(
      title: 'Notifications et sécurité',
      appBarOnPhone: true,
      main: [
        const KojiSectionTitle('Me prévenir quand'),
        for (final e in _liste(d['evenements']))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(children: [
              Expanded(child: Text(_s(e['label']), style: TextStyle(color: p.heading))),
              for (final c in const [['telephone', 'Téléphone'], ['email', 'E-mail']])
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: FilterChip(
                    label: Text(c[1]),
                    selected: _map(evts[e['id']])[c[0]] == true,
                    onSelected: (v) => _maj({...n, 'evenements': {...evts, e['id']: {..._map(evts[e['id']]), c[0]: v}}}),
                  ),
                ),
            ]),
          ),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Silence le soir après 20 h et le dimanche'), subtitle: const Text('les e-mails partent le lendemain à 8 h'), value: n['silence'] != false, onChanged: (v) => _maj({...n, 'silence': v})),
        Text('SMS : bientôt (fournisseur à choisir).', style: TextStyle(fontSize: 12, color: p.faint)),
        const KojiSectionTitle('Sécurité'),
        const FactureKv('Double vérification', 'bientôt'),
        KojiButton(label: 'Mot de passe et appareils connectés', variant: KojiButtonVariant.secondary, expand: true, onPressed: () => ouvrirSite('/parametres?section=profil')),
      ],
    );
  }
}

/// Devis et factures (maquette PRO-15.2, téléphone).
class DevisFacturesScreen extends ConsumerStatefulWidget {
  const DevisFacturesScreen({super.key});

  @override
  ConsumerState<DevisFacturesScreen> createState() => _DevisFacturesScreenState();
}

class _DevisFacturesScreenState extends ConsumerState<DevisFacturesScreen> {
  bool _busy = false;

  Future<void> _mediateur(Json? actuel) async {
    final nom = TextEditingController(text: _s(actuel?['nom']));
    final site = TextEditingController(text: _s(actuel?['site']));
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Médiateur de la consommation', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          const Text('Obligatoire pour les clients particuliers : son nom est imprimé sur vos devis et factures.', style: TextStyle(fontSize: 13)),
          const SizedBox(height: 12),
          KojiField(label: 'Nom du médiateur', controller: nom),
          const SizedBox(height: 10),
          KojiField(label: 'Site ou adresse', controller: site),
          const SizedBox(height: 12),
          KojiButton(label: 'Enregistrer', expand: true, onPressed: () => Navigator.pop(ctx, true)),
        ]),
      ),
    );
    if (ok != true) return;
    setState(() => _busy = true);
    try {
      await ref.read(compteRepositoryProvider).profilEntreprise({'mediateur': {'nom': nom.text.trim(), 'site': site.text.trim()}});
      ref.invalidate(compteProvider);
      if (mounted) showFacturesMessage(context, 'Médiateur enregistré.');
    } catch (e) {
      if (mounted) showFacturesMessage(context, errorText(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = ref.watch(compteProvider);
    if (!a.hasValue) return _attente('Devis et factures', a);
    final d = _map(a.value!['devis']);
    final regimes = _map(d['regimes']);
    final c = _map(d['conditions']);
    final med = d['mediateur'] is Map ? _map(d['mediateur']) : null;
    return KojiPage(
      title: 'Devis et factures',
      subtitle: 'mentions et numérotation',
      appBarOnPhone: true,
      main: [
        FactureKv('Prochaine facture', _s(d['prochaineFacture'])),
        FactureKv('TVA', _s(_map(regimes[d['regime']])['label'])),
        FactureKv('Conditions', 'validité ${num2(c['validiteJours']).round()} j · acompte ${num2(c['acomptePct']).round()} % · paiement ${num2(c['paiementJours']).round()} j'),
        const FactureKv('Paiement', 'pénalités et indemnité de 40 € pour les pros'),
        FactureKv('IBAN', d['iban'] == true ? 'imprimé sur les factures' : 'à renseigner'),
        // Paiement en ligne (PRO-15.2) : rien tant qu'il n'est pas ouvert.
        const PaiementEnLigneCarte(),
        FactureKv('Médiateur', med == null ? 'à choisir · obligatoire pour les particuliers' : _s(med['nom'])),
        KojiButton(label: med == null ? 'Choisir un médiateur' : 'Modifier le médiateur', expand: true, loading: _busy, onPressed: _busy ? null : () => _mediateur(med)),
        const KojiSectionTitle('Mentions obligatoires'),
        for (final m in _liste(d['mentions'])) FactureKv(_s(m['label']), m['ok'] == true ? 'ajoutée par Koji' : _s(m['manque'])),
        Row(children: [
          Expanded(child: KojiButton(label: 'Mes prix', variant: KojiButtonVariant.secondary, onPressed: () => context.push('/bibliotheque'))),
          const SizedBox(width: 8),
          Expanded(child: KojiButton(label: 'TVA, CGV, IBAN', variant: KojiButtonVariant.secondary, onPressed: () => ouvrirSite('/profil?tab=devis'))),
        ]),
      ],
    );
  }
}

/// Abonnement et jetons (maquette PRO-15.3, téléphone). Rien ne se vend
/// dans l'app : l'offre se change sur le site.
class AbonnementScreen extends ConsumerWidget {
  const AbonnementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final a = ref.watch(compteProvider);
    if (!a.hasValue) return _attente('Abonnement et jetons', a);
    final d = a.value!;
    final f = ref.watch(facturesKojiProvider).valueOrNull;
    final ab = f?['abonnement'] is Map ? _map(f!['abonnement']) : null;
    final jetons = d['jetons'] is Map ? _map(d['jetons']) : null;
    final plan = _plans[_s(d['plan'])] ?? _s(d['plan']);
    return KojiPage(
      title: 'Abonnement et jetons',
      subtitle: 'Offre $plan',
      appBarOnPhone: true,
      main: [
        KojiKpiRow(children: [
          KojiKpi(label: 'Offre', value: plan),
          KojiKpi(label: 'Jetons', value: jetons == null ? '—' : '${num2(jetons['solde']).round()}'),
          KojiKpi(label: 'Prochain prélèvement', value: ab == null || _s(ab['prochainLe']).isEmpty ? '—' : jourCourt(ab['prochainLe'])),
        ]),
        if (jetons != null) ...[
          const KojiSectionTitle('Jetons du Radar'),
          FactureKv('Disponibles', '${num2(jetons['solde']).round()} · ${num2(jetons['inclus']).round()} inclus par mois, ${num2(jetons['achetes']).round()} achetés'),
          FactureKv('Réservés', '${num2(jetons['reserves']).round()} · rendus si aucun rendez-vous'),
          Text('Débités seulement si le client confirme un rendez-vous.', style: TextStyle(fontSize: 12, color: context.koji.faint)),
        ],
        const KojiSectionTitle('Factures Koji'),
        if (f == null) const Text('Chargement…') else if (_liste(f['factures']).isEmpty) const Text('Pas encore de facture Koji.'),
        for (final x in _liste(f?['factures']).take(6)) FactureKv('${x['numero']} · ${jourCourt(x['le'])}', '${num2(x['ttc']).toStringAsFixed(2).replaceAll('.', ',')} €'),
        const KojiAlertBox(title: 'Changer d\'offre', message: 'L\'abonnement se prend et se gère sur getkoji.io (Start, Pro, Business). Rien n\'est vendu dans l\'application.', tone: KojiTone.info),
        KojiButton(label: 'Gérer sur le site', variant: KojiButtonVariant.secondary, expand: true, onPressed: () => ouvrirSite('/parametres/abonnement')),
      ],
    );
  }
}
