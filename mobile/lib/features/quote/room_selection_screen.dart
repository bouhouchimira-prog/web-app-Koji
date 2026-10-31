import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/core/responsive_helper.dart';
import 'package:koji/core/route_args.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/quote/providers/quote_creation_provider.dart';

class RoomSelectionScreen extends ConsumerStatefulWidget {
  final List<String> initialImages;

  const RoomSelectionScreen({
    super.key,
    this.initialImages = const [],
  });

  @override
  ConsumerState<RoomSelectionScreen> createState() =>
      _RoomSelectionScreenState();
}

class _RoomSelectionScreenState extends ConsumerState<RoomSelectionScreen> {
  final TextEditingController _customRoomController = TextEditingController();
  bool _customRoomHasText = false;

  @override
  void initState() {
    super.initState();
    _customRoomController.addListener(_handleCustomRoomChanged);
  }

  void _handleCustomRoomChanged() {
    final hasText = _customRoomController.text.trim().isNotEmpty;
    if (hasText != _customRoomHasText) {
      setState(() => _customRoomHasText = hasText);
    }
  }

  // List of rooms with their selection state
  final List<RoomOption> _roomOptions = [
    RoomOption(id: 'salon', label: 'Salon', icon: Icons.weekend_outlined),
    RoomOption(
        id: 'cuisine', label: 'Cuisine', icon: Icons.soup_kitchen_outlined),
    RoomOption(id: 'chambre', label: 'Chambre', icon: Icons.bed_outlined),
    RoomOption(
        id: 'salle_de_bain',
        label: 'Salle de bain',
        icon: Icons.bathtub_outlined),
    RoomOption(id: 'bureau', label: 'Bureau', icon: Icons.desk_outlined),
    RoomOption(id: 'exterieur', label: 'Extérieur', icon: Icons.deck_outlined),
  ];

  final List<String> _selectedRoomIds = [];

  @override
  void dispose() {
    _customRoomController.removeListener(_handleCustomRoomChanged);
    _customRoomController.dispose();
    super.dispose();
  }

  void _toggleRoom(String id) {
    setState(() {
      if (_selectedRoomIds.contains(id)) {
        _selectedRoomIds.remove(id);
      } else {
        _selectedRoomIds.add(id);
      }
    });
  }

  void _addCustomRoom() {
    final name = _customRoomController.text.trim();
    if (name.isEmpty) return;

    // Build a stable, lowercase id from the name. Downstream screens use the
    // id as the room key in maps and as the label fallback, so it must be
    // consistent across screens.
    final id = name
        .toLowerCase()
        .replaceAll(RegExp(r'\s+'), '_')
        .replaceAll(RegExp(r'[^a-z0-9_]'), '');
    if (id.isEmpty) return;

    // If the user typed an existing room name, just select it.
    final existing = _roomOptions.where((r) => r.id == id);
    if (existing.isNotEmpty) {
      setState(() {
        if (!_selectedRoomIds.contains(id)) _selectedRoomIds.add(id);
      });
    } else {
      setState(() {
        _roomOptions.add(RoomOption(
          id: id,
          // Capitalize first letter for display.
          label: name[0].toUpperCase() + name.substring(1),
          icon: Icons.room_preferences_outlined,
        ));
        _selectedRoomIds.add(id);
      });
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Pièce personnalisée "$name" ajoutée')),
    );
    _customRoomController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final responsive = context.responsive;

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF8F9FA),
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            shape: BoxShape.circle,
          ),
          child: IconButton(
            icon: const Icon(Icons.arrow_back,
                color: AppTheme.darkNavy, size: 20),
            onPressed: () => context.pop(),
          ),
        ),
        centerTitle: true,
        title: Column(
          children: [
            Text(
              'Créer votre chantier',
              style: AppTheme.headingStyle(context).copyWith(fontSize: 18),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.all(responsive.width(6.4)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [

                    const SizedBox(height: 24),

                    // Custom Room Input
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surface,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.input,
                                  size: 20, color: AppTheme.darkNavy),
                              const SizedBox(width: 12),
                              Text(
                                "Ajouter une pièce ",
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  fontSize: 16,
                                  color: AppTheme.darkNavy,
                                ),
                              )
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _customRoomController,
                                  decoration: InputDecoration(
                                    hintText: 'Ex: Buanderie, Garage...',
                                    hintStyle: TextStyle(
                                      color: const Color(0xFF9CA3AF),
                                      fontSize: 14,
                                    ),
                                    contentPadding: const EdgeInsets.symmetric(
                                        horizontal: 16, vertical: 12),
                                    border: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: BorderSide(
                                          color: Colors.grey.shade300),
                                    ),
                                    enabledBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: BorderSide(
                                          color: Colors.grey.shade300),
                                    ),
                                    focusedBorder: OutlineInputBorder(
                                      borderRadius: BorderRadius.circular(12),
                                      borderSide: const BorderSide(
                                          color: AppTheme.darkNavy),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                decoration: BoxDecoration(
                                  color: _customRoomHasText
                                      ? AppTheme.darkNavy
                                      : const Color(0xFFE5E7EB),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: IconButton(
                                  icon: Icon(
                                    Icons.add,
                                    color: _customRoomHasText
                                        ? Colors.white
                                        : AppTheme.textLight,
                                  ),
                                  onPressed: _customRoomHasText
                                      ? _addCustomRoom
                                      : null,
                                ),
                              ),
                            ],
                          )
                        ],
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Divider
                    Row(
                      children: [
                        const Expanded(
                            child: Divider(color: Color(0xFFE5E7EB))),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text(
                            "Suggestions Rapides",
                            style: TextStyle(
                              color: const Color(0xFF9CA3AF),
                              fontSize: 14,
                            ),
                          ),
                        ),
                        const Expanded(
                            child: Divider(color: Color(0xFFE5E7EB))),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Room Grid
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: 1.4,
                      children: _roomOptions
                          .map((room) => _buildRoomCard(room))
                          .toList(),
                    ),

                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Bottom Button
            Padding(
              padding: EdgeInsets.all(responsive.width(6.4)),
              child: ElevatedButton(
                onPressed: _selectedRoomIds.isEmpty
                    ? null
                    : () {
                        ref
                            .read(quoteCreationProvider.notifier)
                            .setSelectedRooms(_selectedRoomIds);
                        // Tout-en-un (demande client) : aller DIRECTEMENT au
                        // Récapitulatif du devis. Les pièces choisies y
                        // apparaissent comme lots vides ; on y ajoute ouvrages,
                        // fournitures et notes sans l'écran « Créer vos ouvrages ».
                        context.push(
                          '/quote/detail',
                          extra: QuoteDetailArgs(
                            data: ref.read(quoteCreationProvider).toMap(),
                          ),
                        );
                      },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.darkNavy,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor:
                      AppTheme.darkNavy.withValues(alpha: 0.5),
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      'Continuer (${_selectedRoomIds.length} sélectionnés)',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.arrow_forward, size: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoomCard(RoomOption room) {
    final isSelected = _selectedRoomIds.contains(room.id);
    return GestureDetector(
      onTap: () => _toggleRoom(room.id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFF0F3460)
              : Colors
                  .white, // Dark navy for selected, white unselected. 0F3460 is approximately darkNavy
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04), // Subtle shadow
              blurRadius: 10,
              offset: const Offset(0, 4),
            )
          ],
          border: isSelected
              ? null
              : Border.all(color: Colors.transparent), // No border generally
        ),
        padding: const EdgeInsets.all(16),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  room.icon,
                  color: isSelected ? Colors.white : AppTheme.darkNavy,
                  size: 32,
                ),
                const Spacer(),
                Text(
                  room.label,
                  style: TextStyle(
                    color: isSelected ? Colors.white : AppTheme.darkNavy,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
              ],
            ),
            Positioned(
              top: 0,
              right: 0,
              child: Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSelected ? Colors.white : Colors.transparent,
                  border: isSelected
                      ? null
                      : Border.all(color: const Color(0xFFD1D5DB), width: 1.5),
                ),
                child: isSelected
                    ? const Icon(Icons.check_circle,
                        color: AppTheme.darkNavy,
                        size:
                            24) // We want the tick inside, or just a filled circle with tick
                    // Actually design shows a tick inside a white circle for the selected blue card
                    // Logic: The container is white, the icon is check_circle?
                    // No, usually it's a white background circle with a blue tick?
                    // Or just an icon.
                    // Let's use Icon(Icons.check_circle, color: Theme.of(context).colorScheme.surface) for selected?
                    // Wait, screenshot shows white tick on blue background? No, selected is White Check inside Blue Circle? or Blue Check inside White circle?
                    // Looking at screenshot:
                    // Selected (Salon): Blue card. Top right has a White Circle with a Blue Tick inside.
                    : null,

                // Refined logic for checkmark visual:
                // Unselected: Empty ring.
                // Selected: White circle with Check icon.
              ),
            ),
            if (isSelected)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surface, shape: BoxShape.circle),
                  child: const Center(
                    child:
                        Icon(Icons.check, size: 16, color: AppTheme.darkNavy),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class RoomOption {
  final String id;
  final String label;
  final IconData icon;

  RoomOption({required this.id, required this.label, required this.icon});
}
