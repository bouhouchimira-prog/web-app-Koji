import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:pdf/widgets.dart' as pw;

import 'package:koji/features/quote/services/devis_pdf_service.dart';

// KPRO-49 : dans le PDF du devis fait dans l'app, les signatures ne partent
// jamais seules sur une page : elles restent avec les conditions de paiement.
// Polices standard et PDF non compressé : le texte de chaque page se lit
// directement dans le fichier.
final _polices = (
  regular: pw.Font.helvetica(),
  bold: pw.Font.helveticaBold(),
  italic: pw.Font.helveticaOblique(),
  boldItalic: pw.Font.helveticaBoldOblique(),
);

Map<String, dynamic> _devis(int n) => {
      'quoteNumber': '2026-0001',
      'date': '27/11/2026',
      'company': {'name': 'Entreprise Test', 'address': '1 rue de Paris'},
      'client': {'name': 'Mme Test', 'address': '2 rue de Lyon'},
      'totals': {'totalHT': 100.0 * n, 'tva': 20.0 * n, 'totalTTC': 120.0 * n},
      'expenses': {
        'Salle de bain': [
          for (var i = 0; i < n; i++)
            {
              'name': 'Ouvrage numero ${i + 1}, pose comprise',
              'quantity': 1,
              'unit': 'u',
              'laborCost': 100,
            }
        ]
      },
    };

/// Pour chaque page du PDF, son texte brut (flux de contenu non compressés).
Future<List<String>> _pages(int n) async {
  final doc = await DevisPdfService()
      .generate(quoteData: _devis(n), polices: _polices, compresser: false);
  final brut = latin1.decode(await doc.save(), allowInvalid: true);
  // Le texte est écrit mot par mot : [(Signature)]TJ [(du)]TJ …
  return brut.split('endstream').where((s) => s.contains(')]TJ')).toList();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('de 1 à 60 lignes, la page des signatures porte aussi les conditions de paiement', () async {
    final seules = <int>[];
    for (var n = 1; n <= 60; n++) {
      final pages = await _pages(n);
      // « Mention manuscrite obligatoire » n'est que dans le bloc des
      // signatures ; « Informations de paiement » ouvre les conditions.
      final page = pages.firstWhere((p) => p.contains('[(manuscrite)]TJ'), orElse: () => '');
      expect(page, isNotEmpty, reason: 'signatures introuvables pour $n lignes');
      if (!page.contains('[(Informations)]TJ')) seules.add(n);
    }
    expect(seules, isEmpty, reason: 'signatures seules pour $seules lignes');
  });
}
