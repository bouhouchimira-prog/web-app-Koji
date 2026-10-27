import 'package:flutter/material.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/design/koji_widgets.dart';

const _unknownOption = 'Je ne sais pas';
const _otherOption = 'Autre, précisez';

/// Port of components/ChoiceList.jsx — the assistant's "proposer_choix"
/// tool renders as this, never big side-by-side cards. `onSubmit` receives
/// the exact text to send back into the chat, same as if the particulier had
/// typed it (selected labels joined with ", ", koji-web's own separator for
/// this chat engine — see ChoiceList.jsx's `separator` default).
class MarketplaceChoiceList extends StatefulWidget {
  const MarketplaceChoiceList({
    super.key,
    required this.question,
    required this.options,
    required this.multiple,
    this.allowUnknown = true,
    this.allowOther = true,
    required this.onSubmit,
    this.disabled = false,
  });

  final String question;
  final List<String> options;
  final bool multiple;
  final bool allowUnknown;
  final bool allowOther;
  final bool disabled;
  final ValueChanged<String> onSubmit;

  @override
  State<MarketplaceChoiceList> createState() => _MarketplaceChoiceListState();
}

class _MarketplaceChoiceListState extends State<MarketplaceChoiceList> {
  final Set<String> _selected = {};
  bool _otherOpen = false;
  final _otherController = TextEditingController();

  @override
  void dispose() {
    _otherController.dispose();
    super.dispose();
  }

  List<String> get _allOptions => [
        ...widget.options,
        if (widget.allowUnknown) _unknownOption,
        if (widget.allowOther) _otherOption,
      ];

  void _submitWith(List<String> labels) {
    final text = labels.join(', ');
    if (text.trim().isEmpty) return;
    widget.onSubmit(text);
  }

  void _toggle(String option) {
    if (widget.disabled) return;
    if (option == _otherOption) {
      setState(() {
        if (_otherOpen) {
          _otherOpen = false;
          _otherController.clear();
        } else {
          _otherOpen = true;
          _selected.clear();
        }
      });
      return;
    }
    if (!widget.multiple) {
      _submitWith([option]);
      return;
    }
    setState(() {
      if (option == _unknownOption) {
        if (_selected.contains(_unknownOption)) {
          _selected.clear();
        } else {
          _selected
            ..clear()
            ..add(_unknownOption);
        }
        _otherOpen = false;
        return;
      }
      _selected.remove(_unknownOption);
      if (_selected.contains(option)) {
        _selected.remove(option);
      } else {
        _selected.add(option);
      }
    });
  }

  void _validate() {
    final otherText = _otherController.text.trim();
    if (_otherOpen && otherText.isNotEmpty) {
      _submitWith([otherText]);
      return;
    }
    if (_selected.isNotEmpty) _submitWith(_selected.toList());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    final otherText = _otherController.text.trim();
    final count = _selected.length + (_otherOpen && otherText.isNotEmpty ? 1 : 0);

    return KojiCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.question.isNotEmpty) ...[
            Text(
              widget.question,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: p.heading,
              ),
            ),
            const SizedBox(height: 12),
          ],
          for (final option in _allOptions) ...[
            _ChoiceRow(
              label: option,
              selected: option == _otherOption
                  ? _otherOpen
                  : _selected.contains(option),
              onTap: () => _toggle(option),
            ),
            const SizedBox(height: 8),
          ],
          if (_otherOpen) ...[
            const SizedBox(height: 4),
            TextField(
              controller: _otherController,
              enabled: !widget.disabled,
              autofocus: true,
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _validate(),
              decoration: const InputDecoration(hintText: 'Précisez…'),
            ),
          ],
          if (widget.multiple || _otherOpen) ...[
            const SizedBox(height: 12),
            KojiButton(
              label: 'Valider ma sélection'
                  '${widget.multiple && count > 0 ? ' ($count)' : ''}',
              trailingIcon: KojiIcons.arrowRight,
              onPressed: widget.disabled || count == 0 ? null : _validate,
              expand: true,
            ),
          ],
        ],
      ),
    );
  }
}

class _ChoiceRow extends StatelessWidget {
  const _ChoiceRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final p = context.koji;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected ? p.toneBg(KojiTone.info) : p.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: selected ? p.primary : p.line),
        ),
        child: Row(
          children: [
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: selected ? p.primary : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(color: selected ? p.primary : p.lineStrong),
              ),
              alignment: Alignment.center,
              child: selected
                  ? const KojiIcon(KojiIcons.check, size: 11, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(fontSize: 14, color: p.ink),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
