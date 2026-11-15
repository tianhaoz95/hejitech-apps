// The "Waypack Pro" sheet on a real iPhone: products come from the App Store (sandbox), prices and
// the free week show, and Restore Purchases is there. Buying needs a person (Apple's sheet).
//   flutter drive -d <iphone> --driver test_driver/integration_test.dart --target integration_test/pro_test.dart \
//     --dart-define=DEV_SIGN_IN=true --dart-define=API_URL=http://<mac-ip>:8787 --dart-define=SUPABASE_URL=http://<mac-ip>:55421
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:waypack/main.dart';
import 'package:waypack/services/pro_store.dart';

const email = String.fromEnvironment(
  'TEST_EMAIL',
  defaultValue: 'free@waypack.test',
);

Future<void> until(WidgetTester t, Finder f, {int seconds = 60}) async {
  for (var i = 0; i < seconds * 4 && f.evaluate().isEmpty; i++) {
    await t.pump(const Duration(milliseconds: 250));
  }
  if (f.evaluate().isEmpty) throw TestFailure('timed out waiting for $f');
}

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Waypack Pro sheet', (t) async {
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
    await t.pump(const Duration(milliseconds: 600));
    await t.ensureVisible(find.text('Dev sign-in'));
    await t.pump(const Duration(milliseconds: 300));
    await t.tap(find.text('Dev sign-in'));
    await until(t, find.byTooltip('Settings'));
    await t.tap(find.byTooltip('Settings'));
    await until(t, find.byKey(const Key('get-pro-row')));
    await t.tap(find.byKey(const Key('get-pro-row')));
    try {
      await until(t, find.byKey(const Key('buy-lifetime')), seconds: 45);
    } on TestFailure {
      // ignore: avoid_print
      print('NO PRODUCTS: available=${state.pro.available} error=${state.pro.error}');
      await binding.takeScreenshot('pro-sheet-no-products');
      rethrow;
    }
    for (var i = 0; i < 8; i++) {
      await t.pump(const Duration(milliseconds: 250));
    }
    // ignore: avoid_print
    print(
      'PRODUCTS: ${state.pro.products.values.map((p) => '${p.id}=${p.price}').join(', ')} introEligible=${state.pro.introEligible} error=${state.pro.error}',
    );
    expect(
      state.pro.products.keys,
      containsAll([ProStore.annualId, ProStore.lifetimeId]),
    );
    expect(find.byKey(const Key('restore-purchases')), findsOneWidget);
    await binding.takeScreenshot('pro-sheet');
  });
}
