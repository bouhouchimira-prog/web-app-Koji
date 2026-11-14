import 'package:intl/intl.dart';

// Règles de facturation recopiées du site (app/facturation/page.jsx,
// app/api/invoices/route.js) : mêmes statuts, mêmes montants, mêmes textes
// de relance, pour que l'app et le site affichent toujours la même chose.

typedef Invoice = Map<String, dynamic>;

const invoiceTypes = ['Acompte initial', 'Facture intermédiaire', 'Facture finale'];

const creditReasons = {
  'erreur': 'Erreur sur la facture',
  'retractation': 'Rétractation du client',
  'geste': 'Geste commercial',
  'annulation': 'Annulation',
};

const reminderLevels = {
  'aimable': 'Rappel aimable',
  'ferme': 'Relance ferme',
  'demeure': 'Mise en demeure',
};

const reminderHints = {
  'aimable': 'dès 3 jours de retard',
  'ferme': 'dès 15 jours',
  'demeure': 'dès 30 jours, en recommandé',
};

const channelLabels = {'email': 'e-mail', 'manuel': 'notée', 'recommande': 'recommandé'};

const statusLabels = {
  'Brouillon': 'Brouillon',
  'Emise': 'À échéance',
  'Payee': 'Payée',
  'Retard': 'En retard',
  'Annulee': 'Annulée',
  'Avoir': 'Avoir',
};

const _monthsShort = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const _monthsLong = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

final _euro = NumberFormat.currency(locale: 'fr_FR', symbol: '€', decimalDigits: 2);

String euro(num? value) => _euro.format(value ?? 0);

double amountOf(Invoice invoice) => (invoice['amountTtc'] as num?)?.toDouble() ?? 0;

bool isCreditNote(Invoice invoice) => invoice['kind'] == 'avoir';

bool isActive(Invoice invoice) => invoice['status'] != 'Annulee' && invoice['deleted'] != true;

DateTime _today([DateTime? now]) {
  final n = now ?? DateTime.now();
  return DateTime(n.year, n.month, n.day);
}

DateTime? parseDay(Object? value) {
  final text = '${value ?? ''}';
  if (text.isEmpty) return null;
  final parsed = DateTime.tryParse(text.length == 10 ? '${text}T00:00:00' : text);
  if (parsed == null) return null;
  final local = parsed.isUtc ? parsed.toLocal() : parsed;
  return DateTime(local.year, local.month, local.day);
}

String shortDay(Object? value) {
  final day = parseDay(value);
  return day == null ? '' : '${day.day} ${_monthsShort[day.month - 1]}';
}

String longDay(Object? value, {bool withYear = true}) {
  final day = parseDay(value);
  if (day == null) return '';
  return withYear ? '${day.day} ${_monthsLong[day.month - 1]} ${day.year}' : '${day.day} ${_monthsLong[day.month - 1]}';
}

/// « En retard » n'est pas stocké : une facture émise dont l'échéance est
/// passée est en retard à la volée. Un avoir n'est jamais en retard.
String invoiceBucket(Invoice invoice, {DateTime? now}) {
  if (isCreditNote(invoice)) return 'Avoir';
  final status = '${invoice['status'] ?? 'Brouillon'}';
  if (status == 'Emise') {
    final due = parseDay(invoice['dueDate']);
    if (due != null && due.isBefore(_today(now))) return 'Retard';
  }
  return status;
}

int daysLate(Invoice invoice, {DateTime? now}) {
  final due = parseDay(invoice['dueDate']);
  if (due == null) return 0;
  // En dates UTC : un changement d'heure ne fait pas perdre un jour.
  final today = _today(now);
  final late = DateTime.utc(today.year, today.month, today.day).difference(DateTime.utc(due.year, due.month, due.day)).inDays;
  return late > 0 ? late : 0;
}

String suggestedLevel(Invoice invoice, {DateTime? now}) {
  final late = daysLate(invoice, now: now);
  return late >= 30 ? 'demeure' : late >= 15 ? 'ferme' : 'aimable';
}

List<Map<String, dynamic>> remindersOf(Invoice invoice) =>
    (invoice['reminders'] as List?)?.whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList() ?? const [];

/// Montant déjà couvert par des avoirs sur cette facture (positif).
double creditedOn(Invoice invoice, List<Invoice> all) => all
    .where((item) => isCreditNote(item) && item['refInvoiceId'] == invoice['id'] && item['status'] != 'Annulee')
    .fold(0.0, (sum, item) => sum - amountOf(item));

bool canCreditNote(Invoice invoice, List<Invoice> all) =>
    !isCreditNote(invoice) &&
    (invoice['status'] == 'Emise' || invoice['status'] == 'Payee') &&
    creditedOn(invoice, all) < amountOf(invoice) - 0.01;

bool canRemind(Invoice invoice) => !isCreditNote(invoice) && invoice['status'] == 'Emise';

String dueLabel(Invoice invoice, {DateTime? now}) {
  final bucket = invoiceBucket(invoice, now: now);
  if (bucket == 'Avoir') return invoice['refInvoiceNumber'] != null ? 'sur ${invoice['refInvoiceNumber']}' : '—';
  if (bucket == 'Payee') return invoice['paidAt'] != null && '${invoice['paidAt']}'.isNotEmpty ? 'payée le ${shortDay(invoice['paidAt'])}' : 'payée';
  if (bucket == 'Retard') {
    final reminders = remindersOf(invoice);
    final last = reminders.isEmpty ? '' : ' · relancée le ${shortDay(reminders.last['at'])}';
    return 'échue le ${shortDay(invoice['dueDate'])}$last';
  }
  if (bucket == 'Emise') return shortDay(invoice['dueDate']).isEmpty ? '—' : shortDay(invoice['dueDate']);
  return '—';
}

class BillingSummary {
  const BillingSummary(this.total, this.already, this.remaining);
  final double total;
  final double already;
  final double remaining;

  String get state => remaining <= 0.01 ? 'Soldée' : already > 0 ? 'Partielle' : 'À facturer';
}

/// Même calcul que le site : total du devis − factures actives (les avoirs,
/// négatifs, rendent le montant de nouveau facturable).
BillingSummary billingSummary(num? quoteTotalTtc, List<Invoice> invoicesOfQuote) {
  final total = (quoteTotalTtc ?? 0).toDouble();
  final already = invoicesOfQuote.where(isActive).fold(0.0, (sum, item) => sum + amountOf(item));
  final remaining = total - already;
  return BillingSummary(total, already, remaining < 0 ? 0 : remaining);
}

class FacturesStats {
  const FacturesStats({
    required this.paidThisMonth,
    required this.paidThisMonthCount,
    required this.pending,
    required this.pendingCount,
    required this.late,
    required this.lateCount,
    required this.draftCount,
  });
  final double paidThisMonth;
  final int paidThisMonthCount;
  final double pending;
  final int pendingCount;
  final double late;
  final int lateCount;
  final int draftCount;
}

FacturesStats facturesStats(List<Invoice> invoices, {DateTime? now}) {
  final today = _today(now);
  final active = invoices.where(isActive).toList();
  bool thisMonth(Object? value) {
    final day = parseDay(value);
    return day != null && day.year == today.year && day.month == today.month;
  }

  final paid = active.where((i) => i['status'] == 'Payee' && !isCreditNote(i) && thisMonth(i['paidAt'])).toList();
  final pending = active.where((i) => invoiceBucket(i, now: now) == 'Emise').toList();
  final late = active.where((i) => invoiceBucket(i, now: now) == 'Retard').toList();
  double sum(List<Invoice> list) => list.fold(0.0, (s, i) => s + amountOf(i));
  return FacturesStats(
    paidThisMonth: sum(paid),
    paidThisMonthCount: paid.length,
    pending: sum(pending),
    pendingCount: pending.length,
    late: sum(late),
    lateCount: late.length,
    draftCount: active.where((i) => i['status'] == 'Brouillon').length,
  );
}

/// PRO-06.2 : textes préremplis, modifiables avant envoi (identiques au site,
/// lib/relances.js). societe : client professionnel (pénalités, indemnité de
/// 40 €) ; particulier : intérêts au taux légal.
String reminderText(String level, Invoice invoice, {String company = '', bool societe = false, DateTime? now}) {
  final client = '${invoice['client'] ?? ''}'.trim();
  final amount = euro(amountOf(invoice));
  final due = longDay(invoice['dueDate']);
  final number = '${invoice['invoiceNumber'] ?? ''}';
  final previous = remindersOf(invoice).where((r) => r['level'] != 'demeure').map((r) => r['at']).toList();
  final signature = company.isNotEmpty ? '\n\nCordialement,\n$company' : '\n\nCordialement,';
  final type = '${invoice['type'] ?? ''}';
  final nom = RegExp('acompte', caseSensitive: false).hasMatch(type)
      ? 'la facture d\'acompte'
      : RegExp('situation', caseSensitive: false).hasMatch(type)
          ? 'la situation de travaux'
          : 'la facture';
  if (level == 'demeure') {
    final relances = previous.isEmpty ? '' : 'malgré ${previous.length > 1 ? 'nos relances des' : 'notre relance du'} ${_listeJours(previous)}, ';
    final emise = longDay(invoice['issuedAt'] ?? invoice['createdAt'], withYear: false);
    final suite = societe
        ? 'À défaut, nous saisirons la juridiction compétente. Des pénalités de retard et l\'indemnité forfaitaire de 40 € pour frais de recouvrement sont dues de plein droit.'
        : 'À défaut, nous saisirons la juridiction compétente. Les sommes dues porteront intérêts au taux légal à compter de la présente mise en demeure.';
    return 'Objet : mise en demeure de payer\n\n${_civilite(client)}, $relances$nom $number${emise.isNotEmpty ? ' du $emise' : ''}, d\'un montant de $amount TTC, reste impayée. Nous vous mettons en demeure de régler cette somme sous 8 jours à compter de la réception de ce courrier. $suite${company.isNotEmpty ? '\n\n$company' : ''}';
  }
  final bonjour = client.isEmpty ? 'Madame, Monsieur' : client;
  if (level == 'ferme') {
    final rappel = previous.isEmpty ? '' : ' du ${longDay(previous.last, withYear: false)}';
    return 'Bonjour $bonjour,\n\nMalgré notre précédent rappel$rappel, $nom $number d\'un montant de $amount TTC, échue le $due, reste impayée (${daysLate(invoice, now: now)} jours de retard).\n\nMerci de procéder au règlement sous 8 jours. La facture est jointe à ce message.$signature';
  }
  return 'Bonjour $bonjour,\n\nSauf erreur de notre part, $nom $number d\'un montant de $amount TTC, arrivée à échéance le $due, n\'a pas encore été réglée.\n\nPourriez-vous procéder au règlement ? Vous trouverez la facture en pièce jointe. Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.$signature';
}

String _civilite(String client) {
  if (RegExp(r'^(mme|madame)\b', caseSensitive: false).hasMatch(client)) return 'Madame';
  if (RegExp(r'^(m\.|mr|monsieur)\b', caseSensitive: false).hasMatch(client)) return 'Monsieur';
  return 'Madame, Monsieur';
}

/// « 9 et 21 novembre », mois répétés s'ils diffèrent.
String _listeJours(List<Object?> dates) {
  final days = dates.map(parseDay).whereType<DateTime>().toList();
  if (days.isEmpty) return '';
  final memeMois = days.every((d) => d.month == days.first.month);
  final mots = [
    for (var i = 0; i < days.length; i++)
      memeMois && i < days.length - 1 ? '${days[i].day}' : '${days[i].day} ${_monthsLong[days[i].month - 1]}',
  ];
  return mots.length > 1 ? '${mots.sublist(0, mots.length - 1).join(', ')} et ${mots.last}' : mots.first;
}

/// Paliers des relances automatiques (J+3, J+15, J+30).
const relancePaliers = [
  (level: 'aimable', jours: 3, label: 'rappel aimable', prevu: 'prévu'),
  (level: 'ferme', jours: 15, label: 'relance ferme', prevu: 'prévue'),
  (level: 'demeure', jours: 30, label: 'mise en demeure', prevu: 'prévue'),
];

/// Facture suivie dans les impayés : émise, échue, pas entièrement couverte
/// par un avoir.
bool isUnpaid(Invoice invoice, List<Invoice> all, {DateTime? now}) =>
    !isCreditNote(invoice) &&
    invoice['status'] == 'Emise' &&
    invoice['archived'] != true &&
    amountOf(invoice) - creditedOn(invoice, all) > 0.01 &&
    invoiceBucket(invoice, now: now) == 'Retard';

/// Étape affichée (« 2e relance envoyée le 21 nov. », « rappel aimable prévu demain »).
String relanceStep(Invoice invoice, {DateTime? now}) {
  final reminders = remindersOf(invoice);
  final demeure = reminders.where((r) => r['level'] == 'demeure').toList();
  if (demeure.isNotEmpty) return 'mise en demeure envoyée le ${shortDay(demeure.first['at'])}';
  if (invoice['demeurePrete'] != null) return 'mise en demeure prête';
  if (reminders.isNotEmpty) {
    final last = reminders.last;
    return '${reminders.length == 1 ? '1re' : '${reminders.length}e'} relance ${last['channel'] == 'email' ? 'envoyée' : 'notée'} le ${shortDay(last['at'])}';
  }
  if (invoice['remindersOff'] == true) return 'relances désactivées';
  final late = daysLate(invoice, now: now);
  final next = relancePaliers.where((p) => late < p.jours).toList();
  if (next.isEmpty) return 'à relancer';
  final dans = next.first.jours - late;
  return '${next.first.label} ${next.first.prevu} ${dans == 1 ? 'demain' : 'dans $dans jours'}';
}

/// Action de la ligne : « demeure », « relancer » ou « voir ».
String relanceAction(Invoice invoice, {DateTime? now}) {
  final reminders = remindersOf(invoice);
  if (reminders.any((r) => r['level'] == 'demeure')) return 'voir';
  if (daysLate(invoice, now: now) >= 30 || reminders.any((r) => r['level'] == 'ferme') || invoice['demeurePrete'] != null) return 'demeure';
  if (daysLate(invoice, now: now) >= 3) return 'relancer';
  return 'voir';
}

bool isCompanyClient(Invoice invoice, List<Map<String, dynamic>> quotes) =>
    quotes.any((q) => q['id'] == invoice['quoteId'] && q['clientType'] == 'societe');

bool isSignedQuote(Map<String, dynamic> quote) => quote['status'] == 'Signe' || quote['signatureStatus'] == 'Signe';

const amountModes = {
  'deposit': 'Acompte',
  'percent': 'Pourcentage',
  'fixed': 'Montant fixe',
  'remaining': 'Solde restant',
};

double toAmount(num? value) {
  final number = (value ?? 0).toDouble();
  return number.isFinite ? (number * 100).roundToDouble() / 100 : 0;
}

String _text(Object? value) => value == null ? '' : '$value'.trim();

/// Un devis facturable et son chantier, comme `eligibleQuotes` sur le site.
class BillableQuote {
  const BillableQuote(this.quote, this.project);
  final Map<String, dynamic> quote;
  final Map<String, dynamic> project;

  String get id => _text(quote['id']);
  String get projectId => _text(project['id']);
  String get number => _text(quote['quoteNumber']);
  String get title => [_text(project['title']), _text(quote['project']), number].firstWhere((t) => t.isNotEmpty, orElse: () => 'Devis');
  String get client => [_text(project['client']), _text(quote['client'])].firstWhere((t) => t.isNotEmpty, orElse: () => '');

  /// `quote.totalTtc || quote.totalHt` côté site.
  double get total {
    final ttc = (quote['totalTtc'] as num?) ?? 0;
    return toAmount(ttc != 0 ? ttc : (quote['totalHt'] as num?) ?? 0);
  }

  List<Invoice> invoicesIn(List<Invoice> all) =>
      all.where((i) => i['quoteId'] == id || (projectId.isNotEmpty && i['projectId'] == projectId)).toList();

  BillingSummary summary(List<Invoice> all) => billingSummary(total, invoicesIn(all));
}

/// Devis signés (ou déjà transformés en facture), hors chantiers archivés.
List<BillableQuote> billableQuotes(
  List<Map<String, dynamic>> quotes,
  List<Map<String, dynamic>> projects,
  List<Invoice> invoices,
) {
  final transformed = invoices.where((i) => i['sourceType'] == 'quote-transform').map((i) => i['quoteId']).toSet();
  return quotes.where((q) => isSignedQuote(q) || transformed.contains(q['id'])).map((quote) {
    final projectId = _text(quote['projectId']);
    final linked = projects.where((p) => projectId.isNotEmpty && p['id'] == projectId).firstOrNull;
    return BillableQuote(
      quote,
      linked ??
          {
            'id': projectId.isNotEmpty ? projectId : 'quote-${quote['id']}',
            'title': _text(quote['project']).isNotEmpty ? quote['project'] : (_text(quote['quoteNumber']).isNotEmpty ? quote['quoteNumber'] : 'Devis'),
            'client': quote['client'] ?? '',
            'clientEmail': quote['clientEmail'] ?? '',
            'status': 'Actif',
          },
    );
  }).where((b) => b.project['status'] != 'Archive').toList();
}

/// Montant prévu avant création, plafonné au reste à facturer à l'affichage.
double previewAmount(String mode, BillingSummary summary, {double fixed = 0, double percent = 0, double deposit = 0}) {
  return switch (mode) {
    'remaining' => summary.remaining,
    'percent' => summary.total * percent / 100,
    'deposit' => summary.total * deposit / 100,
    _ => fixed,
  };
}

/// Taux de TVA d'une facture (PRO-06.1) : le sien, celui de la situation,
/// sinon celui du devis, sinon 20 %. Même règle que le site.
double tauxFacture(Invoice invoice, [List<Map<String, dynamic>> quotes = const []]) {
  final propre = invoice['tauxTva'];
  if (propre is num) return propre.toDouble();
  final situation = invoice['situation'];
  if (situation is Map && situation['tauxTva'] is num) return (situation['tauxTva'] as num).toDouble();
  for (final q in quotes) {
    if (q['id'] == invoice['quoteId'] && q['vatRate'] is num) return (q['vatRate'] as num).toDouble();
  }
  return 20;
}

/// Avoir ventilé au taux de la facture d'origine ; la facture corrigée
/// reprend le même HT au nouveau taux (maquette : 2 286,36 € HT,
/// 2 743,63 € à 20 %, 2 515,00 € à 10 %).
({double ht, double tva, double ttc, double nouveauTtc}) avoirCorrige(num ttc, num tauxOrigine, num nouveauTaux) {
  final ht = toAmount(ttc / (1 + tauxOrigine / 100));
  return (ht: ht, tva: toAmount(ttc - ht), ttc: toAmount(ttc), nouveauTtc: toAmount(ht * (1 + nouveauTaux / 100)));
}

String tauxTexte(num taux) => '${taux == taux.roundToDouble() ? taux.toInt() : taux}'.replaceAll('.', ',');
