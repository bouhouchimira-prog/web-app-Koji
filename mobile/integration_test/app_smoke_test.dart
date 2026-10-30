import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:koji/app/koji_app.dart';
import 'package:koji/app/koji_app_config.dart';
import 'package:koji/design/koji_widgets.dart';

// Smoke test of the real app (real Supabase, no mocks), once per store app:
//   flutter test integration_test --flavor client     --dart-define=KOJI_APP=client     --dart-define-from-file=defines.json
//   flutter test integration_test --flavor entreprise --dart-define=KOJI_APP=entreprise --dart-define-from-file=defines.json
// defines.json holds SUPABASE_URL and SUPABASE_ANON_KEY, and optionally
// KOJI_TEST_EMAIL / KOJI_TEST_PASSWORD (a real test account) for the
// signed-in step, which is skipped when they are absent.
const _app = String.fromEnvironment('KOJI_APP', defaultValue: 'entreprise');
const _testEmail = String.fromEnvironment('KOJI_TEST_EMAIL');
const _testPassword = String.fromEnvironment('KOJI_TEST_PASSWORD');

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  final kind = _app == 'client' ? KojiAppKind.client : KojiAppKind.entreprise;
  final isClient = kind == KojiAppKind.client;
  final appName = isClient ? 'Koji' : 'Koji Pro';

  // One test body: runKojiApp initialises Supabase, which can only happen
  // once per process, and the test framework unmounts the app between tests.
  testWidgets('$appName : démarrage, page de connexion, erreurs, connexion',
      (tester) async {
    await runKojiApp(kind);

    await _pumpUntil(
      tester,
      () => find.text(appName).evaluate().isNotEmpty,
      "L'écran de démarrage n'affiche pas « $appName ».",
    );

    await _pumpUntil(
      tester,
      () => find.text('Se connecter').evaluate().isNotEmpty,
      "La page de connexion n'apparaît pas après le démarrage. Si une session "
      'est déjà ouverte sur cet appareil, déconnectez-vous puis relancez.',
    );
    expect(find.text('Adresse e-mail'), findsOneWidget);
    expect(find.text('Mot de passe'), findsOneWidget);

    // Sign-up tab and back.
    await _tap(tester, find.text('Créer un compte').first);
    expect(find.text('Créer mon compte'), findsOneWidget);
    await _tap(tester, find.text('Connexion').first);
    expect(find.text('Se connecter'), findsOneWidget);

    // Code login (ouvrier for Koji Pro, identifiant chantier for Koji) and back.
    await _tap(tester, find.text(isClient ? 'Identifiant chantier' : 'Ouvrier'));
    expect(find.text('Identifiant'), findsOneWidget);
    expect(
      find.text(isClient ? 'Accéder à mon chantier' : 'Accéder à mon espace ouvrier'),
      findsOneWidget,
    );
    await _tap(tester, find.text(isClient ? 'E-mail' : 'Entreprise'));
    expect(find.text('Se connecter'), findsOneWidget);

    // Wrong credentials: an error message, and we stay on the connexion page.
    await _fill(tester, 'Adresse e-mail', 'koji.integration.test@example.invalid');
    await _fill(tester, 'Mot de passe', 'mauvais-mot-de-passe-123');
    await _tap(tester, find.text('Se connecter'));
    await _pumpUntil(
      tester,
      () => find.byType(SnackBar).evaluate().isNotEmpty,
      "Aucun message d'erreur après une connexion avec un mauvais mot de passe.",
    );
    expect(find.text('Se connecter'), findsOneWidget);

    if (_testEmail.isEmpty || _testPassword.isEmpty) {
      debugPrint('KOJI_TEST_EMAIL/KOJI_TEST_PASSWORD absents : '
          'étape « connexion réelle » ignorée.');
      return;
    }

    await _fill(tester, 'Adresse e-mail', _testEmail);
    await _fill(tester, 'Mot de passe', _testPassword);
    await _tap(tester, find.text('Se connecter'));
    // The form fields (not the button, which may swap to a spinner while
    // loading) disappearing is what proves we left the connexion page.
    await _pumpUntil(
      tester,
      () => find.text('Adresse e-mail').evaluate().isEmpty,
      'La connexion avec le compte de test ne quitte pas la page de connexion.',
    );

    // Leave the device signed out so the next run starts on the connexion page.
    await Supabase.instance.client.auth.signOut();
  });
}

/// Pumps real frames until [done] is true. Integration tests run live, so
/// network calls (Supabase) progress while we wait; pumpAndSettle is avoided
/// because spinners and decorative animations never settle.
Future<void> _pumpUntil(
  WidgetTester tester,
  bool Function() done,
  String failure, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final deadline = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(deadline)) {
    await tester.pump(const Duration(milliseconds: 200));
    if (done()) return;
  }
  fail(failure);
}

Future<void> _tap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pump(const Duration(milliseconds: 300));
  await tester.tap(finder);
  await tester.pump(const Duration(milliseconds: 400));
}

Future<void> _fill(WidgetTester tester, String label, String text) async {
  final field = find.descendant(
    of: find.widgetWithText(KojiField, label),
    matching: find.byType(TextField),
  );
  await tester.ensureVisible(field);
  await tester.enterText(field, text);
  await tester.pump(const Duration(milliseconds: 200));
}
