import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/features/quote/providers/quote_creation_provider.dart';
import 'package:koji/features/subscription/data/subscription_repository.dart';
import 'package:koji/features/subscription/paywall_screen.dart';
import 'package:koji/features/subscription/providers/subscription_provider.dart';

/// Runs [action] only while the entreprise has access (trial running or
/// subscribed); once the trial has expired the paywall opens instead. Unknown
/// / loading states never block.
void guardEntrepriseAccess(
    BuildContext context, WidgetRef ref, VoidCallback action) {
  final status = ref.read(subscriptionStatusProvider).valueOrNull;
  if (status != null && status.state == AccessState.expired) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const PaywallScreen()),
    );
    return;
  }
  action();
}

void createChantier(BuildContext context, WidgetRef ref) {
  guardEntrepriseAccess(context, ref, () => context.push('/chantier/create'));
}

void openChantier(BuildContext context, Map<String, dynamic> chantier) {
  final id = chantier['id'] as String?;
  if (id == null) return;
  context.push('/chantier/dashboard', extra: {
    'id': id,
    'reference': (chantier['reference'] as String?) ?? '',
  });
}

/// Re-opens a saved devis directly on its Récapitulatif (the recap rehydrates
/// tâches / fournitures / inputs from the saved quote because it has an id).
Future<void> openSavedQuote(
    BuildContext context, WidgetRef ref, Map<String, dynamic> quote) async {
  final messenger = ScaffoldMessenger.of(context);
  final router = GoRouter.of(context);
  try {
    final notifier = ref.read(quoteCreationProvider.notifier);
    notifier.reset();
    await notifier.seedFromSavedQuote(quote);
    router.push('/quote/detail', extra: quote);
  } catch (e) {
    messenger.showSnackBar(
      SnackBar(content: Text('Erreur de chargement du devis: $e')),
    );
  }
}

/// Display name of a chantier row (title, else reference).
String chantierTitle(Map<String, dynamic> c) {
  final title = (c['title'] as String?)?.trim() ?? '';
  if (title.isNotEmpty) return title;
  final ref = (c['reference'] as String?)?.trim() ?? '';
  return ref.isNotEmpty ? ref : 'Chantier';
}

/// "Rue, 75011 Paris" style address of a chantier row.
String chantierPlace(Map<String, dynamic> c) {
  String s(String k) => (c[k] as String?)?.trim() ?? '';
  final city =
      [s('postal_code'), s('city')].where((e) => e.isNotEmpty).join(' ');
  return [s('street'), city].where((e) => e.isNotEmpty).join(', ');
}

bool isChantierActive(Map<String, dynamic> c) {
  final status = ((c['status'] as String?) ?? '').toLowerCase();
  return !const {
    'termine',
    'terminé',
    'valide',
    'validé',
    'completed',
    'done',
    'archived',
  }.contains(status);
}
