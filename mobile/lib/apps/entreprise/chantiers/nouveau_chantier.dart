import 'dart:convert';

import 'package:http/http.dart' as http;

/// Nouveau chantier (retours du build 64, sprint 2) : ce que l'écran vérifie
/// et envoie, sans interface. Le chantier part sur l'API du site
/// (POST /api/projects), qui range aussi le client dans le carnet de contacts.

const typesDeBien = ['Appartement', 'Maison', 'Local', 'Autre'];

/// Une adresse proposée pendant la saisie.
class AdresseSuggeree {
  const AdresseSuggeree({
    required this.libelle,
    required this.rue,
    required this.codePostal,
    required this.ville,
  });

  /// « 12 Rue de Paris 93100 Montreuil ».
  final String libelle;
  final String rue;
  final String codePostal;
  final String ville;
}

typedef SuggererAdresses = Future<List<AdresseSuggeree>> Function(String saisie);

/// Lit la réponse de la Base Adresse Nationale (api-adresse.data.gouv.fr),
/// le même service que les formulaires d'adresse du site.
List<AdresseSuggeree> adressesBan(dynamic json) {
  final features = json is Map ? json['features'] : null;
  if (features is! List) return const [];
  String s(dynamic v) => v == null ? '' : '$v'.trim();
  final vues = <String>{};
  final sortie = <AdresseSuggeree>[];
  for (final f in features) {
    final p = f is Map ? f['properties'] : null;
    if (p is! Map) continue;
    final libelle = s(p['label']);
    if (libelle.isEmpty || !vues.add(libelle)) continue;
    sortie.add(AdresseSuggeree(
      libelle: libelle,
      rue: s(p['name']),
      codePostal: s(p['postcode']),
      ville: s(p['city']),
    ));
  }
  return sortie;
}

/// Propositions pour une saisie d'au moins trois caractères. Une recherche
/// qui échoue ne bloque pas le formulaire : l'adresse se tape à la main.
Future<List<AdresseSuggeree>> suggererAdressesBan(String saisie,
    {http.Client? client}) async {
  final q = saisie.trim();
  if (q.length < 3) return const [];
  try {
    final reponse = await (client ?? http.Client())
        .get(Uri.parse('https://api-adresse.data.gouv.fr/search/'
            '?q=${Uri.encodeQueryComponent(q)}&limit=5'))
        .timeout(const Duration(seconds: 8));
    if (reponse.statusCode != 200) return const [];
    return adressesBan(jsonDecode(utf8.decode(reponse.bodyBytes)));
  } catch (_) {
    return const [];
  }
}

final _email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

/// Erreurs à montrer sous chaque champ (champ → message). Vide = tout va bien.
Map<String, String> erreursNouveauChantier({
  required String reference,
  String email = '',
  String telephone = '',
}) {
  final e = <String, String>{};
  if (reference.trim().isEmpty) {
    e['reference'] = 'Donnez un nom à ce chantier.';
  }
  if (email.trim().isNotEmpty && !_email.hasMatch(email.trim())) {
    e['email'] = "Cette adresse e-mail n'est pas valide.";
  }
  final chiffres = telephone.replaceAll(RegExp(r'\D'), '');
  if (telephone.trim().isNotEmpty && chiffres.length < 9) {
    e['telephone'] = 'Ce numéro est trop court.';
  }
  return e;
}

/// Ce que POST /api/projects reçoit.
Map<String, dynamic> corpsNouveauChantier({
  required String reference,
  String rue = '',
  String codePostal = '',
  String ville = '',
  String typeDeBien = '',
  String clientNom = '',
  String clientTelephone = '',
  String clientEmail = '',
}) =>
    {
      'title': reference.trim(),
      'address': rue.trim(),
      'postalCode': codePostal.trim(),
      'city': ville.trim(),
      'propertyType': typeDeBien.trim(),
      'clientName': clientNom.trim(),
      'clientPhone': clientTelephone.trim(),
      'clientEmail': clientEmail.trim().toLowerCase(),
    };
