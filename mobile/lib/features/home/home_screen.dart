import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/apps/entreprise/entreprise_actions.dart';
import 'package:koji/apps/entreprise/entreprise_dashboard.dart';
import 'package:koji/apps/entreprise/entreprise_nav.dart';
import 'package:koji/apps/entreprise/entreprise_sidebar.dart';
import 'package:koji/core/theme.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/features/home/notifications/notifications_panel.dart';
import 'package:koji/features/home/widgets/bottom_nav_item.dart';
import 'package:koji/features/home/widgets/home_header.dart';
import 'package:koji/features/quote/chantier_list_screen.dart';
import 'package:koji/features/quote/quote_list_screen.dart';

/// Entreprise home (`/home`): tableau de bord, devis and chantiers tabs.
///
/// The selected tab lives in [entrepriseHomeTabProvider] so the side menu of
/// the web layout, the phone bottom bar and notifications can all switch it.
/// Background activity (signature / message / worker-report notifications,
/// trial start) runs in the app shell — see EntrepriseActivityWatcher.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  void _setTab(int index) =>
      ref.read(entrepriseHomeTabProvider.notifier).state = index;

  /// Open the notifications panel; tapping a notification jumps to the Devis tab.
  Future<void> _openNotifications() async {
    final tapped = await NotificationsPanel.show(context);
    if (tapped == true && mounted) _setTab(1);
  }

  void _onItemTapped(int index) {
    if (index == 3) {
      _showToolsSheet();
      return;
    }
    _setTab(index);
  }

  void _guard(VoidCallback action) =>
      guardEntrepriseAccess(context, ref, action);

  void _showToolsSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          decoration: BoxDecoration(
            color: AppTheme.surface(context),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppTheme.borderColor(context),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Spacer(),
                    InkWell(
                      onTap: () => Navigator.pop(context),
                      borderRadius: BorderRadius.circular(18),
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: AppTheme.mutedSurface(context),
                          borderRadius: BorderRadius.circular(16),
                          border:
                              Border.all(color: AppTheme.borderColor(context)),
                        ),
                        child: Icon(
                          Icons.close,
                          size: 18,
                          color: AppTheme.textPrimary(context),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildPlusActionItem(
                      label: 'Photo',
                      icon: Icons.photo_camera,
                      onTap: () {
                        Navigator.pop(context);
                        _guard(() => context
                            .push('/quote/room-selection', extra: <String>[]));
                      },
                    ),
                    _buildPlusActionItem(
                      label: 'Tâche',
                      icon: Icons.fact_check,
                      onTap: () {
                        Navigator.pop(context);
                        _guard(() => context.push('/chantier/add-task',
                            extra: <String, dynamic>{}));
                      },
                    ),
                    _buildPlusActionItem(
                      label: 'Dépense',
                      icon: Icons.payments,
                      onTap: () {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Dépenses bientôt disponibles')),
                        );
                      },
                    ),
                    _buildPlusActionItem(
                      label: 'Messages',
                      icon: Icons.forum_outlined,
                      onTap: () {
                        Navigator.pop(context);
                        context.push('/messages');
                      },
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildPlusActionItem({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppTheme.mutedSurface(context),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Icon(
              icon,
              size: 30,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = ref.watch(entrepriseHomeTabProvider);
    final wide = MediaQuery.sizeOf(context).width >= KojiBreakpoints.wide;

    // Web layout: the shell already shows the top band and the side menu.
    if (wide) {
      Widget readable(Widget child) => Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 960),
              child: child,
            ),
          );
      return Scaffold(
        body: IndexedStack(
          index: selectedIndex.clamp(0, 2),
          children: [
            const EntrepriseDashboard(),
            readable(const QuoteListScreen()),
            readable(const ChantierListScreen()),
          ],
        ),
      );
    }

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      drawer: Drawer(
        child: SafeArea(
          child: EntrepriseSidebar(
            inDrawer: true,
            activeId: entrepriseActiveNav('/home', selectedIndex),
          ),
        ),
      ),
      body: Stack(
        children: [
          IndexedStack(
            index: selectedIndex.clamp(0, 2),
            children: [
              Column(
                children: [
                  HomeHeader(
                    onMenuTap: () => _scaffoldKey.currentState?.openDrawer(),
                    onNotificationsTap: _openNotifications,
                  ),
                  const Expanded(
                    // Leave room for the floating bottom bar.
                    child: EntrepriseDashboard(bottomPadding: 120),
                  ),
                ],
              ),
              const QuoteListScreen(),
              const ChantierListScreen(),
            ],
          ),

          // Bottom Navigation Bar
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.only(top: 16, bottom: 24),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                border: Border(top: BorderSide(color: context.koji.line)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  GestureDetector(
                    onTap: () => _onItemTapped(0),
                    child: BottomNavItem(
                      icon: Icons.home_filled,
                      label: 'Accueil',
                      isActive: selectedIndex == 0,
                      activeColor: context.koji.navActiveFg,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _onItemTapped(1),
                    child: BottomNavItem(
                      icon: Icons.description_outlined,
                      label: 'Devis',
                      isActive: selectedIndex == 1,
                      activeColor: context.koji.navActiveFg,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _onItemTapped(2),
                    child: BottomNavItem(
                      icon: Icons.handyman_outlined,
                      label: 'Chantier',
                      isActive: selectedIndex == 2,
                      activeColor: context.koji.navActiveFg,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _onItemTapped(3),
                    child: BottomNavItem(
                      icon: Icons.more_horiz,
                      label: 'Plus',
                      isActive: false,
                      activeColor: context.koji.navActiveFg,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
