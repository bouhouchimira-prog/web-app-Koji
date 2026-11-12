import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

/// Les images de référence (test/goldens) sont produites sur Windows, où
/// l'app est développée. Le rendu du texte diffère d'un système à l'autre
/// (lissage des polices) : sur la CI Linux, les tests tournent en entier
/// — mise en page, textes, gestes — mais sans comparer les pixels.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  if (!Platform.isWindows && !autoUpdateGoldenFiles) {
    goldenFileComparator = _SansComparaison();
  }
  await testMain();
}

class _SansComparaison extends GoldenFileComparator {
  @override
  Future<bool> compare(Uint8List imageBytes, Uri golden) async => true;

  @override
  Future<void> update(Uri golden, Uint8List imageBytes) async {}
}
