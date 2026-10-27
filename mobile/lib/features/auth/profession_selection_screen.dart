import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/features/auth/provider/auth_provider.dart';
import 'package:koji/features/auth/repository/user_repository.dart';
import 'package:koji/core/responsive_helper.dart';

class ProfessionSelectionScreen extends ConsumerStatefulWidget {
  const ProfessionSelectionScreen({super.key});

  @override
  ConsumerState<ProfessionSelectionScreen> createState() =>
      _ProfessionSelectionScreenState();
}

class _ProfessionSelectionScreenState
    extends ConsumerState<ProfessionSelectionScreen> {
  List<String> _selectedProfessions = [];
  bool _isLoading = false;

  final List<Map<String, dynamic>> _professions = [
    {'name': 'Électricien', 'icon': Icons.electrical_services_outlined},
    {'name': 'Plombier', 'icon': Icons.plumbing_outlined},
    {'name': 'Carreleur', 'icon': Icons.grid_on_outlined},
    {'name': 'Menuisier', 'icon': Icons.carpenter_outlined},
    {'name': 'Peintre', 'icon': Icons.format_paint_outlined},
    {'name': 'Tout corps d\'état', 'icon': Icons.handshake_outlined},
  ];

  void _handleSubmit() async {
    if (_selectedProfessions.isEmpty) return;

    final user = ref.read(authProvider).value;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erreur: Utilisateur non connecté')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      await ref.read(userRepositoryProvider).updateProfession(
            user.id,
            _selectedProfessions,
          );

      if (mounted) {
        context.go('/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur lors de l\'enregistrement: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final responsive = context.responsive;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppTheme.darkNavy),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: responsive.paddingSymmetric(horizontalPercent: 6.4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),

              // Logo
              Center(
                child: SvgPicture.asset(
                  'assets/icons/LOGO.svg',
                  height: 48,
                  colorFilter: const ColorFilter.mode(AppTheme.darkNavy, BlendMode.srcIn),
                ),
              ),

              const SizedBox(height: 40),

              // Title
              Text(
                'Quelle est votre profession ?',
                style: AppTheme.headingStyle(context).copyWith(fontSize: 28),
                textAlign: TextAlign.left,
              ),


              const SizedBox(height: 40),

              // Profession Grid
              Expanded(
                child: Center(
                  child: GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
                      childAspectRatio: 0.85,
                    ),
                  itemCount: _professions.length,
                  itemBuilder: (context, index) {
                    final profession = _professions[index];
                    final isSelected =
                        _selectedProfessions.contains(profession['name']);

                    return GestureDetector(
                      onTap: () {
                        setState(() {
                          if (isSelected) {
                            _selectedProfessions.remove(profession['name']);
                          } else {
                            _selectedProfessions.add(profession['name']);
                          }
                        });
                      },
                      child: Container(
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.darkNavy : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected
                                ? AppTheme.darkNavy
                                : const Color(0xFFE5E7EB),
                            width: 2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
                              blurRadius: 10,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              profession['icon'],
                              size: 40,
                              color:
                                  isSelected ? Colors.white : AppTheme.darkNavy,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              profession['name'],
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isSelected
                                    ? Colors.white
                                    : AppTheme.darkNavy,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              )),

              const SizedBox(height: 24),

              // Progress Indicator
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildDot(false),
                  const SizedBox(width: 8),
                  _buildDot(false),
                  const SizedBox(width: 8),
                  _buildDot(true),
                ],
              ),

              const SizedBox(height: 24),

              // Submit Button
              ElevatedButton(
                onPressed: _selectedProfessions.isNotEmpty && !_isLoading
                    ? _handleSubmit
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _selectedProfessions.isNotEmpty
                      ? AppTheme.darkNavy
                      : const Color(0xFFE5E7EB),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  disabledBackgroundColor: const Color(0xFFE5E7EB),
                  disabledForegroundColor: Colors.white,
                ),
                child: _isLoading
                    ? SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            color: Theme.of(context).colorScheme.surface, strokeWidth: 2))
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Créer mon compte',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (_selectedProfessions.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            const Icon(Icons.arrow_forward, size: 20),
                          ],
                        ],
                      ),
              ),

              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDot(bool isActive) {
    return Container(
      width: isActive ? 32 : 8,
      height: 8,
      decoration: BoxDecoration(
        color: isActive ? AppTheme.darkNavy : const Color(0xFFE5E7EB),
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}
