import 'package:flutter/material.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';

/// Navy band across the top of the web layout: logo + space name, optional
/// search field, notifications and the account avatar.
class KojiTopband extends StatelessWidget {
  const KojiTopband({
    super.key,
    required this.espace,
    required this.accountName,
    this.searchHint,
    this.onSearch,
    this.onNotifications,
    this.unreadCount = 0,
    this.onAccount,
  });

  final String espace;
  final String accountName;
  final String? searchHint;
  final VoidCallback? onSearch;
  final VoidCallback? onNotifications;
  final int unreadCount;
  final VoidCallback? onAccount;

  static const height = 72.0;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Container(
      height: height,
      color: p.topband,
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Row(
        children: [
          SizedBox(
            width: 248,
            child: KojiLogo(
              size: 30,
              wordColor: Colors.white,
              wordSize: 19,
              subtitle: espace,
              subtitleColor: KojiColors.onNavyMuted,
            ),
          ),
          Expanded(
            child: Center(
              child: onSearch == null
                  ? const SizedBox.shrink()
                  : ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: Material(
                        color: Colors.white.withValues(alpha: 0.09),
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          onTap: onSearch,
                          borderRadius: BorderRadius.circular(12),
                          child: SizedBox(
                            height: 42,
                            child: Row(
                              children: [
                                const SizedBox(width: 14),
                                const KojiIcon(KojiIcons.search,
                                    size: 15,
                                    color: KojiColors.onNavyMuted,
                                    strokeWidth: 2),
                                const SizedBox(width: 11),
                                Expanded(
                                  child: Text(
                                    searchHint ?? 'Rechercher…',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13.5,
                                      color: KojiColors.onNavyMuted,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
            ),
          ),
          SizedBox(
            width: 248,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (onNotifications != null)
                  _TopbandButton(
                    tooltip: 'Notifications',
                    onTap: onNotifications!,
                    badge: unreadCount > 0,
                    child: const KojiIcon(KojiIcons.bell,
                        size: 18,
                        color: KojiColors.onNavyMuted,
                        strokeWidth: 2),
                  ),
                const SizedBox(width: 12),
                Tooltip(
                  message: accountName,
                  child: InkWell(
                    onTap: onAccount,
                    customBorder: const CircleBorder(),
                    child: KojiAvatar(
                      accountName,
                      size: 40,
                      background: KojiColors.onNavyMuted,
                      foreground: KojiColors.navy,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TopbandButton extends StatelessWidget {
  const _TopbandButton({
    required this.child,
    required this.onTap,
    required this.tooltip,
    this.badge = false,
  });

  final Widget child;
  final VoidCallback onTap;
  final String tooltip;
  final bool badge;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.white.withValues(alpha: 0.09),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: SizedBox(
            width: 40,
            height: 40,
            child: Stack(
              alignment: Alignment.center,
              children: [
                child,
                if (badge)
                  Positioned(
                    top: 9,
                    right: 10,
                    child: Container(
                      width: 9,
                      height: 9,
                      decoration: BoxDecoration(
                        color: KojiColors.coralDot,
                        shape: BoxShape.circle,
                        border:
                            Border.all(color: context.koji.topband, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// One entry of a side menu.
class KojiNavItem {
  const KojiNavItem({
    required this.id,
    required this.label,
    required this.icon,
    this.badge = 0,
    this.destructive = false,
  });

  final String id;
  final String label;
  final String icon;
  final int badge;
  final bool destructive;
}

class KojiNavGroup {
  const KojiNavGroup({
    required this.label,
    required this.items,
    this.premium = false,
    this.pushToBottom = false,
  });

  final String label;
  final List<KojiNavItem> items;
  final bool premium;

  /// Pins the group to the bottom of the menu (client "Configuration").
  final bool pushToBottom;
}

/// White 280px side menu from the design. Used as the fixed menu of the web
/// layout and inside the phone drawer.
class KojiSideNav extends StatelessWidget {
  const KojiSideNav({
    super.key,
    required this.groups,
    required this.activeId,
    required this.onSelect,
    this.header,
    this.footer,
    this.itemHeight = 40,
    this.showBorder = true,
  });

  final List<KojiNavGroup> groups;
  final String? activeId;
  final ValueChanged<KojiNavItem> onSelect;
  final Widget? header;
  final Widget? footer;
  final double itemHeight;
  final bool showBorder;

  static const width = 280.0;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final top = groups.where((g) => !g.pushToBottom).toList();
    final bottom = groups.where((g) => g.pushToBottom).toList();

    return Container(
      width: width,
      decoration: BoxDecoration(
        color: p.surface,
        border: showBorder ? Border(right: BorderSide(color: p.line)) : null,
      ),
      child: Column(
        children: [
          Expanded(
            child: LayoutBuilder(builder: (context, c) {
              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 12),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: c.maxHeight - 32),
                  child: IntrinsicHeight(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (header != null) ...[
                          header!,
                          const SizedBox(height: 18),
                        ],
                        for (final g in top) _group(context, g),
                        if (bottom.isNotEmpty) ...[
                          const Spacer(),
                          for (final g in bottom) _group(context, g),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }),
          ),
          if (footer != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 18),
              child: footer!,
            ),
        ],
      ),
    );
  }

  Widget _group(BuildContext context, KojiNavGroup g) {
    final p = context.koji;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 26,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Text(
                    g.label.toUpperCase(),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1,
                      color: p.faint,
                    ),
                  ),
                  if (g.premium) ...[
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: p.isDark
                            ? KojiColors.premium.withValues(alpha: 0.3)
                            : KojiColors.premiumBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'PREMIUM',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                          color:
                              p.isDark ? KojiColors.gold : KojiColors.premium,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 4),
          for (final it in g.items) _item(context, it),
        ],
      ),
    );
  }

  Widget _item(BuildContext context, KojiNavItem it) {
    final p = context.koji;
    final active = it.id == activeId;
    final color = it.destructive
        ? p.toneFg(KojiTone.coral)
        : active
            ? p.navActiveFg
            : p.muted;
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: active ? p.navActiveBg : Colors.transparent,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          onTap: () => onSelect(it),
          borderRadius: BorderRadius.circular(11),
          child: SizedBox(
            height: itemHeight,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  KojiIcon(it.icon, size: 18, color: color),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Text(
                      it.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                        color: color,
                      ),
                    ),
                  ),
                  if (it.badge > 0)
                    Container(
                      constraints: const BoxConstraints(minWidth: 20),
                      height: 20,
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      decoration: BoxDecoration(
                        color: p.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        it.badge > 99 ? '99+' : '${it.badge}',
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: p.onPrimary,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Content area of the web layout. Gives the page its own [MediaQuery] size so
/// screens that scale from the screen width (ResponsiveHelper) measure the
/// content area instead of the whole window, and optionally caps the width of
/// screens that were designed for phones.
class KojiContentArea extends StatelessWidget {
  const KojiContentArea({super.key, required this.child, this.maxWidth});

  final Widget child;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final width =
          maxWidth == null ? c.maxWidth : c.maxWidth.clamp(0.0, maxWidth!);
      final mq = MediaQuery.of(context);
      Widget page = MediaQuery(
        data: mq.copyWith(size: Size(width, c.maxHeight)),
        child: child,
      );
      if (maxWidth != null && c.maxWidth > maxWidth!) {
        page = ColoredBox(
          color: context.koji.page,
          child: Center(child: SizedBox(width: width, child: page)),
        );
      }
      return ClipRect(child: page);
    });
  }
}
