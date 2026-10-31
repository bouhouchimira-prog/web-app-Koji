import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/quote/model/library_ouvrage.dart';
import 'package:koji/features/quote/ouvrage_library_form_screen.dart';
import 'package:koji/features/quote/repository/ouvrage_library_repository.dart';

class OuvrageLibraryScreen extends ConsumerStatefulWidget {
  /// When true, tapping an ouvrage pops with the selected [LibraryOuvrage] so
  /// the caller can insert it into the current chantier.
  final bool pickMode;

  const OuvrageLibraryScreen({super.key, this.pickMode = false});

  @override
  ConsumerState<OuvrageLibraryScreen> createState() =>
      _OuvrageLibraryScreenState();
}

class _OuvrageLibraryScreenState extends ConsumerState<OuvrageLibraryScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  String _query = '';
  String? _selectedFamille;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(
        () => setState(() => _query = _searchCtrl.text.trim().toLowerCase()));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _openForm({
    LibraryOuvrage? existing,
    String? parentId,
    String? parentCode,
  }) async {
    final created = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => OuvrageLibraryFormScreen(
          existing: existing,
          parentId: parentId,
          parentCode: parentCode,
        ),
      ),
    );
    if (created == true) {
      ref.invalidate(ouvrageLibraryProvider);
    }
  }

  Future<void> _confirmDelete(LibraryOuvrage o) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Supprimer cet ouvrage ?'),
        content: Text('${o.code} — ${o.designation}'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Supprimer',
                style: TextStyle(color: Color(0xFFDC2626))),
          ),
        ],
      ),
    );
    if (ok != true) return;

    try {
      await ref.read(ouvrageLibraryRepositoryProvider).delete(o.id);
      ref.invalidate(ouvrageLibraryProvider);
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $err')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final asyncList = ref.watch(ouvrageLibraryProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.darkNavy),
          onPressed: () => context.pop(),
        ),
        title: Text(
          widget.pickMode
              ? 'Choisir un ouvrage'
              : 'Bibliothèque d\'ouvrages',
          style: AppTheme.headingStyle(context).copyWith(fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle, color: AppTheme.darkNavy),
            onPressed: () => _openForm(),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Rechercher par code, désignation ou famille',
                prefixIcon: const Icon(Icons.search, color: Colors.grey),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear,
                            size: 18, color: Colors.grey),
                        onPressed: () => _searchCtrl.clear(),
                      )
                    : null,
                filled: true,
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          asyncList.maybeWhen(
            data: (list) => _familleTabs(list),
            orElse: () => const SizedBox.shrink(),
          ),
          Expanded(
            child: asyncList.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text('Erreur: $err')),
              data: (list) {
                final filtered = list.where((o) {
                  if (_selectedFamille != null &&
                      (o.famille ?? 'Autres') != _selectedFamille) {
                    return false;
                  }
                  if (_query.isEmpty) return true;
                  final q = _query;
                  return o.code.toLowerCase().contains(q) ||
                      o.designation.toLowerCase().contains(q) ||
                      (o.famille ?? '').toLowerCase().contains(q);
                }).toList();

                if (filtered.isEmpty) {
                  return _emptyState(list.isEmpty);
                }

                final byFamille = <String, List<LibraryOuvrage>>{};
                for (final o in filtered) {
                  final key = o.famille ?? 'Autres';
                  byFamille.putIfAbsent(key, () => []).add(o);
                }

                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  children: byFamille.entries
                      .map((e) => _familleSection(e.key, e.value))
                      .toList(),
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: widget.pickMode
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _openForm(),
              backgroundColor: AppTheme.darkNavy,
              icon: const Icon(Icons.add, color: Colors.white),
              label: const Text('Nouvel ouvrage',
                  style: TextStyle(color: Colors.white)),
            ),
    );
  }

  Widget _emptyState(bool isReallyEmpty) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.menu_book_outlined,
                size: 56, color: Colors.grey[400]),
            const SizedBox(height: 12),
            Text(
              isReallyEmpty
                  ? 'Aucun ouvrage dans la bibliothèque'
                  : 'Aucun résultat',
              style: const TextStyle(fontSize: 15, color: Color(0xFF6B7280)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 6),
            if (isReallyEmpty)
              const Text(
                'Créez votre premier ouvrage avec le bouton +',
                style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF)),
                textAlign: TextAlign.center,
              ),
          ],
        ),
      ),
    );
  }

  Widget _familleTabs(List<LibraryOuvrage> list) {
    final familles = <String>{};
    for (final o in list) {
      familles.add(o.famille ?? 'Autres');
    }
    if (familles.isEmpty) return const SizedBox.shrink();

    final sorted = familles.toList()..sort();
    final entries = <String?>[null, ...sorted];

    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        itemCount: entries.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final value = entries[i];
          final label = value ?? 'Toutes';
          final selected = _selectedFamille == value;
          return ChoiceChip(
            label: Text(label),
            selected: selected,
            onSelected: (_) => setState(() => _selectedFamille = value),
            labelStyle: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: selected ? Colors.white : AppTheme.darkNavy,
            ),
            backgroundColor: Colors.white,
            selectedColor: AppTheme.darkNavy,
            side: BorderSide(
              color: selected
                  ? AppTheme.darkNavy
                  : const Color(0xFFE5E7EB),
            ),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
            visualDensity: VisualDensity.compact,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          );
        },
      ),
    );
  }

  Widget _familleSection(String famille, List<LibraryOuvrage> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 16, 4, 8),
          child: Text(
            famille.toUpperCase(),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: Color(0xFF6B7280),
              letterSpacing: 0.5,
            ),
          ),
        ),
        ...items.map((o) => _ouvrageCard(o)),
      ],
    );
  }

  /// A top-level ouvrage with its sous-ouvrages nested underneath, plus the
  /// "Ajouter un sous-ouvrage" action. Available in both browse and pick mode.
  Widget _ouvrageCard(LibraryOuvrage o) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _singleCard(o),
        Padding(
          padding: const EdgeInsets.only(left: 16, bottom: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ...o.subOuvrages.map((s) => _singleCard(s, isSub: true)),
              GestureDetector(
                onTap: () => _openForm(
                  parentId: o.id,
                  parentCode: o.code,
                ),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      vertical: 8, horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0F9FF),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFBAE6FD)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.add, size: 14, color: Color(0xFF0369A1)),
                      SizedBox(width: 4),
                      Text('Ajouter un sous-ouvrage',
                          style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF0369A1),
                              fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _singleCard(LibraryOuvrage o, {bool isSub = false}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          if (widget.pickMode) {
            context.pop(o);
          } else {
            _openForm(existing: o);
          }
        },
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFEDD5),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      o.code,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFC2410C),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (o.unite != null && o.unite!.isNotEmpty)
                    Text(
                      o.unite!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: Color(0xFF6B7280),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  const Spacer(),
                  // Edit / delete available in both browse and pick mode.
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_vert,
                        size: 18, color: Color(0xFF6B7280)),
                    onSelected: (v) {
                      if (v == 'edit') _openForm(existing: o);
                      if (v == 'delete') _confirmDelete(o);
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(
                          value: 'edit', child: Text('Modifier')),
                      PopupMenuItem(
                          value: 'delete',
                          child: Text('Supprimer',
                              style: TextStyle(color: Color(0xFFDC2626)))),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                o.designation,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.darkNavy,
                ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 14,
                runSpacing: 6,
                children: [
                  _metric('Temps', '${_fmt(o.tempsHU)} h/${o.unite ?? "u"}'),
                  _metric('Taux', '${_fmt(o.tauxHoraire)} €'),
                  _metric('MO/u',
                      '${o.coutMoU.toStringAsFixed(2)} €'),
                  if (o.coefficient != 1.0)
                    _metric('Coeff', '×${_fmt(o.coefficient)}'),
                  if (o.reduction != 0)
                    _metric('Réduc', '-${_fmt(o.reduction)}%'),
                ],
              ),
              if (o.coefficient != 1.0 || o.reduction != 0) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Prix final/u : ${o.finalUnitPrice.toStringAsFixed(2)} €',
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF047857),
                    ),
                  ),
                ),
              ],
              if (o.commentaire != null && o.commentaire!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  o.commentaire!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Color(0xFF6B7280),
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _metric(String label, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '$label: ',
          style: const TextStyle(
              fontSize: 12, color: Color(0xFF9CA3AF)),
        ),
        Text(
          value,
          style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.darkNavy),
        ),
      ],
    );
  }

  String _fmt(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();
}
