// The Waypack promo's walkthrough (branding/promo-videos/scripts/waypack-launch-record.mjs copies it
// into apps/mobile/integration_test/ for the run and removes it afterwards). It prints
// `BEAT:<name>:start|end` around each story beat and `HOST:<cmd>` when the host should act (status
// bar, simulated location); the host records the simulator screen and cuts the beats out.
// Local stack and the seeded example trip only (seed-dev.mjs promo@waypack.test).
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:waypack/main.dart';
import 'package:waypack/screens/trip_screen.dart';
import 'package:waypack/widgets/bundle_webview.dart';

const email = String.fromEnvironment('TEST_EMAIL', defaultValue: 'promo@waypack.test');

Future<void> settle(WidgetTester t, [int ms = 1500]) async {
  for (var i = 0; i < ms ~/ 100; i++) {
    await t.pump(const Duration(milliseconds: 100));
  }
}

Future<void> until(WidgetTester t, Finder f) async {
  for (var i = 0; i < 400 && f.evaluate().isEmpty; i++) {
    await t.pump(const Duration(milliseconds: 300));
  }
}

// ignore: avoid_print
void say(String s) => print(s);

Future<void> js(WidgetTester t, String code) async {
  await BundleWebView.debugLastController?.evaluateJavascript(source: code);
  await settle(t, 200);
}

/// Smooth scroll of the page's window (or an element) by dy over ms, in small steps so the
/// screen recording shows motion, not jumps.
Future<void> glide(WidgetTester t, int dy, int ms) async {
  await js(t, "window.scrollBy({top: $dy, behavior: 'smooth'})");
  await settle(t, ms);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('waypack promo', (t) async {
    // The simulator can't grant notification permission without a prompt (NO_PERMISSION_PROMPTS),
    // and the app would show "Couldn't refresh" when scheduling briefings fails: answer the
    // notifications plugin's channel here instead. Nothing else in the app is faked.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('dexterous.com/flutter/local_notifications'),
      (call) async => call.method.contains('ending') || call.method.contains('ctive') ? <Object>[] : null,
    );
    final state = await bootstrap();
    if (Supabase.instance.client.auth.currentSession != null) {
      await state.signOut();
    }
    for (final e in [...state.upcoming, ...state.past]) {
      await state.store.deleteLocal(e.id);
    }
    await t.pumpWidget(ChangeNotifierProvider.value(value: state, child: const WaypackApp()));
    await t.enterText(find.byKey(const Key('dev-email')), email);
    FocusManager.instance.primaryFocus?.unfocus(); // the keyboard covers the button
    await settle(t, 1000);
    await t.ensureVisible(find.text('Dev sign-in'));
    await settle(t, 500);
    await t.tap(find.text('Dev sign-in'));
    await until(t, find.byTooltip('Not downloaded'));
    await settle(t, 1500);

    // 1 · Download on the Wi-Fi (online status bar).
    say('HOST:online');
    await settle(t, 1500);
    say('BEAT:download:start');
    await settle(t, 1200);
    await t.tap(find.byTooltip('Not downloaded'));
    await until(t, find.byTooltip('Available offline'));
    await settle(t, 2500);
    say('BEAT:download:end');

    // From here on: zero bars.
    say('HOST:offline');
    await settle(t, 1500);

    // 2 · Today: what's now and what's next (FAKE_NOW = Christmas morning, 10:05).
    await t.tap(find.byTooltip('Available offline'));
    await settle(t, 6000);
    t.state<TripScreenState>(find.byType(TripScreen)).openMenu();
    await settle(t, 1200);
    await t.tap(find.text('Today'));
    await until(t, find.text('Sledding & snow play'));
    await settle(t, 1500);
    say('BEAT:today:start');
    await settle(t, 2500);
    final list = find.byType(Scrollable).first;
    for (var i = 0; i < 8; i++) {
      await t.drag(list, const Offset(0, -45));
      await settle(t, 120);
    }
    await settle(t, 1800);
    say('BEAT:today:end');
    // Where you're staying: the lodge, its check-in, further down the same screen.
    final stay = find.text('Where you\'re staying');
    for (var i = 0; i < 80 && (stay.evaluate().isEmpty || t.getTopLeft(stay).dy > 520); i++) {
      await t.drag(list, const Offset(0, -60));
      await settle(t, 60);
    }
    await settle(t, 1200);
    say('BEAT:stay:start');
    await settle(t, 1000);
    for (var i = 0; i < 6; i++) {
      await t.drag(list, const Offset(0, -40));
      await settle(t, 140);
    }
    await settle(t, 2200);
    say('BEAT:stay:end');
    await t.pageBack();
    await settle(t, 2000);

    // 3 · The plan: day 2 with the why, then the backup plans in the guide.
    await js(t, "location.hash = '#plan'");
    await settle(t, 1500);
    say('BEAT:plan:start');
    await settle(t, 1200);
    await js(t, "(() => { const d = document.querySelectorAll('#tab-plan section.day')[1]; window.scrollTo({top: scrollY + d.getBoundingClientRect().top - 70, behavior: 'smooth'}); })()");
    await settle(t, 2200);
    for (var i = 0; i < 3; i++) {
      await glide(t, 240, 900);
    }
    await settle(t, 800);
    await js(t, "location.hash = '#g-backup'");
    await settle(t, 1500);
    await glide(t, -70, 700);
    await settle(t, 2200);
    await glide(t, 220, 1500);
    await settle(t, 1200);
    say('BEAT:plan:end');
    await js(t, "location.hash = '#today'; window.scrollTo(0,0)");
    await settle(t, 1000);

    // 4 · The offline map with the GPS dot moving along the route to the snow play area.
    t.state<TripScreenState>(find.byType(TripScreen)).openMenu();
    await settle(t, 1200);
    await t.tap(find.text('Map'));
    await settle(t, 7000);
    await js(t, "(() => { const s = document.getElementById('day'); s.value = s.options[2].value; s.dispatchEvent(new Event('change')); })()");
    await settle(t, 2500);
    // The GPS dot: a simulated position moving along day 2's drive (the route in the trip itself),
    // fed to the page's geolocation so the map's own location control draws and follows it. The
    // simulator's location-permission prompt can't be answered from a test, so this replaces it.
    await js(t, _fakeGps);
    await settle(t, 1500);
    await js(t, "document.querySelector('.maplibregl-ctrl-geolocate')?.click()");
    await settle(t, 3500);
    await js(t, "window.__wpDrive && window.__wpDrive()");
    say('BEAT:map:start');
    await settle(t, 14000);
    say('BEAT:map:end');
    await settle(t, 1000);
  });
}

const _fakeGps = r"""
(async () => {
  const m = await (await fetch('manifest.json')).json();
  const c = m.routes.find((r) => r.id === 'r-d2-wolverton').geometry.coordinates;
  let i = 0, n = 0;
  const subs = new Map();
  const pos = () => ({ coords: { latitude: c[i][1], longitude: c[i][0], accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: 12 }, timestamp: Date.now() });
  const geo = {
    getCurrentPosition(ok) { setTimeout(() => ok(pos()), 50); },
    watchPosition(ok) { const id = ++n; subs.set(id, ok); setTimeout(() => ok(pos()), 50); return id; },
    clearWatch(id) { subs.delete(id); },
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  if (navigator.permissions) {
    const q = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (d) => (d && d.name === 'geolocation' ? Promise.resolve({ state: 'granted', onchange: null, addEventListener() {} }) : q(d));
  }
  window.__wpDrive = () => {
    const t = setInterval(() => { i = Math.min(i + 1, c.length - 1); subs.forEach((f) => f(pos())); if (i >= c.length - 1) clearInterval(t); }, 110);
  };
})()
""";
