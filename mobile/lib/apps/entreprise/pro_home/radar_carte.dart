import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import 'package:koji/app/koji_web_api_config.dart';

/// Carte du Radar (maquette PRO-01, « wmap » sur ordinateur, « mapview » sur
/// téléphone) : fond OpenStreetMap aux couleurs de la maquette — le même
/// style que le site, servi par getkoji.io (public/carte/radar-style.json) —
/// et une étiquette de prix par chantier, posée au centre de sa maille de
/// ~2 km (lib/radar-position.js côté site) : jamais l'adresse.
///
/// Les étiquettes sont des widgets Flutter placés par la projection Web
/// Mercator de MapLibre (tuiles de 512 px) : elles suivent la carte pendant
/// les gestes, sur Android comme sur iPhone, et restent testables sans
/// carte native (fond uni dans les tests et sur ordinateur).
class RadarPoint {
  const RadarPoint({
    required this.id,
    required this.lat,
    required this.lon,
    required this.label,
    this.taken = false,
  });

  final String id;
  final double lat;
  final double lon;
  final String label;
  final bool taken;
}

/// Zone de travail de l'entreprise (profil), pour centrer et légender.
class RadarZone {
  const RadarZone({
    required this.lat,
    required this.lon,
    required this.radiusKm,
    this.ville = '',
  });

  final double lat;
  final double lon;
  final double radiusKm;
  final String ville;

  static RadarZone? fromJson(dynamic data) {
    if (data is! Map) return null;
    final lat = (data['lat'] as num?)?.toDouble();
    final lon = (data['lon'] as num?)?.toDouble();
    if (lat == null || lon == null) return null;
    return RadarZone(
      lat: lat,
      lon: lon,
      radiusKm: (data['radiusKm'] as num?)?.toDouble() ?? 20,
      ville: (data['ville'] ?? '').toString(),
    );
  }
}

@immutable
class RadarCamera {
  const RadarCamera(this.lat, this.lon, this.zoom);

  final double lat;
  final double lon;
  final double zoom;

  static const france = RadarCamera(46.6, 2.4, 4.6);
}

const _tuile = 512.0;
const _zoomMax = 13.0;

double _mercX(double lon) => (lon + 180) / 360;
double _mercY(double lat) {
  final r = lat.clamp(-85.05, 85.05) * math.pi / 180;
  return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2;
}

double _lonDe(double x) => x * 360 - 180;
double _latDe(double y) =>
    math.atan(
        (math.exp(math.pi * (1 - 2 * y)) - math.exp(-math.pi * (1 - 2 * y))) /
            2) *
    180 /
    math.pi;

/// Position à l'écran (pixels logiques) d'un point pour une caméra donnée.
Offset projeterRadar(double lat, double lon, RadarCamera camera, Size taille) {
  final monde = _tuile * math.pow(2, camera.zoom);
  return Offset(
    (_mercX(lon) - _mercX(camera.lon)) * monde + taille.width / 2,
    (_mercY(lat) - _mercY(camera.lat)) * monde + taille.height / 2,
  );
}

/// Cadrage initial : tous les chantiers dans la zone utile (marges pour la
/// légende, le zoom et l'étiquette qui monte au-dessus du point), sinon la
/// zone de travail, sinon la France.
RadarCamera cadrerRadar(
  List<RadarPoint> points,
  Size taille,
  EdgeInsets marges, {
  RadarZone? zone,
}) {
  if (points.isEmpty) {
    if (zone == null) return RadarCamera.france;
    final zoom = zone.radiusKm > 40
        ? 8.0
        : zone.radiusKm > 15
            ? 9.5
            : 10.5;
    return RadarCamera(zone.lat, zone.lon, zoom);
  }
  final xs = points.map((p) => _mercX(p.lon));
  final ys = points.map((p) => _mercY(p.lat));
  final minX = xs.reduce(math.min), maxX = xs.reduce(math.max);
  final minY = ys.reduce(math.min), maxY = ys.reduce(math.max);
  final utileL = math.max(1.0, taille.width - marges.horizontal);
  final utileH = math.max(1.0, taille.height - marges.vertical);
  final dx = maxX - minX, dy = maxY - minY;
  final zoom = dx == 0 && dy == 0
      ? 12.5
      : math
          .min(
            _zoomMax,
            math.min(
              dx == 0 ? _zoomMax : math.log(utileL / (dx * _tuile)) / math.ln2,
              dy == 0 ? _zoomMax : math.log(utileH / (dy * _tuile)) / math.ln2,
            ),
          )
          .toDouble();
  final monde = _tuile * math.pow(2, zoom);
  // Centre de la zone utile, décalé des marges inégales.
  final cx = (minX + maxX) / 2 - (marges.left - marges.right) / 2 / monde;
  final cy = (minY + maxY) / 2 - (marges.top - marges.bottom) / 2 / monde;
  return RadarCamera(_latDe(cy), _lonDe(cx), zoom);
}

/// Les chantiers d'une même maille se rangent côte à côte au-dessus du
/// même point (décalage à l'écran seulement).
const pasEtiquettes = 86.0;

Map<String, double> decalagesRadar(List<RadarPoint> points) {
  final groupes = <String, List<RadarPoint>>{};
  for (final p in points) {
    groupes.putIfAbsent('${p.lat},${p.lon}', () => []).add(p);
  }
  return {
    for (final groupe in groupes.values)
      for (final (i, p) in groupe.indexed)
        p.id: (i - (groupe.length - 1) / 2) * pasEtiquettes,
  };
}

/// Ce que le fond de carte sait faire pour les boutons + et −.
abstract class RadarFondCommandes {
  void zoomer(double delta);
  void allerA(RadarCamera camera);
}

typedef RadarFondBuilder = Widget Function(
  BuildContext context,
  RadarCamera initiale,
  ValueChanged<RadarCamera> surCamera,
  ValueChanged<RadarFondCommandes> surPret,
);

bool get _carteNative =>
    kIsWeb ||
    defaultTargetPlatform == TargetPlatform.android ||
    defaultTargetPlatform == TargetPlatform.iOS;

/// Fond MapLibre (Android, iPhone, web) aux couleurs de la maquette.
Widget fondMapLibre(
  BuildContext context,
  RadarCamera initiale,
  ValueChanged<RadarCamera> surCamera,
  ValueChanged<RadarFondCommandes> surPret,
) =>
    _FondMapLibre(initiale: initiale, surCamera: surCamera, surPret: surPret);

/// Fond uni (tests, ordinateur) : mêmes étiquettes, zoom par les boutons.
Widget fondUni(
  BuildContext context,
  RadarCamera initiale,
  ValueChanged<RadarCamera> surCamera,
  ValueChanged<RadarFondCommandes> surPret,
) =>
    _FondUni(initiale: initiale, surCamera: surCamera, surPret: surPret);

class RadarCarte extends StatefulWidget {
  const RadarCarte({
    super.key,
    required this.points,
    this.selectedId,
    this.onSelect,
    this.zone,
    this.caption,
    this.nouveaux,
    this.prises,
    this.plein = false,
    this.marges = const EdgeInsets.fromLTRB(44, 92, 64, 60),
    this.fond,
  });

  final List<RadarPoint> points;
  final String? selectedId;
  final ValueChanged<String>? onSelect;
  final RadarZone? zone;

  /// Légende en haut à gauche (« Paris et 20 km autour · 4 chantiers »).
  final String? caption;

  /// Légende du bas « Nouveau n · Position prise n » (ordinateur).
  final int? nouveaux;
  final int? prises;

  /// Téléphone, carte plein écran (maquette « mapview ») : ni légendes ni
  /// boutons de zoom, les gestes suffisent.
  final bool plein;

  /// Zone à garder libre autour des chantiers au premier cadrage.
  final EdgeInsets marges;

  /// Fond de carte ; par défaut MapLibre sur téléphone et web, uni ailleurs.
  final RadarFondBuilder? fond;

  @override
  State<RadarCarte> createState() => _RadarCarteState();
}

class _RadarCarteState extends State<RadarCarte> {
  RadarCamera? _camera;
  RadarFondCommandes? _commandes;
  String _cadrage = '';

  String get _cle => [
        for (final p in widget.points) '${p.id}:${p.lat}:${p.lon}',
        widget.zone?.lat,
        widget.zone?.lon,
      ].join('|');

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final taille = Size(c.maxWidth, c.maxHeight);
      // Premier cadrage, puis à chaque nouvelle liste de chantiers.
      final initiale =
          cadrerRadar(widget.points, taille, widget.marges, zone: widget.zone);
      if (_camera == null) {
        _camera = initiale;
        _cadrage = _cle;
      } else if (_cadrage != _cle) {
        // Nouvelle liste (filtre, rechargement) : on recadre la même carte.
        _camera = initiale;
        _cadrage = _cle;
        final commandes = _commandes;
        WidgetsBinding.instance
            .addPostFrameCallback((_) => commandes?.allerA(initiale));
      }
      final camera = _camera!;
      final fond = widget.fond ?? (_carteNative ? fondMapLibre : fondUni);
      final decalages = decalagesRadar(widget.points);
      final ordre = [...widget.points]..sort((a, b) =>
          (a.id == widget.selectedId ? 1 : 0)
              .compareTo(b.id == widget.selectedId ? 1 : 0));

      return ClipRect(
        child: Stack(
          children: [
            Positioned.fill(
              child: ColoredBox(
                color: const Color(0xFFECEAE3),
                child: fond(
                  context,
                  camera,
                  (cam) {
                    if (mounted) setState(() => _camera = cam);
                  },
                  (commandes) => _commandes = commandes,
                ),
              ),
            ),
            for (final p in ordre)
              _place(p, projeterRadar(p.lat, p.lon, camera, taille),
                  decalages[p.id] ?? 0, taille),
            if (!widget.plein && widget.caption != null)
              Positioned(
                left: 12,
                top: 12,
                right: 12,
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: _Cartouche(
                    child: Text(widget.caption!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: _texte(13, FontWeight.w600)),
                  ),
                ),
              ),
            if (!widget.plein && widget.nouveaux != null)
              Positioned(
                left: 12,
                bottom: 12,
                child: _Cartouche(
                  padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _pastille(plein: true),
                      const SizedBox(width: 6),
                      Text('Nouveau ${widget.nouveaux}',
                          style: _texte(13, FontWeight.w600)),
                      const SizedBox(width: 14),
                      _pastille(plein: false),
                      const SizedBox(width: 6),
                      Text('Position prise ${widget.prises ?? 0}',
                          style: _texte(13, FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            if (!widget.plein)
              Positioned(
                right: 12,
                bottom: 12,
                child: _Zoom(
                  plus: () => _commandes?.zoomer(1),
                  moins: () => _commandes?.zoomer(-1),
                ),
              ),
          ],
        ),
      );
    });
  }

  Widget _place(RadarPoint p, Offset ecran, double dx, Size taille) {
    final x = ecran.dx + dx;
    final y = ecran.dy - 7;
    // Hors de la carte (avec de la marge pour l'étiquette) : rien à poser.
    if (x < -120 ||
        x > taille.width + 120 ||
        y < -10 ||
        y > taille.height + 60) {
      return const SizedBox.shrink();
    }
    return Positioned(
      left: x,
      top: y,
      child: FractionalTranslation(
        translation: const Offset(-0.5, -1),
        child: RadarEtiquette(
          label: p.label,
          taken: p.taken,
          selected: p.id == widget.selectedId,
          onTap: widget.onSelect == null ? null : () => widget.onSelect!(p.id),
        ),
      ),
    );
  }
}

TextStyle _texte(double size, FontWeight weight,
        {Color color = const Color(0xFF171B1E)}) =>
    TextStyle(
      fontFamily: 'DMSans',
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: 1.2,
    );

Widget _pastille({required bool plein}) => Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: plein ? const Color(0xFF171B1E) : null,
        border: plein
            ? null
            : Border.all(color: const Color(0xFF171B1E), width: 1.5),
      ),
    );

class _Cartouche extends StatelessWidget {
  const _Cartouche({
    required this.child,
    this.padding = const EdgeInsets.fromLTRB(9, 5, 9, 5),
  });

  final Widget child;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: const Color(0xFFD9D9D4)),
          borderRadius: BorderRadius.circular(2),
        ),
        child: child,
      );
}

class _Zoom extends StatelessWidget {
  const _Zoom({required this.plus, required this.moins});

  final VoidCallback plus;
  final VoidCallback moins;

  @override
  Widget build(BuildContext context) {
    Widget bouton(String texte, String label, VoidCallback onTap) => Semantics(
          button: true,
          label: label,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: 34,
              height: 34,
              child: Center(
                  child: Text(texte, style: _texte(18, FontWeight.w600))),
            ),
          ),
        );
    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: Color(0xFFD9D9D4)),
        borderRadius: BorderRadius.circular(2),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          bouton('+', 'Zoomer', plus),
          Container(width: 34, height: 1, color: const Color(0xFFD9D9D4)),
          bouton('−', 'Dézoomer', moins),
        ],
      ),
    );
  }
}

/// Étiquette de prix : graphite, 4 px, pointe qui accroche le lieu ;
/// blanche à bord tireté quand la position est prise ; soulignée quand le
/// chantier est ouvert dans la liste.
class RadarEtiquette extends StatelessWidget {
  const RadarEtiquette({
    super.key,
    required this.label,
    this.taken = false,
    this.selected = false,
    this.onTap,
  });

  final String label;
  final bool taken;
  final bool selected;
  final VoidCallback? onTap;

  static const _graphite = Color(0xFF171B1E);
  static const _gris = Color(0xFF5B5F66);

  @override
  Widget build(BuildContext context) {
    final couleur = taken ? _gris : _graphite;
    final boite = CustomPaint(
      painter: _BoiteEtiquette(
        fond: taken ? Colors.white : _graphite,
        bord: couleur,
        tirete: taken,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(9, 5, 9, 5),
        child: Text(label,
            style: _texte(13, FontWeight.w700,
                color: taken ? _gris : Colors.white)),
      ),
    );
    return Semantics(
      button: onTap != null,
      selected: selected,
      label: '$label${taken ? ', position prise' : ''}',
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            selected
                ? Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      border: Border.all(color: _graphite, width: 2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: boite,
                  )
                : boite,
            CustomPaint(
              size: const Size(12, 7),
              painter: _Pointe(couleur),
            ),
          ],
        ),
      ),
    );
  }
}

class _BoiteEtiquette extends CustomPainter {
  const _BoiteEtiquette(
      {required this.fond, required this.bord, required this.tirete});

  final Color fond;
  final Color bord;
  final bool tirete;

  @override
  void paint(Canvas canvas, Size size) {
    final rect =
        RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(4));
    canvas.drawRRect(rect, Paint()..color = fond);
    final trait = Paint()
      ..color = bord
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    if (!tirete) {
      canvas.drawRRect(rect.deflate(0.5), trait);
      return;
    }
    final chemin = Path()..addRRect(rect.deflate(0.5));
    for (final mesure in chemin.computeMetrics()) {
      var d = 0.0;
      while (d < mesure.length) {
        canvas.drawPath(mesure.extractPath(d, d + 3), trait);
        d += 6;
      }
    }
  }

  @override
  bool shouldRepaint(_BoiteEtiquette old) =>
      old.fond != fond || old.bord != bord || old.tirete != tirete;
}

class _Pointe extends CustomPainter {
  const _Pointe(this.couleur);

  final Color couleur;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawPath(
      Path()
        ..moveTo(0, 0)
        ..lineTo(size.width, 0)
        ..lineTo(size.width / 2, size.height)
        ..close(),
      Paint()..color = couleur,
    );
  }

  @override
  bool shouldRepaint(_Pointe old) => old.couleur != couleur;
}

class _FondUni extends StatefulWidget {
  const _FondUni(
      {required this.initiale, required this.surCamera, required this.surPret});

  final RadarCamera initiale;
  final ValueChanged<RadarCamera> surCamera;
  final ValueChanged<RadarFondCommandes> surPret;

  @override
  State<_FondUni> createState() => _FondUniState();
}

class _FondUniState extends State<_FondUni> implements RadarFondCommandes {
  late RadarCamera _camera = widget.initiale;

  @override
  void initState() {
    super.initState();
    widget.surPret(this);
  }

  @override
  void zoomer(double delta) {
    _camera = RadarCamera(_camera.lat, _camera.lon,
        (_camera.zoom + delta).clamp(3, 18).toDouble());
    widget.surCamera(_camera);
  }

  @override
  void allerA(RadarCamera camera) => _camera = camera;

  @override
  Widget build(BuildContext context) => const SizedBox.expand();
}

class _FondMapLibre extends StatefulWidget {
  const _FondMapLibre(
      {required this.initiale, required this.surCamera, required this.surPret});

  final RadarCamera initiale;
  final ValueChanged<RadarCamera> surCamera;
  final ValueChanged<RadarFondCommandes> surPret;

  @override
  State<_FondMapLibre> createState() => _FondMapLibreState();
}

class _FondMapLibreState extends State<_FondMapLibre>
    implements RadarFondCommandes {
  MapLibreMapController? _controller;

  @override
  void zoomer(double delta) {
    _controller?.animateCamera(
        delta > 0 ? CameraUpdate.zoomIn() : CameraUpdate.zoomOut());
  }

  @override
  void allerA(RadarCamera camera) {
    _controller?.moveCamera(CameraUpdate.newCameraPosition(CameraPosition(
      target: LatLng(camera.lat, camera.lon),
      zoom: camera.zoom,
    )));
  }

  void _suivre() {
    final position = _controller?.cameraPosition;
    if (position == null) return;
    widget.surCamera(RadarCamera(
        position.target.latitude, position.target.longitude, position.zoom));
  }

  @override
  void dispose() {
    _controller?.removeListener(_suivre);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MapLibreMap(
      styleString: '${KojiWebApiConfig.baseUrl}/carte/radar-style.json',
      initialCameraPosition: CameraPosition(
        target: LatLng(widget.initiale.lat, widget.initiale.lon),
        zoom: widget.initiale.zoom,
      ),
      trackCameraPosition: true,
      rotateGesturesEnabled: false,
      tiltGesturesEnabled: false,
      compassEnabled: false,
      // Crédits OpenStreetMap obligatoires : bouton « i » en haut à droite,
      // loin de la légende et du zoom.
      attributionButtonPosition: AttributionButtonPosition.topRight,
      attributionButtonMargins: const math.Point(8, 8),
      logoEnabled: false,
      minMaxZoomPreference: const MinMaxZoomPreference(3, 18),
      onMapCreated: (controller) {
        _controller = controller..addListener(_suivre);
        widget.surPret(this);
      },
    );
  }
}
