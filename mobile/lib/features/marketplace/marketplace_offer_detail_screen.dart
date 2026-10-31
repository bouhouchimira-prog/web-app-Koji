import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing/printing.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/marketplace_status.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

const _stepLabel = {
  'acompte': 'Acompte',
  'avancement': 'Avancement',
  'solde': 'Solde',
};
const _paiementStatusLabel = {
  'pending': 'À payer',
  'paid_platform': 'Payé — en attente des photos de l\'entreprise',
  'released': 'Débloqué',
};

String _euro(num value) {
  final whole = value.round().toString();
  final buf = StringBuffer();
  for (var i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buf.write(' ');
    buf.write(whole[i]);
  }
  return '$buf €';
}

/// One thread per entreprise — built client-side by grouping the offer's
/// messages by entrepriseUserId, exactly like the web (there is no separate
/// "conversations" endpoint, see app/client/radar/[id]/page.jsx).
class _Conversation {
  _Conversation(this.entrepriseUserId);
  final String entrepriseUserId;
  Map<String, dynamic>? snapshot;
  final List<Map<String, dynamic>> messages = [];
}

List<_Conversation> _groupConversations(List<Map<String, dynamic>> messages) {
  final byEntreprise = <String, _Conversation>{};
  for (final m in messages) {
    final id = m['entrepriseUserId'] as String;
    final conv = byEntreprise.putIfAbsent(id, () => _Conversation(id));
    conv.messages.add(m);
    if (m['entrepriseSnapshot'] != null) {
      conv.snapshot = m['entrepriseSnapshot'] as Map<String, dynamic>;
    }
  }
  final list = byEntreprise.values.toList();
  list.sort((a, b) {
    final aLast = (a.messages.isEmpty ? '' : a.messages.last['createdAt']) as String? ?? '';
    final bLast = (b.messages.isEmpty ? '' : b.messages.last['createdAt']) as String? ?? '';
    return bLast.compareTo(aLast);
  });
  return list;
}

/// Detail of one published chantier: its own info, the entreprises that
/// positioned themselves, and (main addition) the per-entreprise
/// conversations — messagerie, RDV, autorisation photos, paiement échelonné.
/// Gabarit web : app/client/radar/[id]/page.jsx, lu en entier.
class MarketplaceOfferDetailScreen extends ConsumerWidget {
  const MarketplaceOfferDetailScreen({super.key, required this.offerId});

  final String offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offerAsync = ref.watch(marketplaceOfferDetailProvider(offerId));

    return offerAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator(strokeWidth: 2)),
      ),
      error: (err, _) => Scaffold(
        appBar: AppBar(),
        body: Center(
          child: KojiEmptyState(
            icon: KojiIcons.alert,
            title: 'Impossible de charger ce chantier',
            subtitle: '$err',
            action: KojiButton(
              label: 'Réessayer',
              variant: KojiButtonVariant.secondary,
              onPressed: () =>
                  ref.invalidate(marketplaceOfferDetailProvider(offerId)),
            ),
          ),
        ),
      ),
      data: (offer) => _OfferDetailBody(offerId: offerId, offer: offer),
    );
  }
}

class _OfferDetailBody extends ConsumerStatefulWidget {
  const _OfferDetailBody({required this.offerId, required this.offer});

  final String offerId;
  final Map<String, dynamic> offer;

  @override
  ConsumerState<_OfferDetailBody> createState() => _OfferDetailBodyState();
}

class _OfferDetailBodyState extends ConsumerState<_OfferDetailBody> {
  String? _activeEntrepriseId;
  final _draftController = TextEditingController();
  bool _sending = false;
  bool _showRdvForm = false;
  DateTime? _rdvDate;
  String? _error;

  @override
  void dispose() {
    _draftController.dispose();
    super.dispose();
  }

  String get offerId => widget.offerId;

  void _refresh() {
    ref.invalidate(marketplaceOfferDetailProvider(offerId));
    ref.invalidate(marketplaceOfferPositionsProvider(offerId));
    ref.invalidate(marketplaceOfferMessagesProvider(offerId));
    ref.invalidate(marketplaceOfferPaiementsProvider(offerId));
  }

  Future<void> _send() async {
    final text = _draftController.text.trim();
    final entrepriseUserId = _activeEntrepriseId;
    if (text.isEmpty || entrepriseUserId == null || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(marketplaceRepositoryProvider).sendMessage(
            offerId,
            entrepriseUserId: entrepriseUserId,
            message: text,
          );
      _draftController.clear();
      ref.invalidate(marketplaceOfferMessagesProvider(offerId));
    } catch (err) {
      setState(() => _error = err is KojiWebApiException
          ? err.message
          : "Erreur lors de l'envoi.");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _proposeRdv() async {
    final entrepriseUserId = _activeEntrepriseId;
    if (_rdvDate == null || entrepriseUserId == null || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(marketplaceRepositoryProvider).proposeRdv(
            offerId,
            entrepriseUserId: entrepriseUserId,
            rdvDate: _rdvDate!,
          );
      setState(() {
        _showRdvForm = false;
        _rdvDate = null;
      });
      ref.invalidate(marketplaceOfferMessagesProvider(offerId));
    } catch (err) {
      setState(() => _error =
          err is KojiWebApiException ? err.message : "Erreur lors de l'envoi.");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _respondRdv(String proposalId, bool accepted) async {
    final entrepriseUserId = _activeEntrepriseId;
    if (entrepriseUserId == null || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(marketplaceRepositoryProvider).respondRdv(
            offerId,
            entrepriseUserId: entrepriseUserId,
            respondsToId: proposalId,
            accepted: accepted,
          );
      ref.invalidate(marketplaceOfferMessagesProvider(offerId));
    } catch (err) {
      setState(() => _error =
          err is KojiWebApiException ? err.message : "Erreur lors de l'envoi.");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _grantPhotos() async {
    final entrepriseUserId = _activeEntrepriseId;
    if (entrepriseUserId == null || _sending) return;
    setState(() => _sending = true);
    try {
      await ref.read(marketplaceRepositoryProvider).grantPhotos(
            offerId,
            entrepriseUserId: entrepriseUserId,
          );
      ref.invalidate(marketplaceOfferMessagesProvider(offerId));
    } catch (err) {
      setState(() => _error =
          err is KojiWebApiException ? err.message : "Erreur lors de l'envoi.");
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _openEntrepriseCard(String entrepriseUserId) async {
    try {
      final bytes = await ref
          .read(marketplaceRepositoryProvider)
          .getEntrepriseCardPdf(offerId, entrepriseUserId: entrepriseUserId);
      await Printing.layoutPdf(onLayout: (format) async => bytes);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : "Impossible d'ouvrir la carte de visite."),
      ));
    }
  }

  Future<void> _payStep(String paiementId) async {
    try {
      final url = await ref
          .read(marketplaceRepositoryProvider)
          .checkoutPaiement(offerId, paiementId);
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : 'Erreur lors du paiement.'),
      ));
    }
  }

  Future<void> _validateStep(String paiementId) async {
    try {
      await ref
          .read(marketplaceRepositoryProvider)
          .validatePaiement(offerId, paiementId);
      ref.invalidate(marketplaceOfferPaiementsProvider(offerId));
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(err is KojiWebApiException
            ? err.message
            : 'Erreur lors de la validation.'),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final offer = widget.offer;
    final status = offer['status'] as String?;
    final metier = (offer['metier'] as String?)?.trim();
    final description = (offer['description'] as String?)?.trim() ?? '';
    final ouvrages = offer['ouvrages'] as List? ?? const [];
    final delai = offer['delaiEstimeJours'];
    final addressParts = [
      offer['address'],
      offer['postalCode'],
      offer['city'],
    ].whereType<String>().where((s) => s.trim().isNotEmpty).join(', ');

    final positionsAsync = ref.watch(marketplaceOfferPositionsProvider(offerId));
    final positions = positionsAsync.valueOrNull ?? const [];
    final messagesAsync = ref.watch(marketplaceOfferMessagesProvider(offerId));
    final messages = messagesAsync.valueOrNull ?? const <Map<String, dynamic>>[];
    final conversations = _groupConversations(messages);
    final positionedIds =
        positions.map((p) => p['entrepriseUserId'] as String?).toSet();
    _Conversation? active;
    if (_activeEntrepriseId != null) {
      for (final c in conversations) {
        if (c.entrepriseUserId == _activeEntrepriseId) {
          active = c;
          break;
        }
      }
    }

    return KojiPage(
      title: metier?.isNotEmpty == true ? metier! : 'Chantier',
      subtitle: addressParts.isEmpty ? null : addressParts,
      appBarOnPhone: true,
      onRefresh: () async => _refresh(),
      top: [
        Row(
          children: [
            KojiPill(
              marketplaceStatusLabel(status),
              tone: marketplaceStatusTone(status),
            ),
            if (delai != null) ...[
              const SizedBox(width: 10),
              KojiIcon(KojiIcons.clock, size: 14, color: p.muted),
              const SizedBox(width: 5),
              Text(
                '$delai jours estimés',
                style: TextStyle(fontSize: 13, color: p.muted),
              ),
            ],
          ],
        ),
      ],
      main: [
        if (description.isNotEmpty)
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const KojiSectionTitle('Description'),
                const SizedBox(height: 10),
                Text(
                  description,
                  style: TextStyle(fontSize: 14, height: 1.5, color: p.ink),
                ),
              ],
            ),
          ),
        if (ouvrages.isNotEmpty) const SizedBox(height: 12),
        if (ouvrages.isNotEmpty)
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const KojiSectionTitle('Ouvrages'),
                const SizedBox(height: 10),
                for (final (i, o) in ouvrages.indexed) ...[
                  if (i > 0) const Divider(height: 20),
                  _OuvrageRow(ouvrage: o as Map<String, dynamic>),
                ],
              ],
            ),
          ),
        const SizedBox(height: 12),
        if (active == null)
          _ConversationsList(
            loading: messagesAsync.isLoading,
            conversations: conversations,
            positionedIds: positionedIds,
            onOpen: (id) => setState(() {
              _activeEntrepriseId = id;
              _error = null;
            }),
          )
        else
          _ActiveConversation(
            offerId: offerId,
            conversation: active,
            offerPhotos: (offer['photos'] as List? ?? const []).cast<String>(),
            draftController: _draftController,
            sending: _sending,
            showRdvForm: _showRdvForm,
            rdvDate: _rdvDate,
            error: _error,
            onBack: () => setState(() => _activeEntrepriseId = null),
            onSend: _send,
            onToggleRdvForm: () => setState(() => _showRdvForm = !_showRdvForm),
            onRdvDateChanged: (d) => setState(() => _rdvDate = d),
            onProposeRdv: _proposeRdv,
            onRespondRdv: _respondRdv,
            onGrantPhotos: _grantPhotos,
            onOpenCard: () => _openEntrepriseCard(_activeEntrepriseId!),
            onPayStep: _payStep,
            onValidateStep: _validateStep,
          ),
      ],
      side: [
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const KojiSectionTitle('Entreprises positionnées'),
              const SizedBox(height: 10),
              positionsAsync.when(
                loading: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Center(
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
                error: (err, _) => Text(
                  'Impossible de charger les positionnements.',
                  style: TextStyle(fontSize: 13, color: p.muted),
                ),
                data: (_) => positions.isEmpty
                    ? Text(
                        'Aucune entreprise positionnée pour le moment.',
                        style: TextStyle(fontSize: 13, color: p.muted),
                      )
                    : Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final (i, pos) in positions.indexed) ...[
                            if (i > 0) const Divider(height: 18),
                            _PositionRow(position: pos),
                          ],
                        ],
                      ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ConversationsList extends StatelessWidget {
  const _ConversationsList({
    required this.loading,
    required this.conversations,
    required this.positionedIds,
    required this.onOpen,
  });

  final bool loading;
  final List<_Conversation> conversations;
  final Set<String?> positionedIds;
  final ValueChanged<String> onOpen;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return KojiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const KojiSectionTitle('Entreprises qui vous ont contacté'),
          const SizedBox(height: 10),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (conversations.isEmpty)
            Text(
              'Aucune entreprise ne vous a encore contacté pour ce chantier.',
              style: TextStyle(fontSize: 13, color: p.muted),
            )
          else
            for (final (i, conv) in conversations.indexed) ...[
              if (i > 0) const Divider(height: 18),
              InkWell(
                onTap: () => onOpen(conv.entrepriseUserId),
                borderRadius: BorderRadius.circular(10),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      KojiAvatar(
                        (conv.snapshot?['raisonSociale'] as String?) ??
                            'Entreprise',
                        size: 36,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    (conv.snapshot?['raisonSociale']
                                            as String?) ??
                                        'Entreprise',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: p.heading,
                                    ),
                                  ),
                                ),
                                if (positionedIds.contains(conv.entrepriseUserId)) ...[
                                  const SizedBox(width: 6),
                                  const KojiPill('Positionnée', tone: KojiTone.info),
                                ],
                              ],
                            ),
                            if (conv.messages.isNotEmpty)
                              Text(
                                '${conv.messages.last['message'] ?? ''}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 12.5, color: p.muted),
                              ),
                          ],
                        ),
                      ),
                      KojiIcon(KojiIcons.chevronRight, size: 16, color: p.muted),
                    ],
                  ),
                ),
              ),
            ],
        ],
      ),
    );
  }
}

class _ActiveConversation extends ConsumerWidget {
  const _ActiveConversation({
    required this.offerId,
    required this.conversation,
    required this.offerPhotos,
    required this.draftController,
    required this.sending,
    required this.showRdvForm,
    required this.rdvDate,
    required this.error,
    required this.onBack,
    required this.onSend,
    required this.onToggleRdvForm,
    required this.onRdvDateChanged,
    required this.onProposeRdv,
    required this.onRespondRdv,
    required this.onGrantPhotos,
    required this.onOpenCard,
    required this.onPayStep,
    required this.onValidateStep,
  });

  final String offerId;
  final _Conversation conversation;
  final List<String> offerPhotos;
  final TextEditingController draftController;
  final bool sending;
  final bool showRdvForm;
  final DateTime? rdvDate;
  final String? error;
  final VoidCallback onBack;
  final VoidCallback onSend;
  final VoidCallback onToggleRdvForm;
  final ValueChanged<DateTime> onRdvDateChanged;
  final VoidCallback onProposeRdv;
  final void Function(String proposalId, bool accepted) onRespondRdv;
  final VoidCallback onGrantPhotos;
  final VoidCallback onOpenCard;
  final void Function(String paiementId) onPayStep;
  final void Function(String paiementId) onValidateStep;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = context.koji;
    final snapshot = conversation.snapshot;
    final name = (snapshot?['raisonSociale'] as String?) ?? 'Entreprise';
    final messages = conversation.messages;
    final respondedIds = messages
        .map((m) => m['respondsToId'] as String?)
        .whereType<String>()
        .toSet();
    final hasPhotoRequest = messages.any((m) => m['kind'] == 'photo_request');
    final hasPhotoGrant = messages.any((m) => m['kind'] == 'photo_grant');
    final paiementsAsync = ref.watch(marketplaceOfferPaiementsProvider(offerId));
    final paiements = (paiementsAsync.valueOrNull ?? const [])
        .where((pmt) => pmt['entrepriseUserId'] == conversation.entrepriseUserId)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextButton.icon(
          onPressed: onBack,
          icon: KojiIcon(KojiIcons.back, size: 14, color: p.heading),
          label: const Text('Toutes les entreprises'),
          style: TextButton.styleFrom(alignment: Alignment.centerLeft),
        ),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: p.heading,
                ),
              ),
              if ((snapshot?['address'] as String?)?.isNotEmpty == true) ...[
                const SizedBox(height: 4),
                Text(snapshot!['address'] as String,
                    style: TextStyle(fontSize: 12.5, color: p.muted)),
              ],
              if (snapshot?['isPro'] == true) ...[
                const SizedBox(height: 12),
                KojiButton(
                  label: 'Carte de visite Koji',
                  variant: KojiButtonVariant.secondary,
                  leadingIcon: KojiIcons.contacts,
                  onPressed: onOpenCard,
                ),
              ],
            ],
          ),
        ),
        if (paiements.isNotEmpty) ...[
          const SizedBox(height: 12),
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const KojiSectionTitle('Paiement échelonné'),
                const SizedBox(height: 10),
                for (final (i, pmt) in paiements.indexed) ...[
                  if (i > 0) const Divider(height: 18),
                  _PaiementRow(
                    paiement: pmt,
                    onPay: () => onPayStep(pmt['id'] as String),
                    onValidate: () => onValidateStep(pmt['id'] as String),
                  ),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        KojiCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  KojiIcon(KojiIcons.messages, size: 18, color: p.heading),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Discussion interne Koji',
                            style: TextStyle(
                                fontWeight: FontWeight.w700, color: p.heading)),
                        Text(
                          "Vos échanges restent sur Koji tant que le rendez-vous"
                          " n'est pas confirmé.",
                          style: TextStyle(fontSize: 11.5, color: p.muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              for (final m in messages)
                _MessageBubble(
                  message: m,
                  canRespondRdv: m['kind'] == 'rdv_proposal' &&
                      m['senderType'] == 'entreprise' &&
                      !respondedIds.contains(m['id']),
                  onAccept: () => onRespondRdv(m['id'] as String, true),
                  onDecline: () => onRespondRdv(m['id'] as String, false),
                ),
              if (offerPhotos.isNotEmpty && hasPhotoRequest && !hasPhotoGrant) ...[
                const SizedBox(height: 4),
                KojiButton(
                  label: 'Débloquer mes photos pour $name',
                  variant: KojiButtonVariant.secondary,
                  leadingIcon: KojiIcons.eye,
                  expand: true,
                  onPressed: sending ? null : onGrantPhotos,
                ),
              ],
              const SizedBox(height: 10),
              if (showRdvForm)
                _RdvForm(
                  value: rdvDate,
                  onChanged: onRdvDateChanged,
                  onSubmit: rdvDate == null || sending ? null : onProposeRdv,
                  onCancel: onToggleRdvForm,
                )
              else
                KojiButton(
                  label: 'Proposer un rendez-vous',
                  variant: KojiButtonVariant.secondary,
                  leadingIcon: KojiIcons.calendrier,
                  expand: true,
                  onPressed: onToggleRdvForm,
                ),
              if (error != null) ...[
                const SizedBox(height: 10),
                Text(error!, style: const TextStyle(color: Colors.red)),
              ],
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: KojiField(
                      label: '',
                      controller: draftController,
                      hint: 'Écrire un message…',
                      textInputAction: TextInputAction.send,
                      onSubmitted: sending ? null : (_) => onSend(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton(
                    onPressed: sending ? null : onSend,
                    icon: KojiIcon(KojiIcons.send, color: p.primary),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.canRespondRdv,
    required this.onAccept,
    required this.onDecline,
  });

  final Map<String, dynamic> message;
  final bool canRespondRdv;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final fromParticulier = message['senderType'] == 'particulier';
    return Align(
      alignment: fromParticulier ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        constraints: const BoxConstraints(maxWidth: 260),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: fromParticulier ? p.primary : p.surfaceMuted,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${message['message'] ?? ''}',
              style: TextStyle(
                color: fromParticulier ? p.onPrimary : p.ink,
                height: 1.4,
              ),
            ),
            if (canRespondRdv) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  TextButton(onPressed: onAccept, child: const Text('Accepter')),
                  TextButton(onPressed: onDecline, child: const Text('Refuser')),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _RdvForm extends StatelessWidget {
  const _RdvForm({
    required this.value,
    required this.onChanged,
    required this.onSubmit,
    required this.onCancel,
  });

  final DateTime? value;
  final ValueChanged<DateTime> onChanged;
  final VoidCallback? onSubmit;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton(
            onPressed: () async {
              final now = DateTime.now();
              final date = await showDatePicker(
                context: context,
                initialDate: value ?? now,
                firstDate: now,
                lastDate: now.add(const Duration(days: 365)),
              );
              if (date == null || !context.mounted) return;
              final time = await showTimePicker(
                context: context,
                initialTime: TimeOfDay.fromDateTime(value ?? now),
              );
              if (time == null) return;
              onChanged(DateTime(
                  date.year, date.month, date.day, time.hour, time.minute));
            },
            child: Text(
              value == null
                  ? 'Choisir une date'
                  : '${value!.day}/${value!.month}/${value!.year} '
                      '${value!.hour.toString().padLeft(2, '0')}:'
                      '${value!.minute.toString().padLeft(2, '0')}',
            ),
          ),
        ),
        const SizedBox(width: 8),
        KojiButton(label: 'Proposer', onPressed: onSubmit, height: 42),
        IconButton(onPressed: onCancel, icon: const KojiIcon(KojiIcons.close, size: 16)),
      ],
    );
  }
}

class _PaiementRow extends StatelessWidget {
  const _PaiementRow({
    required this.paiement,
    required this.onPay,
    required this.onValidate,
  });

  final Map<String, dynamic> paiement;
  final VoidCallback onPay;
  final VoidCallback onValidate;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final step = paiement['step'] as String?;
    final amount = (paiement['amountTtc'] as num?) ?? 0;
    final status = paiement['status'] as String?;
    final photos = (paiement['photos'] as List?) ?? const [];
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_stepLabel[step] ?? step ?? '',
                  style: TextStyle(fontWeight: FontWeight.w700, color: p.ink)),
              Text(
                '${_euro(amount)} · ${_paiementStatusLabel[status] ?? status ?? ''}',
                style: TextStyle(fontSize: 12.5, color: p.muted),
              ),
            ],
          ),
        ),
        if (status == 'pending')
          KojiButton(label: 'Payer', onPressed: onPay, height: 40),
        if (status == 'paid_platform' && photos.isNotEmpty)
          KojiButton(label: 'Valider', onPressed: onValidate, height: 40),
      ],
    );
  }
}

class _OuvrageRow extends StatelessWidget {
  const _OuvrageRow({required this.ouvrage});

  final Map<String, dynamic> ouvrage;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final room = (ouvrage['room'] as String?)?.trim();
    final postes = ouvrage['postes'] as List? ?? const [];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (room?.isNotEmpty == true)
          Text(
            room!,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              color: p.heading,
            ),
          ),
        const SizedBox(height: 4),
        for (final poste in postes)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(
              '• ${poste is Map ? (poste['label'] ?? poste) : poste}',
              style: TextStyle(fontSize: 13, color: p.muted),
            ),
          ),
      ],
    );
  }
}

class _PositionRow extends StatelessWidget {
  const _PositionRow({required this.position});

  final Map<String, dynamic> position;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final snapshot = position['entrepriseSnapshot'] as Map<String, dynamic>?;
    final name = (snapshot?['raisonSociale'] as String?) ?? 'Une entreprise';
    final phone = (snapshot?['phone'] as String?)?.trim();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        KojiAvatar(name, size: 36),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: p.heading,
                ),
              ),
              if (phone?.isNotEmpty == true)
                Text(
                  phone!,
                  style: TextStyle(fontSize: 12.5, color: p.muted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
