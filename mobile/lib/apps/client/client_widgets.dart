import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:koji/apps/client/client_quote_helpers.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/client/repository/client_repository.dart';
import 'package:koji/features/worker/models/urgent_alert_type.dart';

/// One devis received by the client: artisan, status, amount and actions.
class ClientQuoteCard extends ConsumerStatefulWidget {
  const ClientQuoteCard({super.key, required this.quote, this.compact = false});

  final Map<String, dynamic> quote;
  final bool compact;

  @override
  ConsumerState<ClientQuoteCard> createState() => _ClientQuoteCardState();
}

class _ClientQuoteCardState extends ConsumerState<ClientQuoteCard> {
  bool _opening = false;

  Future<void> _view() async {
    setState(() => _opening = true);
    await ClientQuote.view(context, widget.quote);
    if (mounted) setState(() => _opening = false);
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final q = widget.quote;
    final artisan = ClientQuote.artisan(q);
    final (label, tone) = ClientQuote.status(q);
    final number = ClientQuote.number(q);
    final date = ClientQuote.date(q);
    final meta = [
      if (number.isNotEmpty) 'Devis $number',
      if (date.isNotEmpty) date,
    ].join(' · ');
    final toSign = ClientQuote.isToSign(q);

    final buttons = Wrap(
      spacing: 8,
      runSpacing: 8,
      alignment: WrapAlignment.end,
      children: [
        KojiButton(
          label: 'Voir le devis',
          variant: KojiButtonVariant.secondary,
          height: 38,
          loading: _opening,
          onPressed: _view,
        ),
        if (toSign)
          KojiButton(
            label: 'Signer',
            height: 38,
            onPressed: () => ClientQuote.sign(context, ref, q),
          ),
      ],
    );

    final amount = Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(
          kojiEuro(ClientQuote.ttc(q)),
          style: TextStyle(
            fontSize: widget.compact ? 16 : 19,
            fontWeight: FontWeight.w800,
            color: p.heading,
          ),
        ),
        Text('TTC', style: TextStyle(fontSize: 12, color: p.faint)),
      ],
    );

    final identity = Row(
      children: [
        KojiAvatar(artisan, size: 46),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 10,
                runSpacing: 4,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    artisan,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      color: p.ink,
                    ),
                  ),
                  KojiPill(label, tone: tone),
                ],
              ),
              if (meta.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(meta, style: TextStyle(fontSize: 12.5, color: p.muted)),
              ],
            ],
          ),
        ),
      ],
    );

    return KojiCard(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      borderColor: toSign ? p.heading : null,
      child: LayoutBuilder(builder: (context, c) {
        if (c.maxWidth >= 620) {
          return Row(
            children: [
              Expanded(child: identity),
              const SizedBox(width: 16),
              amount,
              const SizedBox(width: 18),
              buttons,
            ],
          );
        }
        // Phones: amount on its own line, then two equal-width buttons.
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            identity,
            const SizedBox(height: 12),
            Align(alignment: Alignment.centerLeft, child: amount),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: KojiButton(
                    label: 'Voir le devis',
                    variant: KojiButtonVariant.secondary,
                    height: 40,
                    expand: true,
                    loading: _opening,
                    onPressed: _view,
                  ),
                ),
                if (toSign) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: KojiButton(
                      label: 'Signer',
                      height: 40,
                      expand: true,
                      onPressed: () => ClientQuote.sign(context, ref, q),
                    ),
                  ),
                ],
              ],
            ),
          ],
        );
      }),
    );
  }
}

/// A chantier followed by the client, built from its tasks.
class ClientChantier {
  ClientChantier(this.id, this.reference, this.tasks);

  final String? id;
  final String reference;
  final List<Map<String, dynamic>> tasks;

  int get total => tasks.length;
  int get done => tasks.where((t) => t['is_done'] == true).length;
  double get progress => total == 0 ? 0 : done / total;
  bool get finished => total > 0 && done == total;
  bool get notStarted => done == 0;

  (String, KojiTone) get status {
    if (finished) return ('Terminé', KojiTone.green);
    if (notStarted) return ('À venir', KojiTone.amber);
    return ('En cours', KojiTone.info);
  }

  static List<ClientChantier> group(List<Map<String, dynamic>> tasks) {
    final byKey = <String, ClientChantier>{};
    for (final t in tasks) {
      final id = t['chantier_id'] as String?;
      final reference = (t['chantier_reference'] as String?) ?? 'Chantier';
      byKey
          .putIfAbsent(id ?? reference, () => ClientChantier(id, reference, []))
          .tasks
          .add(t);
    }
    return byKey.values.toList();
  }
}

/// "Signaler une urgence": pick a type, describe it, send it to the entreprise.
Future<void> showClientUrgentAlert(
    BuildContext context, WidgetRef ref, String chantierId) async {
  final p = context.koji;
  final type = await showModalBottomSheet<UrgentAlertType>(
    context: context,
    builder: (ctx) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 8),
            child: Text(
              'Signaler une urgence',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: p.heading,
              ),
            ),
          ),
          for (final t in UrgentAlertType.values)
            ListTile(
              leading: Icon(t.icon, color: p.toneFg(KojiTone.coral)),
              title: Text(t.label),
              onTap: () => Navigator.pop(ctx, t),
            ),
          const SizedBox(height: 8),
        ],
      ),
    ),
  );
  if (type == null || !context.mounted) return;

  final controller = TextEditingController();
  final message = await showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(type.label),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLines: 4,
        decoration: const InputDecoration(hintText: 'Décrivez la situation…'),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: const Text('Annuler'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, controller.text),
          child: const Text("Envoyer l'alerte"),
        ),
      ],
    ),
  );
  if (message == null || message.trim().isEmpty || !context.mounted) return;

  final messenger = ScaffoldMessenger.of(context);
  try {
    await ref.read(clientRepositoryProvider).sendUrgentAlert(
          chantierId: chantierId,
          type: type.value,
          message: message.trim(),
        );
    messenger.showSnackBar(
      const SnackBar(content: Text("Alerte envoyée à l'entreprise")),
    );
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text('Erreur : $e')));
  }
}

/// Small check-mark bullet line used in tip lists.
class KojiCheckLine extends StatelessWidget {
  const KojiCheckLine(this.text, {super.key, this.done = true});

  final String text;
  final bool done;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 20,
            height: 20,
            margin: const EdgeInsets.only(top: 1),
            decoration: BoxDecoration(
              color: done ? p.toneBg(KojiTone.green) : p.lineSoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: done
                ? KojiIcon(KojiIcons.check,
                    size: 11, color: p.toneFg(KojiTone.green), strokeWidth: 3)
                : null,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: done ? p.ink : p.muted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
