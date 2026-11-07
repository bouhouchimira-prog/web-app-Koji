import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/app/koji_pro_api.dart';
import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;

/// In-app account deletion request, required by the App Store (guideline
/// 5.1.1(v)) and Google Play: the user starts it from the app instead of
/// being sent to an e-mail address.
///
/// Posts to koji-web's /api/account/deletion-request with the Supabase
/// access token (koji-web checks it, lib/server-auth.js). The request is
/// recorded and the Koji team is e-mailed; deletion is handled by hand
/// within 30 days because invoices must legally be kept (see the route).
///
/// Returns true when the request was sent.
Future<bool> confirmAccountDeletion(
  BuildContext context,
  WidgetRef ref, {
  required String accountType,
}) async {
  // Captured up front: in the Koji Pro phone drawer the menu closes itself
  // right after the tap, so `context` and `ref` are gone by the time the
  // dialog returns. The API client and the app-level messenger outlive it.
  final api = ref.read(kojiProApiProvider);
  final messenger = ScaffoldMessenger.maybeOf(context);
  final reasonController = TextEditingController();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text('Supprimer mon compte'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Votre demande est envoyée à l\'équipe Koji, qui supprime votre '
              'compte et vos données sous 30 jours et vous le confirme par '
              'e-mail. Les factures émises sont conservées le temps imposé '
              'par la loi.',
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                hintText: 'Raison de votre départ (facultatif)',
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Annuler'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Supprimer mon compte'),
        ),
      ],
    ),
  );
  // Not disposed here: the dialog's closing animation still rebuilds the
  // TextField for a few frames after showDialog returns. The controller has
  // no other listener and is garbage-collected with the dialog.
  final reason = reasonController.text.trim();
  if (confirmed != true) return false;

  try {
    await api.post('/api/account/deletion-request', {
      'accountType': accountType,
      'reason': reason,
    });
    messenger?.showSnackBar(const SnackBar(
      content: Text(
          'Demande de suppression envoyée. Vous recevrez une confirmation par e-mail.'),
    ));
    return true;
  } catch (err) {
    messenger?.showSnackBar(SnackBar(
      content: Text(err is KojiWebApiException
          ? err.message
          : 'Impossible d\'envoyer la demande. Réessayez ou écrivez à contact@getkoji.io.'),
    ));
    return false;
  }
}
