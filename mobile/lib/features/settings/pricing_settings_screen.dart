import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:koji/features/pricing/models/pricing_models.dart';
import 'package:koji/features/pricing/repository/pricing_repository.dart';

class PricingSettingsScreen extends ConsumerStatefulWidget {
  const PricingSettingsScreen({super.key});

  @override
  ConsumerState<PricingSettingsScreen> createState() =>
      _PricingSettingsScreenState();
}

class _PricingSettingsScreenState extends ConsumerState<PricingSettingsScreen> {
  // Refresh trigger
  int _refreshKey = 0;

  void _refreshProfiles() {
    setState(() {
      _refreshKey++;
    });
  }

  @override
  Widget build(BuildContext context) {
    // Fetch all pricing profiles
    final repo = ref.read(pricingRepositoryProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text(
          'Tarification par Métier',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E3A8A),
          ),
        ),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        iconTheme: const IconThemeData(color: Color(0xFF1E3A8A)),
      ),
      body: FutureBuilder<List<PricingProfile>>(
        key: ValueKey(_refreshKey),
        future: repo.getAllProfiles(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 16),
                  Text('Erreur: ${snapshot.error}'),
                ],
              ),
            );
          }

          final profiles = snapshot.data ?? [];

          if (profiles.isEmpty) {
            return const Center(
              child: Text(
                'Aucun profil de tarification trouvé.\nVeuillez exécuter le script SQL.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Colors.grey),
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: profiles.length,
            itemBuilder: (context, index) {
              final profile = profiles[index];
              return _buildProfileCard(profile);
            },
          );
        },
      ),
    );
  }

  Widget _buildProfileCard(PricingProfile profile) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showEditDialog(profile),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Profession Title
              Row(
                children: [
                  _getProfessionIcon(profile.profession),
                  const SizedBox(width: 12),
                  Text(
                    profile.profession,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E3A8A),
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.edit, color: Color(0xFF1E3A8A), size: 20),
                ],
              ),
              const SizedBox(height: 16),

              // Daily Rate
              _buildInfoRow(
                'Tarif journalier',
                '${profile.dailyRateHT.toStringAsFixed(0)} € HT',
                Icons.euro,
              ),
              const SizedBox(height: 8),

              // Hours per day
              _buildInfoRow(
                'Heures par jour',
                '${profile.hoursPerDay.toStringAsFixed(1)} h',
                Icons.access_time,
              ),
              const SizedBox(height: 8),

              // Calculated hourly rate
              _buildInfoRow(
                'Coût horaire',
                '${profile.hourlyRate.toStringAsFixed(2)} € / h',
                Icons.calculate,
                isHighlighted: true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, IconData icon,
      {bool isHighlighted = false}) {
    return Row(
      children: [
        Icon(icon, size: 18, color: Colors.grey[600]),
        const SizedBox(width: 8),
        Text(
          label,
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey[600],
          ),
        ),
        const Spacer(),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isHighlighted
                ? const Color(0xFF1E3A8A).withValues(alpha: 0.1)
                : Colors.grey[100],
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: isHighlighted ? FontWeight.bold : FontWeight.w600,
              color: isHighlighted ? const Color(0xFF1E3A8A) : Colors.black87,
            ),
          ),
        ),
      ],
    );
  }

  Icon _getProfessionIcon(String profession) {
    IconData iconData;
    Color color;

    switch (profession) {
      case 'Peintre':
        iconData = Icons.format_paint;
        color = Colors.orange;
        break;
      case 'Électricien':
        iconData = Icons.electric_bolt;
        color = Colors.yellow[700]!;
        break;
      case 'Plombier':
        iconData = Icons.plumbing;
        color = Colors.blue;
        break;
      case 'Menuisier':
        iconData = Icons.carpenter;
        color = Colors.brown;
        break;
      case 'Maçon':
        iconData = Icons.construction;
        color = Colors.grey[700]!;
        break;
      default:
        iconData = Icons.work;
        color = Colors.grey;
    }

    return Icon(iconData, color: color, size: 28);
  }

  void _showEditDialog(PricingProfile profile) {
    final dailyRateController =
        TextEditingController(text: profile.dailyRateHT.toStringAsFixed(0));
    final hoursController =
        TextEditingController(text: profile.hoursPerDay.toStringAsFixed(1));

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            double? dailyRate = double.tryParse(dailyRateController.text);
            double? hours = double.tryParse(hoursController.text);
            double? hourlyRate =
                (dailyRate != null && hours != null && hours > 0)
                    ? dailyRate / hours
                    : null;

            return AlertDialog(
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16)),
              title: Row(
                children: [
                  _getProfessionIcon(profile.profession),
                  const SizedBox(width: 12),
                  Text(
                    'Modifier ${profile.profession}',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Daily Rate Input
                    TextField(
                      controller: dailyRateController,
                      keyboardType: TextInputType.number,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: InputDecoration(
                        labelText: 'Tarif journalier (€ HT)',
                        prefixIcon: const Icon(Icons.euro),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      onChanged: (_) => setDialogState(() {}),
                    ),
                    const SizedBox(height: 16),

                    // Hours per day Input
                    TextField(
                      controller: hoursController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Heures par jour',
                        prefixIcon: const Icon(Icons.access_time),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      onChanged: (_) => setDialogState(() {}),
                    ),
                    const SizedBox(height: 24),

                    // Calculated Hourly Rate Display
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E3A8A).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color:
                                const Color(0xFF1E3A8A).withValues(alpha: 0.3)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.calculate, color: Color(0xFF1E3A8A)),
                              SizedBox(width: 8),
                              Text(
                                'Coût horaire',
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            hourlyRate != null
                                ? '${hourlyRate.toStringAsFixed(2)} € / h'
                                : '-- € / h',
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1E3A8A),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Annuler'),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E3A8A),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 12),
                  ),
                  onPressed: dailyRate != null && hours != null && hours > 0
                      ? () => _saveProfile(profile, dailyRate, hours)
                      : null,
                  child: const Text('Enregistrer',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Future<void> _saveProfile(
      PricingProfile profile, double newDailyRate, double newHours) async {
    try {
      final repo = ref.read(pricingRepositoryProvider);
      final updatedProfile = PricingProfile(
        id: profile.id,
        profession: profile.profession,
        dailyRateHT: newDailyRate,
        hoursPerDay: newHours,
        isActive: profile.isActive,
      );

      await repo.updateProfile(updatedProfile);

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('✅ Tarif ${profile.profession} mis à jour'),
            backgroundColor: Colors.green,
          ),
        );
        _refreshProfiles();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Erreur: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }
}
