import 'package:intl/intl.dart';

/// Liste des devis (maquette PRO-03), mêmes règles que le site
/// (lib/devis-liste.js), testées sur les mêmes exemples : « À relancer »
/// après 7 jours sans réponse, « Expiré » à la fin de la validité (30 jours
/// par défaut), action de la ligne, onglets et badge.

const relanceJours = 7;
const validiteJours = 30;

/// Onglets du téléphone (maquette : sans « Expirés, refusés »).
const ongletsDevisTelephone = [
  ('tous', 'Tous'),
  ('brouillon', 'Brouillons'),
  ('envoye', 'Envoyés'),
  ('signe', 'Signés'),
];

String _s(dynamic v) => v == null ? '' : '$v';
String _j(dynamic v) {
  final t = _s(v);
  return t.length >= 10 ? t.substring(0, 10) : t;
}

String _plus(String jour, int n) {
  final d = DateTime.tryParse(jour);
  return d == null
      ? ''
      : DateFormat('yyyy-MM-dd')
          .format(DateTime.utc(d.year, d.month, d.day).add(Duration(days: n)));
}

String _court(String jour) {
  final d = DateTime.tryParse(_j(jour));
  return d == null ? '' : DateFormat('d MMM', 'fr_FR').format(d);
}

bool _signe(Map q) => q['status'] == 'Signe' || q['signatureStatus'] == 'Signe';
bool _envoye(Map q) => q['status'] == 'Envoye' && !_signe(q);

String finValidite(Map q) {
  final depart = _j(_s(q['sentAt']).isNotEmpty
      ? q['sentAt']
      : _s(q['quoteDate']).isNotEmpty
          ? q['quoteDate']
          : q['createdAt']);
  final jours = q['validityDays'] is num && (q['validityDays'] as num) > 0
      ? (q['validityDays'] as num).toInt()
      : validiteJours;
  return depart.isEmpty ? '' : _plus(depart, jours);
}

bool estExpire(Map q, String aujourdhui) {
  final fin = finValidite(q);
  return _envoye(q) && fin.isNotEmpty && fin.compareTo(aujourdhui) < 0;
}

List<String> _relances(Map q) =>
    ((q['relances'] as List?) ?? const []).map((r) => _j((r as Map)['le'])).toList()..sort();

bool aRelancer(Map q, String aujourdhui) {
  if (!_envoye(q) || estExpire(q, aujourdhui) || _s(q['sentAt']).isEmpty) return false;
  final r = _relances(q);
  final derniere = r.isEmpty ? _j(q['sentAt']) : r.last;
  return _plus(derniere, relanceJours).compareTo(aujourdhui) <= 0;
}

String ongletDevis(Map q, String aujourdhui) {
  if (_signe(q)) return 'signe';
  if (q['status'] == 'Refuse' || q['status'] == 'Annule') return 'termine';
  if (_envoye(q)) return estExpire(q, aujourdhui) ? 'termine' : 'envoye';
  return 'brouillon';
}

typedef StatutDevis = ({String id, String label, String ton});

StatutDevis statutDevis(Map q, String aujourdhui) {
  if (_signe(q)) return (id: 'signe', label: 'Signé', ton: 'sceau');
  if (q['status'] == 'Refuse') return (id: 'refuse', label: 'Refusé', ton: 'gris');
  if (q['status'] == 'Annule') return (id: 'annule', label: 'Annulé', ton: 'gris');
  if (_envoye(q)) {
    if (estExpire(q, aujourdhui)) return (id: 'expire', label: 'Expiré', ton: 'gris');
    if (aRelancer(q, aujourdhui)) return (id: 'relancer', label: 'À relancer', ton: 'contour');
    return (id: 'envoye', label: 'Envoyé', ton: 'graphite');
  }
  if (q['status'] == 'Pret a envoyer') return (id: 'pret', label: 'Prêt à envoyer', ton: 'contour');
  return (id: 'brouillon', label: 'Brouillon', ton: 'contour');
}

String derniereAction(Map q, String aujourdhui, {bool chantierEnCours = false}) {
  final s = statutDevis(q, aujourdhui);
  switch (s.id) {
    case 'signe':
      return [
        _s(q['signedAt']).isNotEmpty ? 'Signé le ${_court(_s(q['signedAt']))}' : 'Signé',
        if (chantierEnCours) 'chantier en cours',
      ].join(' · ');
    case 'refuse':
      return _s(q['refusedAt']).isNotEmpty ? 'Refusé le ${_court(_s(q['refusedAt']))}' : 'Refusé par le client';
    case 'annule':
      return 'Annulé';
    case 'expire':
      return 'Validité dépassée le ${_court(finValidite(q))}';
    case 'envoye' || 'relancer':
      final r = _relances(q);
      final envoi = r.isNotEmpty
          ? 'Relancé le ${_court(r.last)}'
          : _s(q['sentAt']).isNotEmpty
              ? 'Envoyé le ${_court(_s(q['sentAt']))}'
              : 'Envoyé';
      final suite = _s(q['viewedAt']).isNotEmpty
          ? 'vu par le client'
          : s.id == 'relancer'
              ? 'sans réponse'
              : '';
      return [envoi, if (suite.isNotEmpty) suite].join(' · ');
  }
  final modif = _s(q['updatedAt']).isNotEmpty ? _s(q['updatedAt']) : _s(q['createdAtIso']);
  final d = DateTime.tryParse(modif)?.toLocal();
  if (d == null) return '';
  return DateFormat('yyyy-MM-dd').format(d) == aujourdhui
      ? 'Modifié à ${d.hour} h ${d.minute.toString().padLeft(2, '0')}'
      : 'Modifié le ${DateFormat('d MMM', 'fr_FR').format(d)}';
}

typedef ActionDevis = ({String id, String label});

ActionDevis actionDevis(Map q, String aujourdhui) => switch (statutDevis(q, aujourdhui).id) {
      'brouillon' || 'pret' => (id: 'reprendre', label: 'Reprendre'),
      'relancer' => (id: 'relancer', label: 'Relancer'),
      'expire' || 'refuse' => (id: 'dupliquer', label: 'Dupliquer'),
      _ => (id: 'voir', label: 'Voir'),
    };

Map<String, int> compterDevis(List<Map<String, dynamic>> devis, String aujourdhui) {
  final c = {'tous': devis.length, 'brouillon': 0, 'envoye': 0, 'signe': 0, 'termine': 0, 'relancer': 0, 'aReprendre': 0};
  for (final q in devis) {
    final o = ongletDevis(q, aujourdhui);
    c[o] = c[o]! + 1;
    if (aRelancer(q, aujourdhui)) c['relancer'] = c['relancer']! + 1;
    final modif = _j(_s(q['updatedAt']).isNotEmpty ? q['updatedAt'] : q['createdAtIso']);
    if (o == 'brouillon' && modif.compareTo(aujourdhui) < 0) c['aReprendre'] = c['aReprendre']! + 1;
  }
  c['badge'] = c['aReprendre']! + c['relancer']!;
  return c;
}

String _pl(int n, String mot) => '$n $mot${n > 1 ? 's' : ''}';

String resumeDevis(Map<String, int> c, {bool avecTotal = true}) => [
      if (avecTotal) '${c['tous']} devis',
      if ((c['envoye'] ?? 0) > 0) '${_pl(c['envoye']!, 'envoyé')}${avecTotal ? ' en attente' : ''}',
      if ((c['relancer'] ?? 0) > 0) '${c['relancer']} à relancer',
      if ((c['brouillon'] ?? 0) > 0) _pl(c['brouillon']!, 'brouillon'),
    ].join(' · ');

String messageRelance(Map q, {String entreprise = ''}) {
  String point(String t) => t.endsWith('.') ? t : '$t.';
  final fin = finValidite(q);
  final phrase = [
    point('Je reviens vers vous au sujet du devis ${q['quoteNumber']}${_s(q['project']).isNotEmpty ? ' (${q['project']})' : ''}${_s(q['sentAt']).isNotEmpty ? ', envoyé le ${_court(_s(q['sentAt']))}' : ''}'),
    if (fin.isNotEmpty) point("Il reste valable jusqu'au ${_court(fin)}"),
  ].join(' ');
  return [
    'Bonjour${_s(q['client']).isNotEmpty ? ' ${q['client']}' : ''},',
    '',
    phrase,
    "Avez-vous des questions ? Je peux l'ajuster si besoin.",
    '',
    'Bien cordialement,',
    if (entreprise.isNotEmpty) entreprise,
  ].join('\n');
}
