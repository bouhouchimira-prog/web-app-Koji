import 'dart:convert';

import 'package:http/http.dart' as http;

/// A geocoded chantier address — mirrors what koji-web's
/// geocodeAddressText()/RadarAddressAutocomplete produce from the BAN
/// (Base Adresse Nationale) API: ville/code postal/lat/lon are needed for
/// geographic matching with entreprises (see app/api/chantier-offres).
class MarketplaceAddress {
  const MarketplaceAddress({
    required this.address,
    this.city = '',
    this.postalCode = '',
    this.lat,
    this.lon,
  });

  final String address;
  final String city;
  final String postalCode;
  final double? lat;
  final double? lon;

  bool get isEmpty => address.trim().isEmpty;
}

/// Public, unauthenticated API (api-adresse.data.gouv.fr) — not koji-web, so
/// this is a plain http call, not via KojiWebApiClient. Same fallback as the
/// web app: on any failure, or no match, the typed text alone is kept.
Future<MarketplaceAddress> geocodeFrenchAddress(String text) async {
  final query = text.trim();
  final fallback = MarketplaceAddress(address: text);
  if (query.isEmpty) return fallback;
  try {
    final res = await http.get(Uri.parse(
      'https://api-adresse.data.gouv.fr/search/?q=${Uri.encodeQueryComponent(query)}&limit=1',
    ));
    if (res.statusCode >= 400) return fallback;
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final features = data['features'] as List? ?? const [];
    if (features.isEmpty) return fallback;
    final feature = features.first as Map<String, dynamic>;
    final geometry = feature['geometry'] as Map<String, dynamic>;
    final coords = geometry['coordinates'] as List;
    final properties = feature['properties'] as Map<String, dynamic>;
    return MarketplaceAddress(
      address: (properties['label'] as String?) ?? text,
      city: (properties['city'] as String?) ?? '',
      postalCode: (properties['postcode'] as String?) ?? '',
      lon: (coords[0] as num).toDouble(),
      lat: (coords[1] as num).toDouble(),
    );
  } catch (_) {
    return fallback;
  }
}
