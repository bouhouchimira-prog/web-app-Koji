import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing/printing.dart';

import 'package:koji/app/koji_web_api_client.dart' show KojiWebApiException;
import 'package:koji/core/notification_service.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/factures/factures_logic.dart';
import 'package:koji/features/factures/factures_repository.dart';

// Morceaux partagés des écrans Factures : statut, ligne de facture, PDF et
// les trois feuilles d'action (actions, avoir, relance) de la page web.

const nouvelleFactureRoute = '/chantier/facturation/create';

String errorText(Object error) =>
    error is KojiWebApiException ? error.message : 'Action impossible. Vérifiez votre connexion et réessayez.';

void showFacturesMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Après chaque changement : liste rechargée et alerte de retard recalculée.
void facturesChanged(WidgetRef ref) {
  ref.invalidate(facturesProvider);
  NotificationService.instance.notifyOverdueInvoices();
}

class InvoiceStatusPill extends StatelessWidget {
  const InvoiceStatusPill(this.bucket, {super.key});
  final String bucket;

  @override
  Widget build(BuildContext context) {
    final tone = switch (bucket) {
      'Payee' => KojiTone.green,
      'Retard' => KojiTone.coral,
      'Emise' => KojiTone.amber,
      'Avoir' => KojiTone.navy,
      _ => KojiTone.grey,
    };
    return KojiPill(statusLabels[bucket] ?? bucket, tone: tone);
  }
}

/// Carte d'une facture (liste mobile du site, `.m-card`).
class InvoiceTile extends StatelessWidget {
  const InvoiceTile({super.key, required this.invoice, required this.onTap});
  final Invoice invoice;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final bucket = isActive(invoice) ? invoiceBucket(invoice) : 'Annulee';
    final meta = ['${invoice['type'] ?? ''}', '${invoice['projectTitle'] ?? ''}'].where((t) => t.trim().isNotEmpty).join(' · ');
    return KojiCard(
      onTap: onTap,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${invoice['invoiceNumber'] ?? ''} · ${invoice['client'] ?? 'Client'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: p.heading),
                    ),
                    if (meta.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(meta, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: p.muted)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 10),
              InvoiceStatusPill(bucket),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Text(euro(amountOf(invoice)), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: p.heading)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  dueLabel(invoice),
                  textAlign: TextAlign.end,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12.5, color: bucket == 'Retard' ? p.toneFg(KojiTone.coral) : p.muted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Ligne libellé / valeur des résumés (`.kv` sur le site).
class FactureKv extends StatelessWidget {
  const FactureKv(this.label, this.value, {super.key, this.strong = false});
  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: p.lineSoft))),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(fontSize: 13.5, color: strong ? p.heading : p.muted, fontWeight: strong ? FontWeight.w700 : FontWeight.w500))),
          Text(value, style: TextStyle(fontSize: strong ? 15.5 : 14, fontWeight: strong ? FontWeight.w800 : FontWeight.w700, color: p.heading)),
        ],
      ),
    );
  }
}

Future<void> openInvoicePdf(BuildContext context, WidgetRef ref, Invoice invoice) async {
  try {
    final bytes = await ref.read(facturesRepositoryProvider).pdf(invoice);
    await Printing.sharePdf(bytes: bytes, filename: invoicePdfFilename(invoice));
  } catch (error) {
    if (context.mounted) showFacturesMessage(context, errorText(error));
  }
}

Future<T?> _sheet<T>(BuildContext context, Widget child) => showModalBottomSheet<T>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: context.koji.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(kojiRadius(20)))),
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: child,
      ),
    );

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: p.heading))),
              IconButton(
                tooltip: 'Fermer',
                onPressed: () => Navigator.of(context).pop(),
                icon: KojiIcon(KojiIcons.close, size: 18, color: p.muted),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }
}

/// Toutes les actions d'une facture (lignes dépliées du tableau web).
Future<void> showInvoiceActions(BuildContext context, WidgetRef ref, Invoice invoice, FacturesData data) {
  final status = '${invoice['status'] ?? ''}';
  final avoir = isCreditNote(invoice);
  final bucket = isActive(invoice) ? invoiceBucket(invoice) : 'Annulee';

  Future<void> act(String action, String done) async {
    Navigator.of(context).pop();
    try {
      await ref.read(facturesRepositoryProvider).update('${invoice['id']}', action);
      facturesChanged(ref);
      if (context.mounted) showFacturesMessage(context, done);
    } catch (error) {
      if (context.mounted) showFacturesMessage(context, errorText(error));
    }
  }

  return _sheet(
    context,
    Builder(builder: (sheetContext) {
      final p = sheetContext.koji;
      final number = '${invoice['invoiceNumber'] ?? ''}';
      return _SheetFrame(
        title: avoir ? 'Avoir $number' : 'Facture $number',
        children: [
          Row(children: [InvoiceStatusPill(bucket), const SizedBox(width: 10), Expanded(child: Text(dueLabel(invoice), style: TextStyle(fontSize: 13, color: p.muted)))]),
          const SizedBox(height: 12),
          FactureKv('Client', '${invoice['client'] ?? 'Client'}'),
          if ('${invoice['projectTitle'] ?? ''}'.isNotEmpty) FactureKv('Chantier', '${invoice['projectTitle']}'),
          FactureKv('Type', '${invoice['type'] ?? ''}'),
          if ('${invoice['quoteNumber'] ?? ''}'.isNotEmpty) FactureKv('Devis', '${invoice['quoteNumber']}'),
          FactureKv('Montant TTC', euro(amountOf(invoice)), strong: true),
          if ('${invoice['notes'] ?? ''}'.trim().isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('${invoice['notes']}', style: TextStyle(fontSize: 13, color: p.muted)),
          ],
          const SizedBox(height: 18),
          KojiButton(
            label: 'Télécharger le PDF',
            variant: KojiButtonVariant.secondary,
            leadingIcon: KojiIcons.download,
            expand: true,
            onPressed: () {
              Navigator.of(sheetContext).pop();
              openInvoicePdf(context, ref, invoice);
            },
          ),
          if (!avoir && status == 'Brouillon') ...[
            const SizedBox(height: 10),
            KojiButton(label: 'Émettre la facture', expand: true, onPressed: () => act('issue', 'Facture $number émise.')),
          ],
          if (!avoir && status == 'Emise') ...[
            const SizedBox(height: 10),
            KojiButton(label: 'Marquer payée', expand: true, onPressed: () => act('pay', 'Facture $number marquée payée.')),
            const SizedBox(height: 10),
            KojiButton(
              label: 'Relancer',
              variant: KojiButtonVariant.secondary,
              leadingIcon: KojiIcons.send,
              expand: true,
              onPressed: () {
                Navigator.of(sheetContext).pop();
                showReminderSheet(context, ref, invoice, data);
              },
            ),
          ],
          if (canCreditNote(invoice, data.invoices)) ...[
            const SizedBox(height: 10),
            KojiButton(
              label: 'Créer un avoir',
              variant: KojiButtonVariant.secondary,
              expand: true,
              onPressed: () {
                Navigator.of(sheetContext).pop();
                showCreditNoteSheet(context, ref, invoice, data);
              },
            ),
          ],
          if (!avoir && status == 'Brouillon') ...[
            const SizedBox(height: 10),
            KojiButton(label: 'Marquer payée', variant: KojiButtonVariant.secondary, expand: true, onPressed: () => act('pay', 'Facture $number marquée payée.')),
          ],
          if (!avoir && status != 'Annulee' && status != 'Payee') ...[
            const SizedBox(height: 4),
            TextButton(
              onPressed: () => act('cancel', 'Facture $number annulée.'),
              child: Text('Annuler la facture', style: TextStyle(color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
            ),
          ],
        ],
      );
    }),
  );
}

/// PRO-06.1 : avoir total ou partiel, puis « Refaire la facture corrigée ».
Future<void> showCreditNoteSheet(BuildContext context, WidgetRef ref, Invoice invoice, FacturesData data) async {
  final created = await _sheet<Invoice>(context, _CreditNoteSheet(invoice: invoice, data: data));
  if (created == null || !context.mounted) return;
  facturesChanged(ref);
  showFacturesMessage(context, 'Avoir ${created['invoiceNumber']} créé sur la facture ${invoice['invoiceNumber']}.');
  if ('${invoice['quoteId'] ?? ''}'.isEmpty) return;
  await _sheet(
    context,
    Builder(builder: (sheetContext) {
      final p = sheetContext.koji;
      return _SheetFrame(
        title: 'Avoir ${created['invoiceNumber']} créé',
        children: [
          Text(
            '${euro(amountOf(created))} TTC sur la facture ${invoice['invoiceNumber']}. Le montant redevient facturable sur le devis ${invoice['quoteNumber'] ?? ''}.',
            style: TextStyle(fontSize: 14, color: p.muted, height: 1.4),
          ),
          const SizedBox(height: 18),
          KojiButton(
            label: 'Refaire la facture corrigée',
            expand: true,
            onPressed: () {
              Navigator.of(sheetContext).pop();
              context.push(nouvelleFactureRoute, extra: {
                'quoteId': invoice['quoteId'],
                'type': invoice['type'],
                'amountMode': 'fixed',
                'fixedAmount': -amountOf(created),
                'notes': 'Remplace la facture ${invoice['invoiceNumber']} (avoir ${created['invoiceNumber']})',
              });
            },
          ),
          const SizedBox(height: 10),
          KojiButton(
            label: 'PDF de l\'avoir',
            variant: KojiButtonVariant.secondary,
            leadingIcon: KojiIcons.download,
            expand: true,
            onPressed: () {
              Navigator.of(sheetContext).pop();
              openInvoicePdf(context, ref, created);
            },
          ),
        ],
      );
    }),
  );
}

class _CreditNoteSheet extends ConsumerStatefulWidget {
  const _CreditNoteSheet({required this.invoice, required this.data});
  final Invoice invoice;
  final FacturesData data;

  @override
  ConsumerState<_CreditNoteSheet> createState() => _CreditNoteSheetState();
}

class _CreditNoteSheetState extends ConsumerState<_CreditNoteSheet> {
  String _reason = 'erreur';
  bool _partial = false;
  bool _busy = false;
  String _error = '';
  final _amount = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit(double remaining) async {
    double? amount;
    if (_partial) {
      amount = double.tryParse(_amount.text.replaceAll(',', '.').trim());
      if (amount == null || amount <= 0 || amount > remaining + 0.01) {
        setState(() => _error = 'Le montant de l\'avoir doit être compris entre 0,01 et ${euro(remaining)} TTC.');
        return;
      }
    }
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final created = await ref.read(facturesRepositoryProvider).creditNote(widget.invoice, reason: _reason, amount: amount, notes: _notes.text.trim());
      if (mounted) Navigator.of(context).pop(created);
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = errorText(error);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final invoice = widget.invoice;
    final credited = creditedOn(invoice, widget.data.invoices);
    final remaining = toAmount(amountOf(invoice) - credited);
    return _SheetFrame(
      title: 'Créer un avoir',
      children: [
        FactureKv('Facture d\'origine', '${invoice['invoiceNumber']} · émise le ${shortDay(invoice['issuedAt'] ?? invoice['createdAt'])}'),
        FactureKv('Montant TTC', euro(amountOf(invoice))),
        if (credited > 0) FactureKv('Déjà couvert par avoir', euro(credited)),
        const SizedBox(height: 14),
        Text('Motif', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: p.heading)),
        const SizedBox(height: 8),
        KojiFilterChips<String>(options: creditReasons, value: _reason, onChanged: (v) => setState(() => _reason = v)),
        const SizedBox(height: 16),
        KojiSegmented<bool>(
          compact: true,
          options: {false: 'Total · ${euro(remaining)}', true: 'Partiel'},
          value: _partial,
          onChanged: (v) => setState(() => _partial = v),
        ),
        if (_partial) ...[
          const SizedBox(height: 14),
          KojiField(
            label: 'Montant de l\'avoir TTC',
            controller: _amount,
            hint: 'Ex : 250',
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),
        ],
        const SizedBox(height: 14),
        KojiField(label: 'Note (sur l\'avoir)', controller: _notes, maxLines: 2),
        const SizedBox(height: 12),
        Text(
          'Numéroté dans la série AV, avec le numéro et la date de la facture d\'origine. Si la facture était payée, le remboursement reste à faire.',
          style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.4),
        ),
        if (_error.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(_error, style: TextStyle(fontSize: 13, color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
        ],
        const SizedBox(height: 18),
        KojiButton(label: 'Créer l\'avoir', expand: true, loading: _busy, onPressed: () => _submit(remaining)),
      ],
    );
  }
}

/// PRO-06.2 : relance aimable / ferme par e-mail, mise en demeure notée.
Future<void> showReminderSheet(BuildContext context, WidgetRef ref, Invoice invoice, FacturesData data) async {
  final message = await _sheet<String>(context, _ReminderSheet(invoice: invoice, company: data.company));
  if (message == null || !context.mounted) return;
  facturesChanged(ref);
  showFacturesMessage(context, message);
}

class _ReminderSheet extends ConsumerStatefulWidget {
  const _ReminderSheet({required this.invoice, required this.company});
  final Invoice invoice;
  final String company;

  @override
  ConsumerState<_ReminderSheet> createState() => _ReminderSheetState();
}

class _ReminderSheetState extends ConsumerState<_ReminderSheet> {
  late Invoice _invoice = widget.invoice;
  late String _level = suggestedLevel(_invoice);
  late final _text = TextEditingController(text: reminderText(_level, _invoice, company: widget.company));
  bool _busy = false;
  String _error = '';

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _pickLevel(String level) => setState(() {
        _level = level;
        _text.text = reminderText(level, _invoice, company: widget.company);
      });

  Future<void> _send(String channel) async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final updated = await ref.read(facturesRepositoryProvider).remind(_invoice, level: _level, channel: channel, text: _text.text);
      if (!mounted) return;
      Navigator.of(context).pop(channel == 'email'
          ? 'Relance envoyée à ${updated['clientEmail']}.'
          : 'Relance notée sur la facture ${updated['invoiceNumber']}.');
    } catch (error) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = errorText(error);
        });
      }
    }
  }

  Future<void> _toggleReminders() async {
    try {
      final updated = await ref.read(facturesRepositoryProvider).update('${_invoice['id']}', _invoice['remindersOff'] == true ? 'reminders-on' : 'reminders-off');
      ref.invalidate(facturesProvider);
      if (mounted) setState(() => _invoice = updated);
    } catch (error) {
      if (mounted) setState(() => _error = errorText(error));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final invoice = _invoice;
    final email = '${invoice['clientEmail'] ?? ''}';
    final late = daysLate(invoice);
    final reminders = remindersOf(invoice);
    return _SheetFrame(
      title: 'Relancer ${invoice['invoiceNumber']}',
      children: [
        FactureKv('Client', '${invoice['client'] ?? 'Client'}'),
        FactureKv('E-mail', email.isEmpty ? 'pas d\'e-mail sur la facture' : email),
        FactureKv('Montant TTC', euro(amountOf(invoice)), strong: true),
        FactureKv('Retard', late > 0 ? '$late jours de retard' : 'échéance le ${shortDay(invoice['dueDate'])}'),
        if (reminders.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            'Déjà relancée : ${reminders.map((r) => '${(reminderLevels[r['level']] ?? '${r['level']}').toLowerCase()} le ${shortDay(r['at'])} (${channelLabels[r['channel']] ?? r['channel']})').join(' · ')}',
            style: TextStyle(fontSize: 12.5, color: p.muted, height: 1.4),
          ),
        ],
        if (invoice['remindersOff'] == true) ...[
          const SizedBox(height: 10),
          const KojiAlertBox(title: 'Relances désactivées', message: 'Cette facture ne sera pas relancée.', tone: KojiTone.grey),
        ],
        const SizedBox(height: 14),
        KojiFilterChips<String>(options: reminderLevels, value: _level, onChanged: _pickLevel),
        const SizedBox(height: 6),
        Text(reminderHints[_level] ?? '', style: TextStyle(fontSize: 12, color: p.faint)),
        const SizedBox(height: 12),
        KojiField(
          label: _level == 'demeure' ? 'Courrier à envoyer en recommandé avec accusé de réception' : 'Message (la facture est jointe à l\'e-mail)',
          controller: _text,
          maxLines: 10,
          onChanged: (_) => setState(() {}),
        ),
        if (_error.isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(_error, style: TextStyle(fontSize: 13, color: p.toneFg(KojiTone.coral), fontWeight: FontWeight.w600)),
        ],
        const SizedBox(height: 18),
        if (_level == 'demeure')
          KojiButton(label: 'Noter l\'envoi en recommandé', expand: true, loading: _busy, onPressed: () => _send('manuel'))
        else ...[
          KojiButton(
            label: 'Envoyer par e-mail',
            leadingIcon: KojiIcons.mail,
            expand: true,
            loading: _busy,
            onPressed: email.isEmpty || _text.text.trim().isEmpty ? null : () => _send('email'),
          ),
          const SizedBox(height: 10),
          KojiButton(label: 'Noter comme relancée', variant: KojiButtonVariant.secondary, expand: true, onPressed: _busy ? null : () => _send('manuel')),
        ],
        const SizedBox(height: 10),
        KojiButton(
          label: 'Copier le texte',
          variant: KojiButtonVariant.secondary,
          expand: true,
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: _text.text));
            if (context.mounted) showFacturesMessage(context, 'Texte copié.');
          },
        ),
        TextButton(
          onPressed: _toggleReminders,
          child: Text(
            invoice['remindersOff'] == true ? 'Réactiver les relances' : 'Ne pas relancer cette facture',
            style: TextStyle(color: p.heading, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
          ),
        ),
      ],
    );
  }
}
