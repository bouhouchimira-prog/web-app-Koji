import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import 'package:koji/app/koji_web_api_client.dart';
import 'package:koji/design/koji_page.dart';
import 'package:koji/design/koji_widgets.dart';

enum _Phase { hero, chat, recap, result }

class _Turn {
  _Turn({required this.role, required this.text});
  final String role; // 'user' | 'assistant'
  final String text;
}

/// IA-assisted quote generation for entreprises (similar to client marketplace publishing).
/// Uses SSE streaming from /api/radar-chat in mode: "entreprise-devis"
class EntrepriseDevisIaScreen extends ConsumerStatefulWidget {
  const EntrepriseDevisIaScreen({super.key});

  @override
  ConsumerState<EntrepriseDevisIaScreen> createState() =>
      _EntrepriseDevisIaScreenState();
}

class _EntrepriseDevisIaScreenState
    extends ConsumerState<EntrepriseDevisIaScreen> {
  _Phase _phase = _Phase.hero;
  late String _conversationId;
  final List<_Turn> _turns = [];
  String _streamingText = '';
  bool _sending = false;
  String? _error;
  StreamSubscription<SseEvent>? _sub;

  final _draftController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _conversationId =
        'devis-ia-${DateTime.now().millisecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _sub?.cancel();
    _draftController.dispose();
    _scrollController.dispose();
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

  Future<void> _sendToEngine(List<_Turn> turns) async {
    if (_sending) return;
    setState(() {
      _sending = true;
      _streamingText = '';
      _error = null;
    });

    try {
      final turnsList = turns
          .map((t) => {'role': t.role, 'text': t.text})
          .toList();

      _sub = ref.read(kojiWebApiClientProvider).postSse(
        '/api/radar-chat',
        {
          'turns': turnsList,
          'conversationId': _conversationId,
          'mode': 'entreprise-devis',
        },
      ).listen(
        (event) {
          setState(() {
            if (event.data == '[DONE]') {
              _turns.add(_Turn(role: 'assistant', text: _streamingText));
              _streamingText = '';
              _phase = _Phase.recap;
            } else {
              _streamingText += (event.data as String?) ?? '';
            }
          });
          _scrollToBottom();
        },
        onError: (err) {
          setState(() {
            _error = err is KojiWebApiException
                ? err.message
                : "L'assistant n'a pas pu répondre.";
            _sending = false;
          });
        },
        onDone: () {
          if (mounted) setState(() => _sending = false);
        },
      );
    } catch (err) {
      setState(() {
        _error =
            err is KojiWebApiException ? err.message : 'Erreur réseau';
        _sending = false;
      });
    }
  }

  void _answerText(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    final userTurn = _Turn(role: 'user', text: trimmed);
    final nextTurns = [..._turns, userTurn];
    setState(() {
      _turns.add(userTurn);
      _draftController.clear();
      _phase = _Phase.chat;
    });
    _scrollToBottom();
    _sendToEngine(nextTurns);
  }

  @override
  Widget build(BuildContext context) {
    return switch (_phase) {
      _Phase.hero => _buildHero(),
      _Phase.chat => _buildChat(),
      _Phase.recap => _buildRecap(),
      _Phase.result => _buildResult(),
    };
  }

  Widget _buildHero() {
    return KojiPage(
      title: 'Devis guidé',
      appBarOnPhone: true,
      main: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFFFFC400),
                borderRadius: BorderRadius.circular(2),
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Koji vous aide',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF171B1E),
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Décrivez le travail à faire et notre IA créera un devis détaillé avec lignes, prix, et questions.',
                    style: TextStyle(
                      fontSize: 14,
                      color: Color(0xFF171B1E),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: KojiButton(
                      label: 'Démarrer un devis guidé',
                      onPressed: () {
                        setState(() => _phase = _Phase.chat);
                        _answerText('Bonjour');
                      },
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildChat() {
    return KojiPage(
      title: 'Conversation',
      appBarOnPhone: true,
      main: [
        Expanded(
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 0),
            itemCount: _turns.length + (_streamingText.isNotEmpty ? 1 : 0),
            itemBuilder: (ctx, i) {
              if (i == _turns.length) {
                return Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F5F2),
                      borderRadius: BorderRadius.circular(2),
                      border: Border.all(color: const Color(0xFFD9D9D4)),
                    ),
                    child: Text(
                      _streamingText,
                      style: const TextStyle(fontSize: 14),
                    ),
                  ),
                );
              }
              final turn = _turns[i];
              final isUser = turn.role == 'user';
              return Align(
                alignment:
                    isUser ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser ? const Color(0xFFFFC400) : const Color(0xFFF5F5F2),
                    borderRadius: BorderRadius.circular(2),
                    border: Border.all(
                      color: isUser ? const Color(0xFFFFC400) : const Color(0xFFD9D9D4),
                    ),
                  ),
                  child: Text(
                    turn.text,
                    style: TextStyle(
                      fontSize: 14,
                      color: isUser ? const Color(0xFF171B1E) : const Color(0xFF171B1E),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              _error!,
              style: const TextStyle(
                color: Colors.red,
                fontSize: 13,
              ),
            ),
          ),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border(
              top: BorderSide(color: const Color(0xFFD9D9D4)),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _draftController,
                  enabled: !_sending,
                  decoration: InputDecoration(
                    hintText: 'Votre réponse…',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(2),
                      borderSide: const BorderSide(color: Color(0xFFD9D9D4)),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    filled: true,
                    fillColor: const Color(0xFFFFFFFF),
                  ),
                  style: const TextStyle(fontSize: 14),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                height: 44,
                width: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFFFC400),
                  borderRadius: BorderRadius.circular(2),
                ),
                child: IconButton(
                  icon: _sending
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Color(0xFF171B1E),
                            ),
                          ),
                        )
                      : const Icon(
                          Icons.send,
                          color: Color(0xFF171B1E),
                          size: 20,
                        ),
                  onPressed: _sending
                      ? null
                      : () => _answerText(_draftController.text),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildRecap() {
    return KojiPage(
      title: 'Récapitulatif',
      appBarOnPhone: true,
      main: [
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F2),
            border: Border.all(color: const Color(0xFFD9D9D4)),
            borderRadius: BorderRadius.circular(2),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Conversation complétée',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Votre devis est prêt à être envoyé au client.',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: KojiButton(
                  label: 'Voir le devis',
                  onPressed: () {
                    setState(() => _phase = _Phase.result);
                  },
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildResult() {
    return KojiPage(
      title: 'Devis créé',
      appBarOnPhone: true,
      main: [
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F2),
            border: Border.all(color: const Color(0xFFD9D9D4)),
            borderRadius: BorderRadius.circular(2),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '✓ Devis créé avec succès!',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Vous pouvez maintenant envoyer le devis au client ou l\'éditer.',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
