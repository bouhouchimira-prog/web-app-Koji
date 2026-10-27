import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';
import 'package:koji/features/marketplace/marketplace_address.dart';
import 'package:koji/features/marketplace/marketplace_choice_list.dart';
import 'package:koji/features/marketplace/providers/marketplace_providers.dart';
import 'package:koji/features/marketplace/repository/marketplace_repository.dart';

enum _Phase { hero, chat, recap, result }

enum _Mode { ia, manuel }

class _Turn {
  _Turn({required this.role, required this.text, this.photos = const []});
  final String role; // 'user' | 'assistant'
  final String text;
  final List<String> photos;
}

/// AI publishing assistant + manual form — port of app/client/radar/new/
/// page.jsx's "Offre IA" and "Saisie libre" tabs. The assistant itself
/// (lib/radar-chat-prompt.js / lib/radar-assistant-tools.js) stays entirely
/// server-side on koji-web — this screen only renders what the SSE stream
/// sends and relays what the particulier types/picks, exactly like the web
/// page's own sendToEngine().
class MarketplaceNewScreen extends ConsumerStatefulWidget {
  const MarketplaceNewScreen({super.key});

  @override
  ConsumerState<MarketplaceNewScreen> createState() =>
      _MarketplaceNewScreenState();
}

class _MarketplaceNewScreenState extends ConsumerState<MarketplaceNewScreen> {
  _Phase _phase = _Phase.hero;
  _Mode _mode = _Mode.ia;
  final _manualDescriptionController = TextEditingController();
  final _manualAddressController = TextEditingController();
  late String _conversationId;
  String? _draftId;
  final List<_Turn> _turns = [];
  String _streamingText = '';
  Map<String, dynamic>? _pendingChoice;
  Map<String, dynamic>? _pendingPhotoRequest;
  List<String> _pendingPhotos = [];
  bool _sending = false;
  String? _error;
  StreamSubscription<SseEvent>? _sub;

  // Recap (set once the assistant calls terminer_collecte).
  Map<String, dynamic> _draftAnswers = {};
  String _metier = '';
  final _addressController = TextEditingController();
  bool _geocoding = false;
  MarketplaceAddress? _address;

  // Result (after /api/expertise-koji).
  Map<String, dynamic>? _expertise;
  final Set<String> _selectedConseils = {};
  final Map<String, TextEditingController> _missingPriceControllers = {};
  bool _submittingPrices = false;
  bool _publishing = false;

  final _draftController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _conversationId =
        'radarconv-mobile-${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _sub?.cancel();
    _addressController.dispose();
    _draftController.dispose();
    _scrollController.dispose();
    _manualDescriptionController.dispose();
    _manualAddressController.dispose();
    for (final c in _missingPriceControllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
      );
    });
  }

  void _openChat() {
    setState(() {
      _error = null;
      _turns.clear();
      _draftId = null;
      _draftAnswers = {};
      _pendingChoice = null;
      _pendingPhotoRequest = null;
      _phase = _Phase.chat;
    });
    _sendToEngine([_Turn(role: 'user', text: 'Bonjour')], const []);
  }

  // "Saisie libre" — no AI conversation: the particulier fills the project
  // description and address directly, then reuses the exact same recap/
  // expertise/publish flow as the "Offre IA" tab (gabarit web : mode
  // "manuel" de app/client/radar/new/page.jsx, launchExpertise()).
  void _startManual() {
    final description = _manualDescriptionController.text.trim();
    final address = _manualAddressController.text.trim();
    if (description.isEmpty) {
      setState(() => _error = 'Décrivez les travaux à réaliser.');
      return;
    }
    if (address.isEmpty) {
      setState(() => _error = "L'adresse du chantier est obligatoire.");
      return;
    }
    setState(() {
      _error = null;
      _draftAnswers = {'intro': description};
      _metier = "Tout corps d'état";
      _addressController.text = address;
      _phase = _Phase.recap;
    });
  }

  Future<void> _sendToEngine(
    List<_Turn> nextTurns,
    List<String> photosForThisTurn,
  ) async {
    setState(() {
      _sending = true;
      _error = null;
      _streamingText = '';
      _pendingPhotoRequest = null;
    });
    final repo = ref.read(marketplaceRepositoryProvider);
    final api = ref.read(kojiWebApiClientProvider);
    var liveText = '';
    var uiHandled = false;
    await _sub?.cancel();
    try {
      _sub = repo
          .sendChatTurn(
            turns: nextTurns
                .map((t) => {'role': t.role, 'text': t.text})
                .toList(),
            conversationId: _conversationId,
            draftId: _draftId,
            photos: photosForThisTurn,
            prenom: api.accountFirstName,
          )
          .listen(
            (event) {
              switch (event.event) {
                case 'delta':
                  liveText += (event.data['text'] as String?) ?? '';
                  setState(() => _streamingText = liveText);
                  _scrollToBottom();
                case 'choice':
                  final ack = liveText.trim();
                  final question = (event.data['question'] as String?) ?? '';
                  setState(() {
                    if (ack.isNotEmpty) {
                      _turns.add(_Turn(role: 'assistant', text: ack));
                    }
                    if (question.isNotEmpty) {
                      _turns.add(_Turn(role: 'assistant', text: question));
                    }
                    liveText = '';
                    uiHandled = true;
                    _streamingText = '';
                    _pendingChoice = event.data;
                  });
                  _scrollToBottom();
                case 'photo-request':
                  final ack = liveText.trim();
                  setState(() {
                    if (ack.isNotEmpty) {
                      _turns.add(_Turn(role: 'assistant', text: ack));
                    }
                    liveText = '';
                    uiHandled = true;
                    _streamingText = '';
                    _pendingPhotoRequest = event.data;
                  });
                  _scrollToBottom();
                case 'done':
                  final draftId = event.data['draftId'] as String?;
                  final finished = event.data['finished'] == true;
                  final finalMessage = uiHandled
                      ? ''
                      : ((event.data['message'] as String?) ?? liveText)
                          .trim();
                  setState(() {
                    _draftId = draftId;
                    if (finalMessage.isNotEmpty) {
                      _turns.add(_Turn(role: 'assistant', text: finalMessage));
                    }
                    _streamingText = '';
                  });
                  _scrollToBottom();
                  if (finished && draftId != null) {
                    _loadDraftIntoRecap(draftId);
                  }
                case 'error':
                  setState(() {
                    _error = (event.data['message'] as String?) ??
                        "L'assistant n'a pas pu répondre.";
                  });
              }
            },
            onError: (err) {
              setState(() {
                _error = err is KojiWebApiException
                    ? err.message
                    : "L'assistant n'a pas pu répondre. Réessayez.";
                _sending = false;
              });
            },
            onDone: () {
              if (mounted) setState(() => _sending = false);
            },
          );
    } catch (err) {
      setState(() {
        _error = err is KojiWebApiException
            ? err.message
            : "L'assistant n'a pas pu répondre. Réessayez.";
        _sending = false;
      });
    }
  }

  void _answerText(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty && _pendingPhotos.isEmpty) return;
    if (_sending) return;
    final userTurn = _Turn(role: 'user', text: trimmed, photos: _pendingPhotos);
    final nextTurns = [..._turns, userTurn];
    final photosForThisTurn = _pendingPhotos;
    setState(() {
      _turns.add(userTurn);
      _draftController.clear();
      _pendingChoice = null;
      _pendingPhotos = [];
    });
    _scrollToBottom();
    _sendToEngine(nextTurns, photosForThisTurn);
  }

  Future<void> _pickPhoto() async {
    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 70,
      );
      if (image == null) return;
      final bytes = await image.readAsBytes();
      final ext = image.path.toLowerCase();
      final mediaType = ext.endsWith('.png') ? 'image/png' : 'image/jpeg';
      final dataUrl =
          'data:$mediaType;base64,${base64Encode(bytes)}';
      setState(() {
        if (_pendingPhotos.length < 8) _pendingPhotos.add(dataUrl);
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'Impossible de sélectionner la photo.');
      }
    }
  }

  Future<void> _loadDraftIntoRecap(String draftId) async {
    try {
      final draft =
          await ref.read(marketplaceRepositoryProvider).getChatDraft(draftId);
      final data = (draft['data'] as Map<String, dynamic>?) ?? const {};
      if (!mounted) return;
      setState(() {
        _draftAnswers = data;
        _metier = (data['metier'] as String?) ?? "Tout corps d'état";
        _addressController.text = (data['adresse'] as String?) ?? '';
        _phase = _Phase.recap;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err is KojiWebApiException
            ? err.message
            : 'Impossible de charger votre projet. Réessayez depuis le chat.';
      });
    }
  }

  Future<void> _confirmRecap() async {
    setState(() {
      _geocoding = true;
      _error = null;
    });
    final geocoded = await geocodeFrenchAddress(_addressController.text);
    if (!mounted) return;
    setState(() {
      _address = geocoded;
      _geocoding = false;
    });
    await _launchExpertise();
  }

  Future<void> _launchExpertise() async {
    setState(() => _error = null);
    final answers = {..._draftAnswers, 'metier': _metier};
    final photos = _turns.expand((t) => t.photos).toList();
    try {
      final result = await ref
          .read(marketplaceRepositoryProvider)
          .launchExpertise(answers: answers, photos: photos);
      if (!mounted) return;
      setState(() {
        _expertise = result;
        _selectedConseils.clear();
        _phase = _Phase.result;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err is KojiWebApiException
            ? err.message
            : "L'expertise n'a pas pu se terminer.";
      });
    }
  }

  Future<void> _submitMissingPrices() async {
    final prices = _missingPriceControllers.entries
        .map((e) => (itemId: e.key, value: e.value.text.trim()))
        .where((e) => e.value.isNotEmpty && double.tryParse(e.value) != null)
        .map((e) => {'itemId': e.itemId, 'amountHt': double.parse(e.value)})
        .toList();
    if (prices.isEmpty || _expertise == null) return;
    setState(() => _submittingPrices = true);
    try {
      final missing = await ref
          .read(marketplaceRepositoryProvider)
          .submitMissingPrices(_expertise!['expertiseId'] as String, prices);
      if (!mounted) return;
      setState(() {
        _expertise = {..._expertise!, 'missingPriceItems': missing};
        _missingPriceControllers.clear();
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error =
            err is KojiWebApiException ? err.message : 'Mise à jour impossible.';
      });
    } finally {
      if (mounted) setState(() => _submittingPrices = false);
    }
  }

  Future<void> _publish() async {
    if (_expertise == null || (_address?.address.trim().isEmpty ?? true)) {
      setState(() => _error = "L'adresse du chantier est obligatoire.");
      return;
    }
    setState(() {
      _publishing = true;
      _error = null;
    });
    final photos = _turns.expand((t) => t.photos).toList();
    try {
      await ref.read(marketplaceRepositoryProvider).publishOffer(
            expertiseId: _expertise!['expertiseId'] as String,
            conseilsSelectionnes: _selectedConseils.toList(),
            description: (_expertise!['description'] as String?) ?? '',
            metier: (_expertise!['metier'] as String?) ?? '',
            address: _address!.address,
            city: _address!.city,
            postalCode: _address!.postalCode,
            lat: _address!.lat,
            lon: _address!.lon,
            photos: photos,
            conversationId: _conversationId,
          );
      if (!mounted) return;
      ref.invalidate(marketplaceOffersProvider);
      context.go('/client/marketplace');
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err is KojiWebApiException
            ? err.message
            : 'Erreur lors de la publication.';
        _publishing = false;
      });
      return;
    }
    if (mounted) setState(() => _publishing = false);
  }

  @override
  Widget build(BuildContext context) {
    return switch (_phase) {
      _Phase.hero => _buildHero(context),
      _Phase.chat => _buildChat(context),
      _Phase.recap => _buildRecap(context),
      _Phase.result => _buildResult(context),
    };
  }

  Widget _buildHero(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Publier un chantier')),
      body: KojiPage(
        title: 'Décrivez votre projet',
        subtitle:
            "L'assistant koji vous pose quelques questions, puis chiffre et"
            ' publie votre chantier auprès des entreprises.',
        main: [
          KojiSegmented<_Mode>(
            options: const {_Mode.ia: 'Offre IA', _Mode.manuel: 'Saisie libre'},
            value: _mode,
            onChanged: (m) => setState(() {
              _mode = m;
              _error = null;
            }),
          ),
          const SizedBox(height: 16),
          if (_mode == _Mode.ia)
            KojiCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const KojiSectionTitle('Offre IA'),
                  const SizedBox(height: 10),
                  Text(
                    "Discutez avec l'assistant koji comme avec un conseiller :"
                    ' décrivez vos travaux, répondez à ses questions, ajoutez des'
                    ' photos si besoin.',
                    style: TextStyle(color: context.koji.muted, height: 1.45),
                  ),
                  const SizedBox(height: 16),
                  KojiButton(
                    label: 'Commencer',
                    leadingIcon: KojiIcons.sparkle,
                    expand: true,
                    onPressed: _openChat,
                  ),
                ],
              ),
            )
          else
            KojiCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const KojiSectionTitle('Saisie libre'),
                  const SizedBox(height: 4),
                  Text(
                    'Décrivez vous-même les travaux, sans passer par le chat.',
                    style: TextStyle(color: context.koji.muted, height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  KojiField(
                    label: 'Description des travaux',
                    controller: _manualDescriptionController,
                    hint: 'Ex : rénovation complète de salle de bain…',
                    maxLines: 4,
                  ),
                  const SizedBox(height: 14),
                  KojiField(
                    label: 'Adresse du chantier',
                    controller: _manualAddressController,
                    hint: '12 rue de la Paix, Paris',
                  ),
                  const SizedBox(height: 16),
                  KojiButton(
                    label: 'Continuer',
                    trailingIcon: KojiIcons.arrowRight,
                    expand: true,
                    onPressed: _startManual,
                  ),
                ],
              ),
            ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            KojiAlertBox(title: 'Erreur', message: _error!, tone: KojiTone.amber),
          ],
        ],
      ),
    );
  }

  Widget _buildChat(BuildContext context) {
    final p = context.koji;
    return Scaffold(
      appBar: AppBar(title: const Text('Assistant koji')),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                children: [
                  for (final turn in _turns) _ChatBubble(turn: turn),
                  if (_streamingText.isNotEmpty)
                    _ChatBubble(
                      turn: _Turn(role: 'assistant', text: _streamingText),
                    ),
                  if (_sending && _streamingText.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                  if (_pendingChoice != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: MarketplaceChoiceList(
                        question: '',
                        options: List<String>.from(
                          (_pendingChoice!['options'] as List?) ?? const [],
                        ),
                        multiple: _pendingChoice!['multiple'] == true,
                        allowUnknown: _pendingChoice!['allowUnknown'] != false,
                        allowOther: _pendingChoice!['allowOther'] != false,
                        disabled: _sending,
                        onSubmit: _answerText,
                      ),
                    ),
                  if (_pendingPhotoRequest != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: KojiAlertBox(
                        title: 'Photo demandée',
                        message: (_pendingPhotoRequest!['sujet'] as String?) ??
                            'Ajoutez une photo avec le trombone ci-dessous.',
                        icon: KojiIcons.sparkle,
                      ),
                    ),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(_error!, style: const TextStyle(color: Colors.red)),
                    ),
                ],
              ),
            ),
            if (_pendingPhotos.isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '${_pendingPhotos.length} photo'
                    '${_pendingPhotos.length > 1 ? 's' : ''} jointe'
                    '${_pendingPhotos.length > 1 ? 's' : ''}',
                    style: TextStyle(fontSize: 12.5, color: p.muted),
                  ),
                ),
              ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Row(
                  children: [
                    IconButton(
                      onPressed: _sending ? null : _pickPhoto,
                      icon: KojiIcon(KojiIcons.send, color: p.muted, size: 20),
                    ),
                    Expanded(
                      child: KojiField(
                        label: '',
                        controller: _draftController,
                        hint: 'Écrivez votre réponse…',
                        textInputAction: TextInputAction.send,
                        onSubmitted: _sending ? null : _answerText,
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      onPressed:
                          _sending ? null : () => _answerText(_draftController.text),
                      icon: KojiIcon(KojiIcons.arrowRight, color: p.primary),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRecap(BuildContext context) {
    final rooms = (_draftAnswers['rooms'] as List?) ?? const [];
    return Scaffold(
      appBar: AppBar(title: const Text('Récapitulatif')),
      body: KojiPage(
        title: 'Votre projet',
        subtitle: 'Vérifiez les informations avant de lancer le chiffrage.',
        main: [
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                KojiSectionTitle(_metier),
                const SizedBox(height: 10),
                if (rooms.isNotEmpty)
                  for (final room in rooms.cast<Map<String, dynamic>>())
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        '• ${room['label'] ?? ''}'
                        '${room['summary'] != null ? ' — ${room['summary']}' : ''}',
                        style: TextStyle(
                          color: context.koji.ink,
                          height: 1.4,
                        ),
                      ),
                    )
                else
                  Text(
                    (_draftAnswers['intro'] as String?) ??
                        'Projet décrit avec koji.',
                    style: TextStyle(color: context.koji.ink, height: 1.4),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          KojiCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                KojiField(
                  label: 'Adresse du chantier',
                  controller: _addressController,
                  hint: '12 rue de la Paix, Paris',
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 16),
                KojiButton(
                  label: "Lancer l'expertise koji",
                  loading: _geocoding,
                  expand: true,
                  onPressed: _addressController.text.trim().isEmpty
                      ? null
                      : _confirmRecap,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResult(BuildContext context) {
    final expertise = _expertise!;
    final conseils = (expertise['conseils'] as List?) ?? const [];
    final missing = (expertise['missingPriceItems'] as List?) ?? const [];
    final delai = expertise['delaiEstimeJours'];

    for (final item in missing.cast<Map<String, dynamic>>()) {
      _missingPriceControllers.putIfAbsent(
        item['id'] as String,
        () => TextEditingController(),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Chiffrage koji')),
      body: KojiPage(
        title: (expertise['description'] as String?) ?? 'Votre chantier',
        subtitle: delai != null ? '$delai jours estimés' : null,
        main: [
          if (conseils.isNotEmpty)
            KojiCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const KojiSectionTitle('Conseils pour réduire le coût'),
                  const SizedBox(height: 10),
                  for (final c in conseils.cast<Map<String, dynamic>>())
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: _selectedConseils.contains(c['id']),
                      onChanged: (_) => setState(() {
                        final id = c['id'] as String;
                        if (_selectedConseils.contains(id)) {
                          _selectedConseils.remove(id);
                        } else {
                          _selectedConseils.add(id);
                        }
                      }),
                      title: Text('${c['label']}'),
                      subtitle: Text('-${c['discountPercent']}% estimé'),
                    ),
                ],
              ),
            ),
          if (missing.isNotEmpty) ...[
            const SizedBox(height: 12),
            KojiCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const KojiSectionTitle('Prix à compléter'),
                  const SizedBox(height: 6),
                  Text(
                    "Ces postes n'existent pas dans notre bibliothèque de prix"
                    ' — proposez un prix ou laissez vide.',
                    style: TextStyle(fontSize: 12.5, color: context.koji.muted),
                  ),
                  const SizedBox(height: 12),
                  for (final item in missing.cast<Map<String, dynamic>>())
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: KojiField(
                        label: '${item['label']}',
                        controller: _missingPriceControllers[item['id']]!,
                        hint: 'Prix HT en €',
                        keyboardType: TextInputType.number,
                      ),
                    ),
                  KojiButton(
                    label: 'Enregistrer ces prix',
                    variant: KojiButtonVariant.secondary,
                    loading: _submittingPrices,
                    onPressed: _submitMissingPrices,
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          KojiButton(
            label: 'Publier le chantier',
            expand: true,
            loading: _publishing,
            onPressed: _publish,
          ),
        ],
      ),
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.turn});
  final _Turn turn;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final isUser = turn.role == 'user';
    final bubble = Container(
      margin: const EdgeInsets.only(bottom: 10),
      constraints: const BoxConstraints(maxWidth: 260),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: isUser ? p.primary : p.surfaceMuted,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        turn.text,
        style: TextStyle(
          color: isUser ? p.onPrimary : p.ink,
          height: 1.4,
        ),
      ),
    );
    if (isUser) return Align(alignment: Alignment.centerRight, child: bubble);
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 28,
            height: 28,
            margin: const EdgeInsets.only(top: 2),
            decoration: const BoxDecoration(
              color: KojiColors.navy,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: const KojiIcon(KojiIcons.sparkle,
                size: 13, color: KojiColors.gold),
          ),
          const SizedBox(width: 8),
          Flexible(child: bubble),
        ],
      ),
    );
  }
}
