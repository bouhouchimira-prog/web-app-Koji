/// Single source of truth for interpreting the `status` string stored on a
/// quote, plus its signature fields.
///
/// Statuses are written by two different apps:
///  - The Flutter app uses values like `en_cours`, `generated`, `draft`,
///    `accepted`, `validated`, `refused`, `archived`.
///  - The client signature web app (KOJI-SIGNATURE) writes the French
///    `accepte` when a client signs, and also sets `signed_at` +
///    `signature_data`.
///
/// Treating any of those signed variants uniformly here keeps the Devis list,
/// the home dashboard and the signature notification in agreement.
class QuoteStatus {
  const QuoteStatus._();

  /// True when the client has signed / accepted the quote.
  ///
  /// We trust `signed_at` first (set by the signature app regardless of the
  /// exact status spelling), then fall back to known status spellings.
  static bool isSigned(Map<String, dynamic> quote) {
    if ((quote['signed_at'] ?? '').toString().trim().isNotEmpty) return true;
    final s = (quote['status'] ?? '').toString().toLowerCase();
    return s == 'accepted' ||
        s == 'validated' ||
        s == 'accepte' ||
        s == 'accepté' ||
        s == 'signed' ||
        s.contains('sign') ||
        s.contains('accept');
  }

  static bool isRefused(Map<String, dynamic> quote) {
    final s = (quote['status'] ?? '').toString().toLowerCase();
    return s == 'refused' || s == 'refuse' || s == 'refusé' || s.contains('refus');
  }

  static bool isInProgress(Map<String, dynamic> quote) {
    if (isSigned(quote) || isRefused(quote)) return false;
    final s = (quote['status'] ?? '').toString().toLowerCase();
    return s == 'en_cours' ||
        s == 'generated' ||
        s == 'draft' ||
        s == 'pending' ||
        s.contains('attente');
  }
}
