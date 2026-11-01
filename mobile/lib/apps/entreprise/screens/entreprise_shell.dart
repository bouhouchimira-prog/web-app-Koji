import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:koji/design/koji_icons.dart';
import 'package:koji/design/koji_tokens.dart';
import 'package:koji/apps/entreprise/screens/entreprise_accueil_screen.dart';
import 'package:koji/apps/entreprise/screens/entreprise_list_screens.dart';
import 'package:koji/apps/entreprise/screens/entreprise_account_screens.dart';

export 'entreprise_accueil_screen.dart';
export 'entreprise_list_screens.dart';
export 'entreprise_account_screens.dart';

/// Shell layout for Entreprise app — responsive sidebar/bottom nav.
class EntrepriseShell extends StatefulWidget {
  final Widget child;
  const EntrepriseShell({super.key, required this.child});

  @override
  State<EntrepriseShell> createState() => _EntrepriseShellState();
}

class _EntrepriseShellState extends State<EntrepriseShell> {
  late double _screenWidth;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _screenWidth = MediaQuery.of(context).size.width;
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = _screenWidth < 768;
    final navItems = [
      ('Accueil', '/entreprise'),
      ('Devis', '/entreprise/devis'),
      ('Clients', '/entreprise/clients'),
      ('Équipe', '/entreprise/equipe'),
      ('Facturation', '/entreprise/facturation'),
      ('Profil', '/entreprise/profil'),
      ('Paramètres', '/entreprise/parametres'),
    ];

    if (isMobile) {
      return Scaffold(
        body: widget.child,
        bottomNavigationBar: BottomNavigationBar(
          items: navItems.sublist(0, 5).map((item) {
            return BottomNavigationBarItem(
              icon: const Icon(Icons.home),
              label: item.$1,
            );
          }).toList(),
          onTap: (idx) => context.go(navItems[idx].$2),
        ),
      );
    }

    return Scaffold(
      body: Row(
        children: [
          // Sidebar
          Drawer(
            child: ListView(
              children: [
                DrawerHeader(
                  child: Text(
                    'Koji Pro',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                for (final (label, route) in navItems)
                  ListTile(
                    title: Text(label),
                    onTap: () => context.go(route),
                  ),
                const Divider(),
                ListTile(
                  title: const Text('Déconnexion'),
                  onTap: () {
                    // TODO: logout
                  },
                ),
              ],
            ),
          ),
          // Content
          Expanded(child: widget.child),
        ],
      ),
    );
  }
}
