import 'dart:convert';

import 'package:http/http.dart' as http;

/// Résultat d'une importation de fourniture depuis une URL produit.
class SupplyImportResult {
  final String sourceUrl;
  final String name;
  final String category;
  final String? imageUrl;
  final String? supplierName;
  final double priceHt;
  final String? unite;
  final String? conditionnement;
  final double? quantite;

  const SupplyImportResult({
    required this.sourceUrl,
    required this.name,
    required this.category,
    this.imageUrl,
    this.supplierName,
    this.priceHt = 0,
    this.unite,
    this.conditionnement,
    this.quantite,
  });
}

const List<List<String>> _kSupplierHosts = [
  ['leroymerlin', 'Leroy Merlin'],
  ['castorama', 'Castorama'],
  ['bricodepot', 'Brico Depot'],
  ['manomano', 'ManoMano'],
  ['pointp', 'Point.P'],
  ['chausson', 'Chausson Materiaux'],
  ['gedimat', 'Gedimat'],
  ['lapeyre', 'Lapeyre'],
  ['cegedim', 'Cegedim'],
];

/// Récupère et analyse une page produit pour préremplir le formulaire
/// "Ajouter via un lien" de fournitures.
///
/// Port Dart de web-app-Koji-main/lib/supply-import.js — mêmes heuristiques
/// (balises meta og:*/product:*, JSON-LD Product, repli sur le slug de l'URL)
/// pour rester cohérent avec ce que le site web extrait des mêmes liens.
class SupplyImportService {
  Future<SupplyImportResult> importFromUrl(String url) async {
    final sourceUrl = url.trim();
    late final Uri parsedUrl;
    try {
      parsedUrl = Uri.parse(sourceUrl);
      if (!parsedUrl.isScheme('HTTP') && !parsedUrl.isScheme('HTTPS')) {
        throw const FormatException('scheme non supporté');
      }
    } catch (_) {
      return SupplyImportResult(
        sourceUrl: sourceUrl,
        name: '',
        category: 'Divers',
      );
    }

    final slugTitle = _titleFromSlug(parsedUrl);
    final supplierName = _supplierFromHost(parsedUrl.host);

    try {
      final response = await http.get(
        parsedUrl,
        headers: {
          'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
          'accept':
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'fr-FR,fr;q=0.9,en;q=0.7',
        },
      ).timeout(const Duration(seconds: 12));

      final html = utf8.decode(response.bodyBytes, allowMalformed: true);
      final product = _firstJsonProduct(html);
      final offer = _offerFromProduct(product);

      final rawTitle = (product?['name'] as String?) ??
          _metaContent(html, 'og:title') ??
          _metaContent(html, 'twitter:title') ??
          _htmlTitle(html) ??
          slugTitle;
      final title = _cleanTitle(rawTitle, slugTitle);
      final description = (product?['description'] as String?) ??
          _metaContent(html, 'og:description') ??
          _metaContent(html, 'description') ??
          '';
      final image = _imageFromProduct(product) ?? _metaContent(html, 'og:image');
      final brand = _brandFromProduct(product);

      final regularPrice = _numberFromText(
          _metaContent(html, 'product:price:amount') ??
              _metaContent(html, 'og:price:amount'));
      final salePrice =
          _numberFromText(_metaContent(html, 'product:sale_price:amount'));
      final offerPrice = _priceFromObject(offer);
      final htmlPrice = _priceFromHtml(html);
      final price = salePrice != 0
          ? salePrice
          : (offerPrice != 0
              ? offerPrice
              : (regularPrice != 0 ? regularPrice : htmlPrice));

      final packaging = _extractPackaging('$title $description');

      return SupplyImportResult(
        sourceUrl: sourceUrl,
        name: title.isNotEmpty ? title : slugTitle,
        category: _detectCategory('$title $description ${parsedUrl.path}'),
        imageUrl: (image != null && image.isNotEmpty) ? image : null,
        supplierName: (supplierName.isNotEmpty ? supplierName : brand) ?? '',
        priceHt: price,
        unite: packaging['unit'],
        conditionnement: packaging['packaging'],
        quantite: packaging['quantity'] != null
            ? double.tryParse(packaging['quantity']!)
            : null,
      );
    } catch (_) {
      final packaging = _extractPackaging(slugTitle);
      return SupplyImportResult(
        sourceUrl: sourceUrl,
        name: slugTitle,
        category: _detectCategory('$slugTitle ${parsedUrl.path}'),
        supplierName: supplierName,
        unite: packaging['unit'],
        conditionnement: packaging['packaging'],
        quantite: packaging['quantity'] != null
            ? double.tryParse(packaging['quantity']!)
            : null,
      );
    }
  }

  // ─── HTML helpers ──────────────────────────

  String _decodeHtml(String value) {
    return value
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replaceAllMapped(RegExp("&#39;|&apos;"), (_) => "'")
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&nbsp;', ' ')
        .replaceAllMapped(
            RegExp(r'&#(\d+);'), (m) => String.fromCharCode(int.parse(m[1]!)))
        .replaceAllMapped(RegExp(r'&#x([0-9a-fA-F]+);'),
            (m) => String.fromCharCode(int.parse(m[1]!, radix: 16)))
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  String _stripTags(String value) =>
      _decodeHtml(value.replaceAll(RegExp('<[^>]*>'), ' '));

  String? _metaContent(String html, String name) {
    final escaped = RegExp.escape(name);
    final patterns = [
      RegExp(
          '<meta[^>]+(?:property|name)=["\']$escaped["\'][^>]+content=["\']([^"\']+)["\'][^>]*>',
          caseSensitive: false),
      RegExp(
          '<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']$escaped["\'][^>]*>',
          caseSensitive: false),
    ];
    for (final p in patterns) {
      final m = p.firstMatch(html);
      if (m?.group(1) != null) return _decodeHtml(m!.group(1)!);
    }
    return null;
  }

  String? _htmlTitle(String html) {
    final m =
        RegExp('<title[^>]*>([\\s\\S]*?)</title>', caseSensitive: false)
            .firstMatch(html);
    return m != null ? _stripTags(m.group(1) ?? '') : null;
  }

  List<String> _scriptContents(String html, bool Function(String attrs) predicate) {
    final results = <String>[];
    final pattern =
        RegExp(r'<script\b([^>]*)>([\s\S]*?)</script>', caseSensitive: false);
    for (final m in pattern.allMatches(html)) {
      final attrs = m.group(1) ?? '';
      if (predicate(attrs)) results.add((m.group(2) ?? '').trim());
    }
    return results;
  }

  Map<String, dynamic>? _safeJsonParse(String value) {
    try {
      final decoded = json.decode(_decodeHtml(value));
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      try {
        final decoded = json.decode(value);
        return decoded is Map<String, dynamic> ? decoded : null;
      } catch (_) {
        return null;
      }
    }
  }

  bool _typeIncludes(dynamic type, String expected) {
    final value = type is List ? type.join(' ') : (type?.toString() ?? '');
    return value.toLowerCase().contains(expected);
  }

  Map<String, dynamic>? _walk(
      dynamic value, Map<String, dynamic>? Function(dynamic) visitor,
      [int depth = 0]) {
    if (value == null || depth > 9) return null;
    final result = visitor(value);
    if (result != null) return result;
    if (value is List) {
      for (final item in value) {
        final found = _walk(item, visitor, depth + 1);
        if (found != null) return found;
      }
      return null;
    }
    if (value is Map) {
      for (final item in value.values) {
        final found = _walk(item, visitor, depth + 1);
        if (found != null) return found;
      }
    }
    return null;
  }

  Map<String, dynamic>? _productFromJson(dynamic value) {
    return _walk(value, (item) {
      if (item is Map<String, dynamic> && _typeIncludes(item['@type'], 'product')) {
        return item;
      }
      return null;
    });
  }

  Map<String, dynamic>? _firstJsonProduct(String html) {
    final ldScripts = _scriptContents(
        html, (attrs) => RegExp('application/ld\\+json', caseSensitive: false).hasMatch(attrs));
    for (final content in ldScripts) {
      final parsed = _safeJsonParse(content);
      if (parsed == null) continue;
      final product = _productFromJson(parsed);
      if (product != null) return product;
    }

    final nextScripts = _scriptContents(
        html,
        (attrs) => RegExp(r'__NEXT_DATA__|application/json', caseSensitive: false)
            .hasMatch(attrs));
    for (final content in nextScripts) {
      final parsed = _safeJsonParse(content);
      if (parsed == null) continue;
      final product = _productFromJson(parsed);
      if (product != null) return product;
    }
    return null;
  }

  dynamic _offerFromProduct(Map<String, dynamic>? product) {
    if (product == null) return null;
    final offers = product['offers'];
    if (offers is List) return offers.isNotEmpty ? offers.first : null;
    if (offers != null) return offers;
    return _walk(product, (item) {
      if (item is Map &&
          (item['price'] != null ||
              item['priceSpecification'] != null ||
              item['lowPrice'] != null)) {
        return item.cast<String, dynamic>();
      }
      return null;
    });
  }

  double _numberFromText(String? value) {
    if (value == null || value.isEmpty) return 0;
    final normalized =
        value.replaceAll(' ', ' ').replaceAll(RegExp(r'\s'), '').replaceAll(',', '.');
    final m = RegExp(r'\d+(?:\.\d+)?').firstMatch(normalized);
    return m != null ? double.parse(m.group(0)!) : 0;
  }

  double _priceFromObject(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    if (value is String) return _numberFromText(value);
    if (value is List) {
      for (final item in value) {
        final price = _priceFromObject(item);
        if (price != 0) return price;
      }
      return 0;
    }
    if (value is Map) {
      for (final key in [
        'price',
        'salePrice',
        'currentPrice',
        'unitPrice',
        'lowPrice',
        'amount',
        'value'
      ]) {
        if (value.containsKey(key)) {
          final price = _priceFromObject(value[key]);
          if (price != 0) return price;
        }
      }
      if (value['priceSpecification'] != null) {
        return _priceFromObject(value['priceSpecification']);
      }
    }
    return 0;
  }

  double _priceFromHtml(String html) {
    final metas = [
      _metaContent(html, 'product:sale_price:amount'),
      _metaContent(html, 'product:price:amount'),
      _metaContent(html, 'og:price:amount'),
    ];
    for (final meta in metas) {
      final price = _numberFromText(meta);
      if (price != 0) return price;
    }

    final euroMatch = RegExp(
            r'(?:price|prix|amount|value)["' r"'" r'\s:=]+["' r"'" r']?(\d{1,5}(?:[,.]\d{1,2})?)["' r"'" r']?\s*(?:EUR|€)',
            caseSensitive: false)
        .firstMatch(html) ??
        RegExp(r'(\d{1,5}(?:[,.]\d{2}))\s*€', caseSensitive: false).firstMatch(html);
    return euroMatch != null ? _numberFromText(euroMatch.group(1)) : 0;
  }

  String _supplierFromHost(String hostname) {
    final host = hostname.toLowerCase().replaceFirst(RegExp(r'^www\.'), '');
    for (final entry in _kSupplierHosts) {
      if (host.contains(entry[0])) return entry[1];
    }
    final base = host.split('.').first.replaceAll(RegExp(r'[-_]+'), ' ');
    return base.split(' ').map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1)).join(' ');
  }

  String _titleFromSlug(Uri parsedUrl) {
    final parts = parsedUrl.pathSegments.where((p) => p.isNotEmpty).toList();
    final slug = parts.reversed.firstWhere(
      (p) => p.contains('-') || p.contains('_'),
      orElse: () => parts.isNotEmpty ? parts.last : parsedUrl.host,
    );
    var cleaned = Uri.decodeComponent(slug)
        .replaceAll(RegExp(r'\.html?$', caseSensitive: false), '')
        .replaceAll(RegExp(r'-?\d{6,}$', caseSensitive: false), '')
        .replaceAll(RegExp(r'[-_]+'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();

    return cleaned
        .split(' ')
        .where((w) => w.isNotEmpty)
        .map((word) {
          if (RegExp(r'^v?\d+[a-zA-Z]*$').hasMatch(word) ||
              RegExp(r'^\d+[a-zA-Z]+$').hasMatch(word)) {
            return word.toUpperCase();
          }
          if (['m2', 'mm', 'cm', 'l', 'kg', 'ml', 'ht', 'ttc'].contains(word.toLowerCase())) {
            return word.toUpperCase();
          }
          return word[0].toUpperCase() + word.substring(1).toLowerCase();
        })
        .join(' ');
  }

  String _detectCategory(String text) {
    final value = text.toLowerCase();
    if (RegExp('peinture|acrylique|velours|mat|satin|boiserie|enduit').hasMatch(value)) {
      return 'Peinture';
    }
    if (RegExp('carrelage|faience|faïence|joint|colle carrelage|mortier').hasMatch(value)) {
      return 'Sol';
    }
    if (RegExp('isolation|laine de verre|laine de roche|isolant').hasMatch(value)) {
      return 'Materiaux';
    }
    if (RegExp('robinet|plomberie|siphon|tuyau|raccord').hasMatch(value)) {
      return 'Materiaux';
    }
    if (RegExp('vis|cheville|outil|accessoire|cartouche|silicone').hasMatch(value)) {
      return 'Accessoires';
    }
    return 'Divers';
  }

  static final _packagingSizePatterns = [
    (RegExp(r'(\d+(?:[.,]\d+)?)\s*m(?:2|²)\b', caseSensitive: false), 'm2', 'm2'),
    (RegExp(r'(\d+(?:[.,]\d+)?)\s*ml\b', caseSensitive: false), 'ml', 'ml'),
    (RegExp(r'(\d+(?:[.,]\d+)?)\s*(?:kgs?|kilos?|kilogrammes?)\b', caseSensitive: false), 'kg', 'kg'),
    (RegExp(r'(\d+(?:[.,]\d+)?)\s*(?:l|litres?)\b', caseSensitive: false), 'L', 'L'),
  ];

  static final _packagingQuantityPatterns = [
    RegExp(r'\b(?:lot|pack|set)s?\s+de\s+(\d+)\b', caseSensitive: false),
    RegExp(r'\bx\s?(\d+)\b', caseSensitive: false),
    RegExp(r'\b(\d+)\s*(?:pieces?|pi[eè]ces?|unites?|unit[eé]s?|pcs)\b', caseSensitive: false),
  ];

  Map<String, String?> _extractPackaging(String text) {
    String? unit;
    String? packaging;
    String? quantity;

    for (final (regex, u, label) in _packagingSizePatterns) {
      final m = regex.firstMatch(text);
      if (m != null) {
        unit = u;
        packaging = '${m.group(1)!.replaceAll(',', '.')} $label';
        break;
      }
    }
    for (final regex in _packagingQuantityPatterns) {
      final m = regex.firstMatch(text);
      if (m != null) {
        quantity = m.group(1);
        break;
      }
    }
    return {'unit': unit, 'packaging': packaging, 'quantity': quantity};
  }

  String _cleanTitle(String value, String fallback) {
    final title = _stripTags(value)
        .replaceAll(
            RegExp(
                r'\s*[-|]\s*(Leroy Merlin|Castorama|Brico Depot|ManoMano|Point\.?P|Chausson|Gedimat|Lapeyre).*$',
                caseSensitive: false),
            '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final domainLike = RegExp(r'^(?:www\.)?[\w-]+(?:\.[a-z]{2,})+$', caseSensitive: false).hasMatch(title);
    final blockedLike = RegExp(
            'access denied|just a moment|attention required|captcha|forbidden|blocked|robot|veuillez patienter',
            caseSensitive: false)
        .hasMatch(title);
    final supplierOnly = RegExp(
            r'^(leroy\s*merlin|castorama|brico\s*depot|bricodepot|manomano|point\.?p|chausson|gedimat|lapeyre)$',
            caseSensitive: false)
        .hasMatch(title);
    if (title.isEmpty ||
        RegExp(r'^https?:', caseSensitive: false).hasMatch(title) ||
        domainLike ||
        blockedLike ||
        supplierOnly) {
      return fallback;
    }
    return title;
  }

  String? _imageFromProduct(Map<String, dynamic>? product) {
    final image = product?['image'];
    if (image is List) return image.isNotEmpty ? image.first?.toString() : null;
    return image?.toString();
  }

  String? _brandFromProduct(Map<String, dynamic>? product) {
    final brand = product?['brand'];
    if (brand is String) return brand;
    if (brand is Map) return brand['name']?.toString();
    return null;
  }
}
