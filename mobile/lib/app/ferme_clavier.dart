import 'package:flutter/widgets.dart';

/// Ferme le clavier (retours du build 64 : après « Envoyer le devis », le
/// clavier restait ouvert jusqu'à l'accueil et d'un onglet à l'autre).
void fermerClavier() => FocusManager.instance.primaryFocus?.unfocus();

/// À chaque changement d'écran, le champ de l'écran quitté perd la main : le
/// clavier ne suit pas l'utilisateur sur l'écran suivant.
class FermeClavierObserver extends NavigatorObserver {
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      fermerClavier();

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      fermerClavier();

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      fermerClavier();

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      fermerClavier();
}

/// Toucher en dehors d'un champ ferme le clavier. Un champ, un bouton ou une
/// liste que l'on fait défiler gardent leur geste : ce détecteur ne reçoit
/// que les touchers que personne d'autre n'a pris.
class FermeClavierAuToucher extends StatelessWidget {
  const FermeClavierAuToucher({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: fermerClavier,
        child: child,
      );
}
