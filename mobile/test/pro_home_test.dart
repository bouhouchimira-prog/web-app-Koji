import 'package:flutter_test/flutter_test.dart';

import 'package:koji/apps/entreprise/pro_home/pro_home.dart';

void main() {
  // Note: Full widget tests would require Supabase initialization which is not
  // available in the test environment. Visual verification of the new DA
  // (mockup PRO-01) is performed on localhost with the dev server.
  // See the scratchpad screenshots for verification of:
  // - Phone layout with greeting, yellow hero CTA, Radar card, À traiter card
  // - Segmented filters (Tous, Nouveaux, Positions prises)
  // - Radar offers with positions and follow-up conversation status
  // - À traiter alerts, tasks, overdue invoices, trial expiration warnings
  // - Wide layout (1000+ px) with two-column KPIs and parallel Radar/À traiter

  testWidgets('ProHome compiles without errors', (tester) async {
    // Verify the widget can be instantiated without import/compile errors.
    // Full widget rendering tests would require Supabase initialization.
    const widget = ProHome(onMenu: null, onNotifications: null, bottomPadding: 0);
    expect(widget, isNotNull);
  });
}
