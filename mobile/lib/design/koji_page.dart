import 'package:flutter/material.dart';

import 'package:koji/design/koji_widgets.dart';

/// Standard page of the design: title block, optional full-width blocks (KPI
/// row…), then a main column and a narrower side column. Below 1000px of
/// content width the side column moves under the main one.
class KojiPage extends StatelessWidget {
  const KojiPage({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const [],
    this.top = const [],
    required this.main,
    this.side = const [],
    this.onRefresh,
    this.appBarOnPhone = false,
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final List<Widget> top;
  final List<Widget> main;
  final List<Widget> side;
  final Future<void> Function()? onRefresh;

  /// Pages that are not bottom-bar tabs get a back button on phones.
  final bool appBarOnPhone;

  static List<Widget> _gapped(List<Widget> blocks, double gap) => [
        for (final (i, b) in blocks.indexed) ...[
          if (i > 0) SizedBox(height: gap),
          b,
        ],
      ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final wide = c.maxWidth >= 1000;
      final pad = wide ? 32.0 : 20.0;
      final showAppBar = appBarOnPhone && !wide;

      Widget list = ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.fromLTRB(
            pad, wide ? 28 : (showAppBar ? 4 : 18), pad, 32),
        children: [
          KojiPageHeader(title: title, subtitle: subtitle, actions: actions),
          const SizedBox(height: 20),
          ..._gapped(top, 16),
          if (top.isNotEmpty) const SizedBox(height: 20),
          if (wide && side.isNotEmpty)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 18,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: _gapped(main, 16),
                  ),
                ),
                const SizedBox(width: 20),
                Expanded(
                  flex: 10,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: _gapped(side, 16),
                  ),
                ),
              ],
            )
          else
            ..._gapped([...main, ...side], 16),
        ],
      );

      if (onRefresh != null) {
        list = RefreshIndicator(onRefresh: onRefresh!, child: list);
      }

      return Scaffold(
        appBar: showAppBar ? AppBar() : null,
        body: SafeArea(bottom: false, child: list),
      );
    });
  }
}
