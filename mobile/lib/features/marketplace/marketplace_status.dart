import 'package:koji/design/koji_tokens.dart';

/// Mirrors koji-web's STATUS_LABEL map (app/client/radar/page.jsx) so the
/// mobile app shows the exact same French labels for the same raw values.
const Map<String, String> kMarketplaceStatusLabel = {
  'Publiee': 'Publiée',
  'En attente': 'En attente',
  'Terminee': 'Terminée',
  'SansSuite': 'Sans suite',
};

String marketplaceStatusLabel(String? status) =>
    kMarketplaceStatusLabel[status] ?? status ?? '—';

KojiTone marketplaceStatusTone(String? status) => switch (status) {
      'Publiee' => KojiTone.info,
      'En attente' => KojiTone.amber,
      'Terminee' => KojiTone.green,
      'SansSuite' => KojiTone.navy,
      _ => KojiTone.navy,
    };
