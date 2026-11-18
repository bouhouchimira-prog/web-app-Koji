import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import 'package:koji/design/koji_client_charte.dart';

// Cadre de signature de Koji Client (`.cl-sig`, maquettes CLI-02 et CLI-07) :
// la signature se trace au doigt, puis part au site en PNG (data URL), comme
// le canevas de la page web (components/SignatureDevisClient.jsx).

/// Les traits tracés, et leur conversion en PNG.
class ClSignatureControleur extends ChangeNotifier {
  final List<List<Offset>> _traits = [];
  Size _taille = Size.zero;

  List<List<Offset>> get traits => List.unmodifiable(_traits);
  bool get vide => _traits.isEmpty;

  void _commencer(Offset p, Size taille) {
    _taille = taille;
    _traits.add([p]);
    notifyListeners();
  }

  void _continuer(Offset p) {
    if (_traits.isEmpty) return;
    _traits.last.add(p);
    notifyListeners();
  }

  void effacer() {
    _traits.clear();
    notifyListeners();
  }

  /// Trace [traits] sur [canvas] : marine, 2,2 px, bouts arrondis ; un
  /// simple appui fait un point.
  static void dessiner(Canvas canvas, List<List<Offset>> traits) {
    final trait = Paint()
      ..color = ClCharte.marine
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final point = Paint()..color = ClCharte.marine;
    for (final t in traits) {
      if (t.length == 1) {
        canvas.drawCircle(t.first, 1.1, point);
        continue;
      }
      final chemin = Path()..moveTo(t.first.dx, t.first.dy);
      for (final p in t.skip(1)) {
        chemin.lineTo(p.dx, p.dy);
      }
      canvas.drawPath(chemin, trait);
    }
  }

  /// La signature en PNG transparent, « data:image/png;base64,… », à la
  /// taille du cadre (x [echelle]). Vide : chaîne vide.
  Future<String> enPng({double echelle = 2}) async {
    if (vide || _taille.isEmpty) return '';
    final enregistreur = ui.PictureRecorder();
    final canvas = Canvas(enregistreur)..scale(echelle);
    dessiner(canvas, _traits);
    final image = await enregistreur.endRecording().toImage(
        (_taille.width * echelle).ceil(), (_taille.height * echelle).ceil());
    final donnees = await image.toByteData(format: ui.ImageByteFormat.png);
    image.dispose();
    if (donnees == null) return '';
    final texte =
        'data:image/png;base64,${base64Encode(donnees.buffer.asUint8List())}';
    // Le site refuse au-delà de 400 000 caractères : on réduit alors.
    if (texte.length > 400000 && echelle > 1) return enPng(echelle: 1);
    return texte;
  }
}

/// Le cadre : blanc, trait pointillé marine, libellé gris tant qu'il est
/// vide, « Effacer » ensuite. Le doigt qui trace ne fait pas défiler la page.
class ClPaveSignature extends StatelessWidget {
  const ClPaveSignature({
    super.key,
    required this.controleur,
    this.libelle = 'Votre signature',
    this.hauteur = 88,
  });

  final ClSignatureControleur controleur;
  final String libelle;
  final double hauteur;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: controleur,
      builder: (context, _) => SizedBox(
        height: hauteur,
        child: LayoutBuilder(builder: (context, c) {
          final taille = Size(c.maxWidth, hauteur);
          Offset dedans(Offset p) => Offset(p.dx.clamp(0, taille.width),
              p.dy.clamp(0, taille.height));
          return Stack(
            children: [
              Positioned.fill(
                child: Semantics(
                  label: libelle,
                  image: true,
                  child: RawGestureDetector(
                    // Gagne tout de suite l'arène : la liste ne défile pas
                    // sous le doigt qui signe.
                    gestures: {
                      EagerGestureRecognizer:
                          GestureRecognizerFactoryWithHandlers<
                                  EagerGestureRecognizer>(
                              EagerGestureRecognizer.new, (_) {}),
                    },
                    child: Listener(
                      behavior: HitTestBehavior.opaque,
                      onPointerDown: (e) =>
                          controleur._commencer(dedans(e.localPosition), taille),
                      onPointerMove: (e) =>
                          controleur._continuer(dedans(e.localPosition)),
                      child: CustomPaint(
                        painter: _Cadre(controleur.traits),
                      ),
                    ),
                  ),
                ),
              ),
              if (controleur.vide)
                Positioned(
                  left: 8,
                  bottom: 8,
                  child: IgnorePointer(
                    child: Text(libelle,
                        style: ClCharte.texte(12, couleur: ClCharte.gris)),
                  ),
                )
              else
                Positioned(
                  right: 4,
                  top: 4,
                  child: Semantics(
                    button: true,
                    child: GestureDetector(
                      onTap: controleur.effacer,
                      behavior: HitTestBehavior.opaque,
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Text(
                          'Effacer',
                          style: ClCharte.texte(12).copyWith(
                            decoration: TextDecoration.underline,
                            decorationColor: ClCharte.marine,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          );
        }),
      ),
    );
  }
}

/// Fond blanc, pointillés marine (`border:1px dashed`), puis les traits.
class _Cadre extends CustomPainter {
  _Cadre(this.traits);

  final List<List<Offset>> traits;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(Offset.zero & size, Paint()..color = ClCharte.blanc);
    final pointille = Paint()
      ..color = ClCharte.marine
      ..strokeWidth = 1;
    void ligne(Offset a, Offset b) {
      final longueur = (b - a).distance;
      final dir = (b - a) / longueur;
      for (double d = 0; d < longueur; d += 6) {
        final fin = d + 3 > longueur ? longueur : d + 3;
        canvas.drawLine(a + dir * d, a + dir * fin, pointille);
      }
    }

    final r = (Offset.zero & size).deflate(0.5);
    ligne(r.topLeft, r.topRight);
    ligne(r.topRight, r.bottomRight);
    ligne(r.bottomRight, r.bottomLeft);
    ligne(r.bottomLeft, r.topLeft);
    canvas.save();
    canvas.clipRect(Offset.zero & size);
    ClSignatureControleur.dessiner(canvas, traits);
    canvas.restore();
  }

  @override
  bool shouldRepaint(_Cadre old) => true;
}
