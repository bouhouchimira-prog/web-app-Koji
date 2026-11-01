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
  final late = _today(now).difference(due).inDays;
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

/// PRO-06.2 : textes préremplis, modifiables avant envoi (identiques au site).
String reminderText(String level, Invoice invoice, {String company = '', DateTime? now}) {
  final client = '${invoice['client'] ?? ''}'.trim().isEmpty ? 'Madame, Monsieur' : '${invoice['client']}';
  final amount = euro(amountOf(invoice));
  final due = longDay(invoice['dueDate']);
  final number = '${invoice['invoiceNumber'] ?? ''}';
  final previous = remindersOf(invoice).map((r) => longDay(r['at'], withYear: false)).where((d) => d.isNotEmpty).toList();
  final signature = company.isNotEmpty ? '\n\nCordialement,\n$company' : '\n\nCordialement,';
  if (level == 'demeure') {
    final relances = previous.isEmpty ? '' : ', malgré nos relances du ${previous.join(' et du ')}';
    return 'Objet : mise en demeure de payer, facture $number\n\n$client,\n\nPar la présente, nous vous mettons en demeure de régler la somme de $amount TTC due au titre de la facture $number, échue le $due$relances.\n\nÀ défaut de règlement dans un délai de 8 jours à compter de la réception de ce courrier, nous nous réservons le droit d\'engager une procédure de recouvrement.${company.isNotEmpty ? '\n\n$company' : ''}';
  }
  if (level == 'ferme') {
    final rappel = previous.isEmpty ? '' : ' du ${previous.last}';
    return 'Bonjour $client,\n\nMalgré notre précédent rappel$rappel, la facture $number d\'un montant de $amount TTC, échue le $due, reste impayée (${daysLate(invoice, now: now)} jours de retard).\n\nMerci de procéder au règlement sous 8 jours. La facture est jointe à ce message.$signature';
  }
  return 'Bonjour $client,\n\nSauf erreur de notre part, la facture $number d\'un montant de $amount TTC, arrivée à échéance le $due, n\'a pas encore été réglée.\n\nPourriez-vous procéder au règlement ? Vous trouverez la facture en pièce jointe. Si le paiement est déjà parti, merci de ne pas tenir compte de ce message.$signature';
}

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
