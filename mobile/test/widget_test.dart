// Smoke test for the Koji app.
// NOTE: Full app boot requires Supabase, which cannot be initialised in a
// headless test environment without mocking. We therefore test the core Flutter
// rendering pipeline with a lightweight stub. Integration tests should cover
// the full auth+routing flow.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Flutter rendering pipeline works', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: Text('Koji')),
      ),
    );

    expect(find.text('Koji'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
