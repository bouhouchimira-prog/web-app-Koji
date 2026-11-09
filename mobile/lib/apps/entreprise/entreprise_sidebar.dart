import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/app/account_provider.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/design/koji_shell.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/subscription/data/subscription_repository.dart';
import 'package:koji/features/subscription/providers/subscription_provider.dart';

/// Entreprise side menu: fixed on the web layout, inside the drawer on phones.
class EntrepriseSidebar extends ConsumerWidget {
  const EntrepriseSidebar({
    super.key,
    required this.activeId,
    this.inDrawer = false,
  });

  final String? activeId;

  /// In the phone drawer the menu closes itself before navigating.
  final bool inDrawer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return KojiSideNav(
      groups: entrepriseNavGroups,
      activeId: activeId,
      showBorder: !inDrawer,
      header: inDrawer
          ? Padding(
              padding: const EdgeInsets.only(left: 12, top: 4),
              child: KojiLogo(
                size: 30,
                markColor: context.koji.heading,
                wordSize: 18,
                subtitle: 'Espace entreprise',
              ),
            )
          : null,
      onSelect: (item) {
        if (inDrawer) Navigator.of(context).pop();
        openEntrepriseNav(context, ref, item.id);
      },
      footer: const _AccountCard(),
    );
  }
}

class _AccountCard extends ConsumerWidget {
  const _AccountCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final account = ref.watch(currentAccountProvider).valueOrNull;
    final status = ref.watch(subscriptionStatusProvider).valueOrNull;
    final name = account?.displayName ?? 'Mon entreprise';

    // The plan is only displayed (nothing is sold in the app): the card
    // always opens the company profile.
    final String plan = switch (status?.state) {
      AccessState.trial => 'Essai gratuit',
      AccessState.subscribed => 'Koji ${_planLabel(status!.plan)} · actif',
      _ => 'Koji Pro',
    };

    return Material(
      color: p.surfaceMuted,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: p.line),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => openEntrepriseNav(context, ref, 'profil'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              KojiAvatar(
                name,
                size: 36,
                background: KojiColors.navy,
                foreground: Colors.white,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: p.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      plan,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                        color: p.muted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Website plan ids (lib/plan.js): "business" is the only one named
  /// differently, every other paid plan is shown as Koji Pro.
  static String _planLabel(String? plan) => switch (plan) {
        'business' => 'Business',
        _ => 'Pro',
      };
}
