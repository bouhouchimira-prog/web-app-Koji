import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Router redirect that sends signed-out visitors to the connexion page — on
/// the web anyone can open `/#/home` directly. Supabase restores the stored
/// session during `initialize`, so the check is synchronous.
///
/// The worker space and the client "identifiant chantier" space have no
/// Supabase session; they are opened with `Navigator.push` from `/login` and
/// never go through the router, so the guard doesn't affect them.
GoRouterRedirect kojiSessionGuard(Set<String> publicPaths) {
  return (context, state) {
    if (publicPaths.contains(state.matchedLocation)) return null;
    final signedIn = Supabase.instance.client.auth.currentSession != null;
    return signedIn ? null : '/login';
  };
}
