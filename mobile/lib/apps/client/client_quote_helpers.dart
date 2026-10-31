import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:koji/core/route_args.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/features/client/providers/client_providers.dart';
import 'package:koji/features/client/repository/client_repository.dart';
import 'package:koji/features/quote/models/quote_status.dart';
import 'package:koji/features/signature/client_devis_pdf.dart';

/// Read helpers over the normalized client quote map
/// (see UserRepository._normalizeQuote).
abstract final class ClientQuote {
  static String artisan(Map<String, dynamic> q) {
    final company = q['company'];
    if (company is Map) {
      for (final k in const ['raisonSociale', 'name', 'companyName']) {
        final v = (company[k] as String?)?.trim();
        if (v != null && v.isNotEmpty) return v;
      }
    }
    return 'Votre artisan';
  }

  static String number(Map<String, dynamic> q) {
    final n = (q['quoteNumber'] ?? q['reference'] ?? '').toString();
    return n == 'N/A' ? '' : n;
  }

  static double ttc(Map<String, dynamic> q) {
    final totals = q['totals'] as Map<String, dynamic>? ?? const {};
    return (totals['ttc'] as num?)?.toDouble() ?? 0;
  }

  static bool isSigned(Map<String, dynamic> q) => QuoteStatus.isSigned(q);

  static bool isRefused(Map<String, dynamic> q) => QuoteStatus.isRefused(q);

  static bool isToSign(Map<String, dynamic> q) =>
      !isSigned(q) && !isRefused(q) && ClientRepository.isPending(q['status']);

  static (String, KojiTone) status(Map<String, dynamic> q) {
    if (isSigned(q)) return ('Signé', KojiTone.green);
    if (isRefused(q)) return ('Refusé', KojiTone.coral);
    if (isToSign(q)) return ('À signer', KojiTone.amber);
    return ('Reçu', KojiTone.info);
  }

  static String date(Map<String, dynamic> q) {
    final d =
        DateTime.tryParse('${q['signed_at'] ?? q['created_at']}')?.toLocal();
    return d == null ? '' : DateFormat('d MMM y', 'fr_FR').format(d);
  }

  /// Opens the signature flow, then refreshes the client's devis.
  static Future<void> sign(
      BuildContext context, WidgetRef ref, Map<String, dynamic> q) async {
    await context.push('/signature/sign', extra: SignatureArgs(quote: q));
    ref.invalidate(clientQuotesProvider);
  }

  /// Opens the devis PDF (same document the artisan sent).
  static Future<void> view(BuildContext context, Map<String, dynamic> q) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await previewClientDevis(q);
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text("Impossible d'ouvrir le devis : $e")),
      );
    }
  }
}
