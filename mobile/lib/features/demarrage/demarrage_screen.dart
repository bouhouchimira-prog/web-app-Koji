import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:koji/apps/entreprise/pro_home/pro_home_data.dart';
import 'package:koji/features/auth/pro_auth_widgets.dart';
import 'package:koji/features/demarrage/demarrage_logic.dart';

/// Géocodage de l'adresse de départ (API Adresse, gratuite) : null si rien
/// n'est trouvé.
typedef Geocodeur = Future<({String label, double lat, double lon})?> Function(
    String adresse);

Future<({String label, double lat, double lon})?> geocoderBan(
    String adresse) async {
  final reponse = await http
      .get(Uri.parse('https://api-adresse.data.gouv.fr/search/'
          '?q=${Uri.encodeQueryComponent(adresse)}&limit=1'))
      .timeout(const Duration(seconds: 10));
  final data = jsonDecode(reponse.body);
  final features = data is Map ? data['features'] : null;
  if (features is! List || features.isEmpty) return null;
  final f = features.first as Map;
  final coords = (f['geometry'] as Map)['coordinates'] as List;
  return (
    label: '${(f['properties'] as Map)['label']}',
    lat: (coords[1] as num).toDouble(),
    lon: (coords[0] as num).toDouble(),
  );
}

/// Koji Pro, démarrage guidé (maquette PRO-01.1, « Téléphone ») : une étape
/// par écran — barre graphite « étape N sur 6 », le contenu, le bouton jaune
/// en bas. Mêmes routes que le site (getkoji.io) : le profil, la fiche de
/// l'annuaire, les taux par métier. « Plus tard » est toujours possible.
/// Pas encore construits : l'import de factures, la lecture d'une photo de
/// l'attestation décennale, les taux proposés par Koji.
class DemarrageScreen extends ConsumerStatefulWidget {
  const DemarrageScreen({super.key, this.geocodeur, this.surFin});

  final Geocodeur? geocodeur;

  /// Sortie (« Plus tard » ou dernière étape) ; par défaut, l'accueil.
  final VoidCallback? surFin;

  @override
  ConsumerState<DemarrageScreen> createState() => _DemarrageScreenState();
}

class _DemarrageScreenState extends ConsumerState<DemarrageScreen> {
  static const _fond = Color(0xFFF5F5F2);
  static const _sec = Color(0xFFA7ABB2);

  Map<String, dynamic>? _user;
  Map<String, num> _taux = const {};
  int _index = 0;
  String? _erreurChargement;
  bool _envoi = false;
  String _erreur = '';

  // Étape 1
  final _siren = TextEditingController();
  Map<String, dynamic>? _fiche;
  bool _recherche = false;
  Timer? _attente;

  // Étape 2
  List<String> _metiers = [];
  int _rayon = 10;
  final _adresse = TextEditingController();

  // Étape 3 : 'choix' | 'calcul' | 'saisie'
  String _modePrix = 'choix';
  final Map<String, TextEditingController> _tauxChamps = {};
  final _autres = TextEditingController();
  final _charges = TextEditingController();
  final _revenu = TextEditingController();
  final _heures = TextEditingController();
  final _semaines = TextEditingController();

  // Étapes 4 à 6
  final _assureur = TextEditingController();
  final _contrat = TextEditingController();
  final _finDecennale = TextEditingController();
  String _logo = '';
  final _iban = TextEditingController();
  final _bic = TextEditingController();

  ProKojiWebClient get _api => ref.read(proKojiWebProvider);
  List<EtapeDemarrage> get _etapes =>
      _user == null ? const [] : etapesDemarrage(_user!, taux: _taux);

  @override
  void initState() {
    super.initState();
    _charger();
  }

  @override
  void dispose() {
    _attente?.cancel();
    for (final c in [
      _siren,
      _adresse,
      _autres,
      _charges,
      _revenu,
      _heures,
      _semaines,
      _assureur,
      _contrat,
      _finDecennale,
      _iban,
      _bic,
      ..._tauxChamps.values,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _charger() async {
    try {
      final user = await _api.profil();
      final taux = await _api.tauxMetiers().catchError((_) => <String, num>{});
      if (!mounted) return;
      setState(() {
        _user = user;
        _taux = taux;
        _remplir();
        final premiere = _etapes.indexWhere((e) => !e.faite);
        _index = premiere < 0 ? 0 : premiere;
        _erreurChargement = null;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _erreurChargement = e is ProKojiWebException
            ? e.message
            : 'Connexion impossible pour le moment.');
      }
    }
  }

  Map<String, dynamic> get _business =>
      Map<String, dynamic>.from(_user?['business'] as Map? ?? {});

  /// Champs pré-remplis depuis le profil.
  void _remplir() {
    final b = _business;
    String champ(String cle) => '${b[cle] ?? ''}';
    _siren.text = champ('siren');
    _metiers =
        (_user?['professions'] as List? ?? const []).map((e) => '$e').toList();
    _rayon = (b['zoneRadiusKm'] as num?)?.toInt() ?? 10;
    if (!rayonsZone.contains(_rayon)) _rayon = 10;
    _adresse.text =
        champ('zoneAddress').isNotEmpty ? champ('zoneAddress') : _siege;
    _autres.text = tauxTexte(tauxHoraireDe(b));
    _assureur.text = champ('decennaleInsurer');
    _contrat.text = champ('decennalePolicy');
    final fin = champ('decennaleUntil');
    _finDecennale.text = RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(fin)
        ? '${fin.substring(8)}/${fin.substring(5, 7)}/${fin.substring(0, 4)}'
        : '';
    _logo = champ('logoDataUrl');
    _iban.text = champ('iban').isEmpty ? '' : formaterIban(champ('iban'));
    _bic.text = champ('bic');
    if (_etapes.length > 2 && _etapes[2].faite) _modePrix = 'saisie';
  }

  /// Adresse du siège (fiche de l'annuaire), point de départ de la zone.
  String get _siege {
    final b = _business;
    String champ(String cle) => '${b[cle] ?? ''}'.trim();
    return [
      champ('addressLine1'),
      [champ('postalCode'), champ('city')].where((s) => s.isNotEmpty).join(' '),
    ].where((s) => s.isNotEmpty).join(', ');
  }

  TextEditingController _champTaux(String metier) => _tauxChamps.putIfAbsent(
      metier, () => TextEditingController(text: tauxTexte(_taux[metier])));

  // ---- navigation ----------------------------------------------------

  Future<void> _plusTard() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
          demarragePasseKey, DateTime.now().toIso8601String());
    } catch (_) {}
    _sortir();
  }

  void _sortir() {
    if (widget.surFin != null) {
      widget.surFin!();
    } else if (mounted) {
      context.go('/home');
    }
  }

  void _suivante() {
    final etapes = _etapes;
    final apres = etapes.indexed
        .where((e) => e.$1 > _index && !e.$2.faite)
        .map((e) => e.$1);
    setState(() {
      _erreur = '';
      if (apres.isNotEmpty) {
        _index = apres.first;
      } else if (_index < 5) {
        _index++;
      } else {
        _sortir();
      }
    });
  }

  void _precedente() {
    if (_index == 3 - 1 && _modePrix != 'choix' && !_etapes[2].faite) {
      setState(() => _modePrix = 'choix');
      return;
    }
    if (_index == 0) {
      _plusTard();
      return;
    }
    setState(() {
      _erreur = '';
      _index--;
    });
  }

  Future<void> _enregistrer(Map<String, dynamic> body) async {
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    try {
      final user = await _api.majProfil(body);
      if (!mounted) return;
      setState(() {
        _user = user;
        _envoi = false;
        // La fiche de l'annuaire vient d'arriver : départ de la zone.
        if (_adresse.text.trim().isEmpty) _adresse.text = _siege;
      });
      _suivante();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _envoi = false;
        _erreur = e is ProKojiWebException
            ? e.message
            : "L'enregistrement n'a pas abouti. Vérifiez la connexion.";
      });
    }
  }

  void _echec(String message) => setState(() {
        _envoi = false;
        _erreur = message;
      });

  // ---- étape 1 : SIREN ------------------------------------------------

  void _sirenChange(String valeur) {
    _attente?.cancel();
    setState(() {
      _fiche = null;
      _erreur = '';
    });
    final s = valeur.replaceAll(RegExp(r'\s'), '');
    if (s.length != 9) return;
    if (!sirenValide(s)) {
      setState(() =>
          _erreur = "Ce SIREN n'est pas valide : vérifiez les 9 chiffres.");
      return;
    }
    _attente = Timer(const Duration(milliseconds: 300), () => _chercher(s));
  }

  Future<void> _chercher(String siren) async {
    setState(() => _recherche = true);
    try {
      final fiche = await _api.ficheSiren(siren);
      if (mounted) setState(() => _fiche = fiche);
    } catch (e) {
      if (mounted) {
        setState(() => _erreur = e is ProKojiWebException
            ? e.message
            : 'Recherche impossible pour le moment.');
      }
    } finally {
      if (mounted) setState(() => _recherche = false);
    }
  }

  // ---- étape 2 : métiers et zone ---------------------------------------

  Future<void> _validerMetiers() async {
    if (_metiers.isEmpty) return _echec('Choisissez au moins un métier.');
    final adresse = _adresse.text.trim();
    if (adresse.isEmpty) {
      return _echec(
          "Indiquez l'adresse d'où vous partez (le siège, en général).");
    }
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    ({String label, double lat, double lon})? lieu;
    try {
      lieu = await (widget.geocodeur ?? geocoderBan)(adresse);
    } catch (_) {
      lieu = null;
    }
    if (lieu == null) {
      return _echec(
          'Adresse introuvable : vérifiez la ville et le code postal.');
    }
    await _enregistrer({
      'professions': _metiers,
      'business': {
        'zoneAddress': lieu.label,
        'zoneLat': lieu.lat,
        'zoneLon': lieu.lon,
        'zoneRadiusKm': _rayon,
      },
    });
  }

  // ---- étape 3 : prix ----------------------------------------------------

  int? get _minimum => tauxMinimum(
        charges: nombre(_charges.text),
        revenu: nombre(_revenu.text),
        heuresParSemaine: nombre(_heures.text),
        semaines: nombre(_semaines.text),
      );

  List<String> get _metiersTaux => _metiers.where(metierAvecTaux).toList();

  void _utiliserCalcul() {
    final m = _minimum;
    if (m == null) return;
    for (final metier in _metiersTaux) {
      final c = _champTaux(metier);
      if (c.text.trim().isEmpty) c.text = '$m';
    }
    if (_autres.text.trim().isEmpty) _autres.text = '$m';
    setState(() => _modePrix = 'saisie');
  }

  Future<void> _validerPrix() async {
    final autres = nombre(_autres.text) ?? 0;
    if (autres <= 0) {
      return _echec('Indiquez au moins le taux des autres postes : il chiffre '
          'la préparation, la dépose et l\'évacuation.');
    }
    setState(() {
      _envoi = true;
      _erreur = '';
    });
    try {
      final taux = await _api.enregistrerTaux({
        for (final m in _metiersTaux) m: nombre(_champTaux(m).text),
      });
      _taux = taux;
    } catch (e) {
      return _echec(e is ProKojiWebException
          ? e.message
          : "L'enregistrement n'a pas abouti. Vérifiez la connexion.");
    }
    final heures = (_business['hoursPerDay'] as num?)?.toDouble() ?? 7;
    await _enregistrer({
      'business': {
        'dailyRate': (autres * heures * 100).round() / 100,
        'hoursPerDay': heures,
      },
    });
  }

  // ---- étapes 4 à 6 ------------------------------------------------------

  Future<void> _validerDecennale() async {
    final m = RegExp(r'^(\d{1,2})/(\d{1,2})/(\d{4})$')
        .firstMatch(_finDecennale.text.trim());
    if (_assureur.text.trim().isEmpty || m == null) {
      return _echec("Indiquez l'assureur et la date de fin (jj/mm/aaaa).");
    }
    final iso = '${m[3]}-${m[2]!.padLeft(2, '0')}-${m[1]!.padLeft(2, '0')}';
    await _enregistrer({
      'business': {
        'decennaleInsurer': _assureur.text.trim(),
        'decennalePolicy': _contrat.text.trim(),
        'decennaleUntil': iso,
      },
    });
  }

  Future<void> _choisirLogo() async {
    try {
      final image = await ImagePicker()
          .pickImage(source: ImageSource.gallery, maxWidth: 1024);
      if (image == null) return;
      final codec = await ui.instantiateImageCodec(await image.readAsBytes(),
          targetWidth: 512);
      final frame = await codec.getNextFrame();
      final png = await frame.image.toByteData(format: ui.ImageByteFormat.png);
      if (png == null || !mounted) return;
      setState(() => _logo =
          'data:image/png;base64,${base64Encode(png.buffer.asUint8List())}');
    } catch (_) {
      if (mounted) _echec('Image illisible : choisissez un PNG ou un JPG.');
    }
  }

  Future<void> _validerIban() async {
    if (!ibanValide(_iban.text)) {
      return _echec(
          "Cet IBAN n'est pas valide : vérifiez les chiffres (la clé ne correspond pas).");
    }
    await _enregistrer({
      'business': {
        'iban': formaterIban(_iban.text),
        'bic': _bic.text.trim().toUpperCase(),
      },
    });
  }

  // ---- écran ---------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final etapes = _etapes;
    final etape = etapes.isEmpty ? null : etapes[_index];
    return Scaffold(
      backgroundColor: _fond,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _barre(etape),
          Expanded(
            child: _user == null
                ? _attenteOuErreur()
                : SafeArea(top: false, child: _corps(etape!)),
          ),
        ],
      ),
    );
  }

  Widget _barre(EtapeDemarrage? etape) {
    final haut = MediaQuery.paddingOf(context).top;
    return Container(
      color: ProAuth.graphite,
      padding: EdgeInsets.fromLTRB(6, haut + 6, 8, 6),
      child: Row(
        children: [
          IconButton(
            onPressed: _user == null ? _plusTard : _precedente,
            tooltip: 'Retour',
            icon: SvgPicture.string(
              '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">'
              '<path d="M15 5l-7 7 7 7" fill="none" stroke="#F5F5F2" '
              'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
              width: 20,
              height: 20,
            ),
          ),
          const SizedBox(width: 2),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(etape?.titre ?? 'Démarrage guidé',
                    style: ProAuth.text(15,
                        weight: FontWeight.w700,
                        color: const Color(0xFFF5F5F2))),
                Text(
                    etape == null
                        ? 'Bienvenue sur Koji · 10 minutes'
                        : 'étape ${_index + 1} sur 6',
                    style: ProAuth.text(12, color: _sec)),
              ],
            ),
          ),
          TextButton(
            onPressed: _plusTard,
            child: Text('Plus tard',
                style: ProAuth.text(13,
                    weight: FontWeight.w600, color: const Color(0xFFF5F5F2))),
          ),
        ],
      ),
    );
  }

  Widget _attenteOuErreur() {
    if (_erreurChargement == null) {
      return const Center(
        child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
                strokeWidth: 2.4, color: ProAuth.graphite)),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_erreurChargement!, style: ProAuth.text(15)),
          const SizedBox(height: 14),
          ProAuthPrimaryButton(label: 'Réessayer', onPressed: _charger),
        ],
      ),
    );
  }

  Widget _corps(EtapeDemarrage etape) {
    final (contenu, bouton) = switch (etape.id) {
      'entreprise' => _etapeEntreprise(),
      'metiers' => _etapeMetiers(),
      'prix' => _etapePrix(),
      'decennale' => _etapeDecennale(),
      'logo' => _etapeLogo(),
      _ => _etapeIban(),
    };
    final passable = _index >= 3;
    return LayoutBuilder(
      builder: (context, c) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 20),
        child: ConstrainedBox(
          constraints: BoxConstraints(minHeight: c.maxHeight - 34),
          child: IntrinsicHeight(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _progression(),
                const SizedBox(height: 14),
                ...contenu,
                if (_erreur.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  _messageErreur(_erreur),
                ],
                const Spacer(),
                const SizedBox(height: 16),
                bouton,
                if (passable) ...[
                  const SizedBox(height: 6),
                  TextButton(
                    onPressed: _envoi ? null : _suivante,
                    child: Text('Passer cette étape',
                        style: ProAuth.text(13,
                            weight: FontWeight.w600, color: ProAuth.grey)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _progression() {
    final faites = _etapes.where((e) => e.faite).length;
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            child: LinearProgressIndicator(
              value: faites / 6,
              minHeight: 6,
              color: ProAuth.graphite,
              backgroundColor: const Color(0xFFE2E2DB),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Text('$faites étape${faites > 1 ? 's' : ''} sur 6',
            style: ProAuth.text(12, color: ProAuth.grey)),
      ],
    );
  }

  Widget _messageErreur(String message) => Container(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
        decoration: const BoxDecoration(
          color: Color(0xFFFBEAE9),
          border: Border(left: BorderSide(color: Color(0xFFB3261E), width: 3)),
        ),
        child: Text(message,
            style: ProAuth.text(14, color: const Color(0xFF8C1D18))),
      );

  Widget _note(String texte) =>
      Text(texte, style: ProAuth.text(12, color: ProAuth.grey, height: 1.4));

  Widget _titre(String texte) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(texte.toUpperCase(),
            style:
                ProAuth.text(11, weight: FontWeight.w600, color: ProAuth.grey)),
      );

  Widget _boutonPrincipal(String label, VoidCallback? action) =>
      ProAuthPrimaryButton(label: label, loading: _envoi, onPressed: action);

  // Étape 1 ----------------------------------------------------------------

  (List<Widget>, Widget) _etapeEntreprise() {
    final fiche = _fiche;
    final dejaFaite = _etapes[0].faite && fiche == null;
    return (
      [
        ProAuthField(
          label: 'Votre SIREN',
          controller: _siren,
          hint: '9 chiffres',
          keyboardType: TextInputType.number,
          maxLength: 11,
          onChanged: _sirenChange,
          suffix: _recherche
              ? const Padding(
                  padding: EdgeInsets.all(14),
                  child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: ProAuth.graphite)),
                )
              : null,
        ),
        const SizedBox(height: 12),
        if (fiche != null)
          _carteFiche(fiche)
        else if (dejaFaite)
          _carteFiche(_business)
        else
          _note("Koji remplit raison sociale, adresse et TVA depuis l'annuaire "
              'des entreprises. Pas encore de SIREN ? Passez : vous pourrez '
              'compléter dans Profil.'),
      ],
      fiche != null
          ? _boutonPrincipal(
              "C'est bien moi", () => _enregistrer({'business': fiche}))
          : dejaFaite
              ? _boutonPrincipal('Continuer', _suivante)
              : _boutonPrincipal('Passer pour l\'instant', _suivante),
    );
  }

  Widget _carteFiche(Map<String, dynamic> fiche) {
    String champ(String cle) => '${fiche[cle] ?? ''}'.trim();
    final adresse = [
      champ('addressLine1'),
      [champ('postalCode'), champ('city')].where((s) => s.isNotEmpty).join(' '),
    ].where((s) => s.isNotEmpty).join(', ');
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: ProAuth.graphite),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("TROUVÉ DANS L'ANNUAIRE DES ENTREPRISES",
              style: ProAuth.text(11,
                  weight: FontWeight.w700, color: ProAuth.grey)),
          const SizedBox(height: 4),
          Text(champ('raisonSociale'),
              style: ProAuth.text(18, weight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(
              [champ('formeJuridique'), adresse]
                  .where((s) => s.isNotEmpty)
                  .join(' · '),
              style: ProAuth.text(13, color: ProAuth.grey, height: 1.35)),
        ],
      ),
    );
  }

  // Étape 2 ----------------------------------------------------------------

  Widget _puce(String label, bool on, VoidCallback onTap) => Semantics(
        button: true,
        selected: on,
        child: Material(
          color: on ? ProAuth.graphite : Colors.white,
          shape: RoundedRectangleBorder(
            side: BorderSide(
                color: on ? ProAuth.graphite : const Color(0xFFD9D9D4)),
            borderRadius: ProAuth.radius,
          ),
          child: InkWell(
            onTap: onTap,
            borderRadius: ProAuth.radius,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Text(label,
                  style: ProAuth.text(13,
                      weight: on ? FontWeight.w600 : FontWeight.w500,
                      color: on ? Colors.white : ProAuth.grey)),
            ),
          ),
        ),
      );

  (List<Widget>, Widget) _etapeMetiers() => (
        [
          _titre('Vos métiers'),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final m in metiersDemarrage)
                _puce(
                  _metiers.contains(m.metier) ? m.activite : '+ ${m.activite}',
                  _metiers.contains(m.metier),
                  () => setState(() {
                    _erreur = '';
                    _metiers.contains(m.metier)
                        ? _metiers.remove(m.metier)
                        : _metiers.add(m.metier);
                  }),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _titre('Votre zone'),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final km in rayonsZone)
                _puce(
                    '$km km', _rayon == km, () => setState(() => _rayon = km)),
            ],
          ),
          const SizedBox(height: 12),
          ProAuthField(
            label: 'autour de',
            controller: _adresse,
            hint: '12 rue des Vinaigriers, 75010 Paris',
            keyboardType: TextInputType.streetAddress,
          ),
          const SizedBox(height: 10),
          _note('Débloque le Radar des chantiers : vous voyez les chantiers '
              'de vos métiers dans cette zone.'),
        ],
        _boutonPrincipal('Continuer', _validerMetiers),
      );

  // Étape 3 ----------------------------------------------------------------

  Widget _option(String titre, String detail, String mode) {
    final on = _modePrix == mode;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          side: BorderSide(
              color: on ? ProAuth.graphite : const Color(0xFFD9D9D4),
              width: on ? 2 : 1),
          borderRadius: ProAuth.radius,
        ),
        child: InkWell(
          onTap: () => setState(() => _modePrix = mode),
          borderRadius: ProAuth.radius,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(titre, style: ProAuth.text(15, weight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(detail, style: ProAuth.text(12, color: ProAuth.grey)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _ligneTaux(String titre, String? detail, TextEditingController c) =>
      Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFD9D9D4)))),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(titre, style: ProAuth.text(14, weight: FontWeight.w600)),
                  if (detail != null)
                    Text(detail, style: ProAuth.text(12, color: ProAuth.grey)),
                ],
              ),
            ),
            SizedBox(
              width: 86,
              child: TextField(
                controller: c,
                textAlign: TextAlign.right,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9,.]'))
                ],
                style: ProAuth.text(17, weight: FontWeight.w700),
                decoration: const InputDecoration(
                  isDense: true,
                  hintText: '—',
                  filled: true,
                  fillColor: Colors.white,
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                  enabledBorder: OutlineInputBorder(
                      borderRadius: ProAuth.radius,
                      borderSide: BorderSide(color: ProAuth.field)),
                  focusedBorder: OutlineInputBorder(
                      borderRadius: ProAuth.radius,
                      borderSide:
                          BorderSide(color: ProAuth.graphite, width: 2)),
                ),
              ),
            ),
            const SizedBox(width: 6),
            Text('€/h', style: ProAuth.text(12, color: ProAuth.grey)),
          ],
        ),
      );

  (List<Widget>, Widget) _etapePrix() {
    switch (_modePrix) {
      case 'calcul':
        final m = _minimum;
        return (
          [
            _titre('Calculer mon taux · 4 questions'),
            for (final (label, c, hint) in [
              ("Charges de l'année (€)", _charges, '18 000'),
              ('Revenu voulu, avant impôt (€)', _revenu, '36 000'),
              ('Heures facturées par semaine', _heures, '30'),
              ('Semaines travaillées', _semaines, '44'),
            ]) ...[
              ProAuthField(
                label: label,
                controller: c,
                hint: hint,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 10),
            ],
            Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: ProAuth.graphite),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Votre taux minimum',
                      style: ProAuth.text(12, color: ProAuth.grey)),
                  Text(m == null ? '—' : '$m € HT/h',
                      style: ProAuth.text(26, weight: FontWeight.w700)),
                  Text("en dessous, vous perdez de l'argent",
                      style: ProAuth.text(12, color: ProAuth.grey)),
                ],
              ),
            ),
          ],
          _boutonPrincipal(
              'Utiliser ce calcul', m == null ? null : _utiliserCalcul),
        );
      case 'saisie':
        return (
          [
            _titre('Vos taux'),
            for (final metier in _metiersTaux)
              _ligneTaux(activiteDe(metier), null, _champTaux(metier)),
            _ligneTaux(
                'Autres postes',
                'préparation, dépose, évacuation, et tout métier sans taux',
                _autres),
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerLeft,
              child: ProAuthPill(
                label: 'Je ne connais pas mon taux : le calculer',
                onTap: () => setState(() => _modePrix = 'calcul'),
              ),
            ),
          ],
          _boutonPrincipal('Valider mes prix', _validerPrix),
        );
      default:
        return (
          [
            Text('Comment voulez-vous régler vos prix ?',
                style: ProAuth.text(16, weight: FontWeight.w700)),
            const SizedBox(height: 12),
            _option(
                'Calculer mon taux', '4 questions sur vos charges', 'calcul'),
            _option('Je connais mes taux', 'saisie par métier', 'saisie'),
            const SizedBox(height: 4),
            _note('Koji chiffre vos devis et le Radar avec ces taux ; il '
                "n'invente jamais de prix."),
          ],
          _boutonPrincipal(
              'Continuer', () => setState(() => _modePrix = 'saisie')),
        );
    }
  }

  // Étapes 4 à 6 -------------------------------------------------------------

  (List<Widget>, Widget) _etapeDecennale() => (
        [
          ProAuthField(label: 'Assureur', controller: _assureur),
          const SizedBox(height: 10),
          ProAuthField(label: 'N° de contrat', controller: _contrat),
          const SizedBox(height: 10),
          ProAuthField(
            label: "Valable jusqu'au",
            controller: _finDecennale,
            hint: 'jj/mm/aaaa',
            keyboardType: TextInputType.datetime,
          ),
          const SizedBox(height: 10),
          _note('Ces mentions apparaissent sur vos devis, comme la loi '
              "l'exige."),
        ],
        _boutonPrincipal('Enregistrer', _validerDecennale),
      );

  (List<Widget>, Widget) _etapeLogo() {
    Widget apercu;
    if (_logo.startsWith('data:image')) {
      apercu = Image.memory(base64Decode(_logo.split(',').last),
          fit: BoxFit.contain);
    } else {
      apercu = Center(
          child: Text('Logo', style: ProAuth.text(12, color: ProAuth.grey)));
    }
    return (
      [
        Row(
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: ProAuth.field),
              ),
              child: apercu,
            ),
            const SizedBox(width: 14),
            ProAuthPill(
              label: _logo.isEmpty ? 'Choisir une image' : "Changer d'image",
              onTap: _choisirLogo,
            ),
          ],
        ),
        const SizedBox(height: 10),
        _note('Une image carrée suffit ; sans logo, Koji affiche vos '
            'initiales sur votre KojiPage et votre carte de visite.'),
      ],
      _boutonPrincipal(
          'Enregistrer le logo',
          _logo.isEmpty
              ? null
              : () => _enregistrer({
                    'business': {'logoDataUrl': _logo}
                  })),
    );
  }

  (List<Widget>, Widget) _etapeIban() => (
        [
          ProAuthField(
            label: 'IBAN',
            controller: _iban,
            hint: 'FR76 3000 6000 0112 3456 7890 189',
          ),
          const SizedBox(height: 10),
          ProAuthField(
              label: 'BIC · facultatif', controller: _bic, hint: 'BNPAFRPP'),
          const SizedBox(height: 10),
          _note('Imprimé sur vos factures pour le règlement par virement.'),
        ],
        _boutonPrincipal('Enregistrer', _validerIban),
      );
}
