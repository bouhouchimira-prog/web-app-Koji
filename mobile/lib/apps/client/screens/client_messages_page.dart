import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/client/client_quote_helpers.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/client_messages_screen.dart';
import 'package:koji/features/client/providers/client_providers.dart';

/// Client messages (design: "Client — Messages"): one conversation per devis.
/// Wide screens show the list and the open conversation side by side; phones
/// open the conversation full screen.
class ClientMessagesPage extends ConsumerStatefulWidget {
  const ClientMessagesPage({super.key});

  @override
  ConsumerState<ClientMessagesPage> createState() => _ClientMessagesPageState();
}

class _ClientMessagesPageState extends ConsumerState<ClientMessagesPage> {
  String? _selectedId;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final quotesAsync = ref.watch(clientQuotesProvider);
    final quotes = (quotesAsync.valueOrNull ?? const [])
        .where((q) => (q['id'] as String?)?.isNotEmpty == true)
        .toList();

    return Scaffold(
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(builder: (context, c) {
          final wide = c.maxWidth >= 900;
          final pad = wide ? 32.0 : 20.0;

          final header = Padding(
            padding: EdgeInsets.fromLTRB(pad, wide ? 28 : 18, pad, 20),
            child: const KojiPageHeader(
              title: 'Messages',
              subtitle:
                  'Vos échanges avec les artisans, rattachés à chaque devis.',
            ),
          );

          Widget body;
          if (quotesAsync.isLoading && quotes.isEmpty) {
            body =
                const Center(child: CircularProgressIndicator(strokeWidth: 2));
          } else if (quotes.isEmpty) {
            body = const Center(
              child: KojiEmptyState(
                icon: KojiIcons.messages,
                title: 'Aucune conversation',
                subtitle:
                    "Vous pourrez échanger avec votre artisan dès qu'un devis vous sera adressé.",
              ),
            );
          } else if (!wide) {
            body = RefreshIndicator(
              onRefresh: () async => ref.invalidate(clientQuotesProvider),
              child: ListView.separated(
                padding: EdgeInsets.fromLTRB(pad, 0, pad, 24),
                itemCount: quotes.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, i) => KojiCard(
                  padding: EdgeInsets.zero,
                  child: _ConversationTile(
                    quote: quotes[i],
                    selected: false,
                    onTap: () => context.push(
                      '/client/messages/${quotes[i]['id']}',
                      extra: ClientQuote.artisan(quotes[i]),
                    ),
                  ),
                ),
              ),
            );
          } else {
            final selected = quotes.firstWhere(
              (q) => q['id'] == _selectedId,
              orElse: () => quotes.first,
            );
            final selectedId = selected['id'] as String;
            body = Padding(
              padding: EdgeInsets.fromLTRB(pad, 0, pad, 28),
              child: KojiCard(
                padding: EdgeInsets.zero,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      width: 330,
                      child: ListView(
                        padding: const EdgeInsets.all(10),
                        children: [
                          for (final q in quotes)
                            _ConversationTile(
                              quote: q,
                              selected: q['id'] == selectedId,
                              onTap: () => setState(
                                  () => _selectedId = q['id'] as String),
                            ),
                        ],
                      ),
                    ),
                    VerticalDivider(width: 1, color: p.line),
                    Expanded(
                      child: ClientChatScreen(
                        key: ValueKey(selectedId),
                        quoteId: selectedId,
                        artisanName: ClientQuote.artisan(selected),
                        embedded: true,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [header, Expanded(child: body)],
          );
        }),
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.quote,
    required this.selected,
    required this.onTap,
  });

  final Map<String, dynamic> quote;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final artisan = ClientQuote.artisan(quote);
    final number = ClientQuote.number(quote);
    final (label, tone) = ClientQuote.status(quote);
    return Material(
      color: selected ? p.navActiveBg : Colors.transparent,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              KojiAvatar(artisan, size: 42),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      artisan,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: p.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      number.isEmpty ? 'Messagerie du devis' : 'Devis $number',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12.5, color: p.muted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              KojiPill(label, tone: tone),
            ],
          ),
        ),
      ),
    );
  }
}
