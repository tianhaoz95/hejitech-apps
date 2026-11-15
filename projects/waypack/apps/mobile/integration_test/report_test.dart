// Reporting a gallery trip on a simulator against the local stack (DECISIONS #73): Discover → a trip →
// Report → reason + "Hide trips from this traveler" → the trip and its author's other trips are gone.
// Prereqs: local stack and Worker running, `node services/mcp/scripts/seed-templates.mjs`.
//   flutter drive -d <simulator> --driver test_driver/integration_test.dart --target integration_test/report_test.dart \
//     --dart-define=DEV_SIGN_IN=true --dart-define=NO_PERMISSION_PROMPTS=true
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:waypack/main.dart';

const email = String.fromEnvironment(
  'TEST_EMAIL',
  defaultValue: 'reporter@waypack.test',
);

Future<void> until(WidgetTester t, Finder f, {int seconds = 60}) async {
  for (var i = 0; i < seconds * 4 && f.evaluate().isEmpty; i++) {
    await t.pump(const Duration(milliseconds: 250));
  }
  if (f.evaluate().isEmpty) throw TestFailure('timed out waiting for $f');
}

Future<void> settle(WidgetTester t, [int ms = 1200]) async {
  for (var i = 0; i < ms ~/ 100; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('report a gallery trip', (t) async {
    final state = await bootstrap();
    if (Supabase.instance.client.auth.currentSession != null) {
      await state.signOut();
    }
    await t.pumpWidget(
      ChangeNotifierProvider.value(value: state, child: const WaypackApp()),
    );
    await until(t, find.byKey(const Key('dev-email')));
    await t.enterText(find.byKey(const Key('dev-email')), email);
    FocusManager.instance.primaryFocus?.unfocus();
    await settle(t, 600);
    await t.ensureVisible(find.text('Dev sign-in'));
    await t.tap(find.text('Dev sign-in'));
    await until(t, find.byKey(const Key('open-discover')));
    await t.tap(find.byKey(const Key('open-discover')));
    await settle(t, 3000);

    // The first postcard on the Discover home.
    final cards = find.byWidgetPredicate(
      (w) => w.runtimeType.toString() == 'Postcard',
    );
    await until(t, cards);
    await t.tap(cards.first, warnIfMissed: false);
    await until(t, find.byKey(const Key('report-template')));
    await t.tap(find.byKey(const Key('report-template')));
    await until(t, find.byKey(const Key('report-reason-misleading')));
    await t.tap(find.byKey(const Key('report-reason-misleading')));
    await t.tap(find.byKey(const Key('report-block')));
    await settle(t, 600);
    await binding.takeScreenshot('report-sheet');
    await t.tap(find.byKey(const Key('report-send')));
    await until(t, find.textContaining('Thanks for the report'));
    await settle(t, 2500);
    await binding.takeScreenshot('after-report');
  });
}
