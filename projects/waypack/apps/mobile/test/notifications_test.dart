import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;
import 'package:waypack/models/manifest.dart';
import 'package:waypack/services/notifications.dart';

void main() {
  setUpAll(() {
    tzdata.initializeTimeZones();
    tz.setLocalLocation(tz.UTC);
    Reminders.debugTesting = true;
  });

  setUp(() {
    Reminders.debugScheduled.clear();
  });

  test('formatBriefing formats day agenda accurately', () {
    final dayMulti = Day({
      'date': '2026-10-25',
      'title': 'Historic Higashiyama',
      'items': [
        {'title': 'Kiyomizu-dera', 'time': '09:00'},
        {'title': 'Sannenzaka & Ninenzaka', 'time': '11:00'},
        {'title': 'Kodaiji Temple', 'time': '14:00'},
      ],
    });
    final multiResult = Reminders.formatBriefing(
      tripTitle: 'Kyoto Fall Break',
      day: dayMulti,
      dayIndex: 0,
    );
    expect(multiResult.title, 'Kyoto Fall Break · Historic Higashiyama');
    expect(
      multiResult.body,
      '3 stops planned today, starting at Kiyomizu-dera.',
    );

    final daySingle = Day({
      'date': '2026-10-26',
      'title': '',
      'items': [
        {'title': 'Fushimi Inari Shrine', 'time': '07:30'},
      ],
    });
    final singleResult = Reminders.formatBriefing(
      tripTitle: 'Kyoto Fall Break',
      day: daySingle,
      dayIndex: 1,
    );
    expect(singleResult.title, 'Kyoto Fall Break · Day 2');
    expect(singleResult.body, '1 stop planned today: Fushimi Inari Shrine.');

    final dayFree = Day({
      'date': '2026-10-27',
      'title': 'Rest Day',
      'items': [],
    });
    final freeResult = Reminders.formatBriefing(
      tripTitle: 'Kyoto Fall Break',
      day: dayFree,
      dayIndex: 2,
    );
    expect(freeResult.title, 'Kyoto Fall Break · Rest Day');
    expect(freeResult.body, 'Free exploration day with no scheduled stops.');
  });

  test('scheduleDailyBriefings schedules future 8am notifications', () async {
    final nextYear = DateTime.now().year + 1;
    final days = [
      Day({
        'date': '$nextYear-04-10',
        'title': 'Arashiyama Bamboo Grove',
        'items': [
          {'title': 'Tenryu-ji Garden', 'time': '09:30'},
          {'title': 'Monkey Park', 'time': '13:00'},
        ],
      }),
      Day({
        'date': '$nextYear-04-11',
        'title': 'Gion Evening Walk',
        'items': [
          {'title': 'Yasaka Shrine', 'time': '16:00'},
        ],
      }),
    ];

    await Reminders.scheduleDailyBriefings(
      tripId: 'kyoto-2026',
      tripTitle: 'Kyoto Spring',
      days: days,
    );

    expect(Reminders.debugScheduled.length, 2);
    expect(Reminders.debugScheduled[0].tripId, 'kyoto-2026');
    expect(Reminders.debugScheduled[0].scheduledDate.hour, 8);
    expect(
      Reminders.debugScheduled[0].title,
      'Kyoto Spring · Arashiyama Bamboo Grove',
    );
    expect(Reminders.debugScheduled[0].body, contains('2 stops planned today'));

    // Canceling clears scheduled items
    await Reminders.cancelDailyBriefings('kyoto-2026');
    expect(Reminders.debugScheduled.isEmpty, isTrue);
  });

  testWidgets('renders morning briefing lockscreen notification banner', (
    t,
  ) async {
    final key = GlobalKey();
    t.view.physicalSize = const Size(1170, 600);
    t.view.devicePixelRatio = 3;
    addTearDown(t.view.reset);

    await t.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData.dark(),
        home: Scaffold(
          backgroundColor: const Color(0xFF1C1C1E),
          body: Center(
            child: RepaintBoundary(
              key: key,
              child: Container(
                width: 360,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xDD2C2C2E),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.white24, width: 0.5),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black54,
                      blurRadius: 20,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 24,
                          height: 24,
                          decoration: BoxDecoration(
                            color: const Color(0xFFC2562D),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Icon(
                            Icons.luggage,
                            size: 14,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Text(
                          'WAYPACK',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.8,
                            color: Colors.white70,
                          ),
                        ),
                        const Spacer(),
                        const Text(
                          '8:00 AM',
                          style: TextStyle(fontSize: 11, color: Colors.white38),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Kyoto Fall Break · Historic Higashiyama',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      '3 stops planned today, starting at Kiyomizu-dera. Tap to view your offline map and timeline.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Colors.white70,
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await t.pumpAndSettle();

    await t.runAsync(() async {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final img = await boundary.toImage(pixelRatio: 2);
      final png = await img.toByteData(format: ui.ImageByteFormat.png);
      const outPath =
          '/Volumes/DATA/GitHub/hejitech-apps/reports/2026-10-21-build-next/site/media/waypack/morning-briefing-notifs.png';
      File(outPath).writeAsBytesSync(png!.buffer.asUint8List());
    });
  });

  test('a long trip schedules only its next few mornings', () async {
    final start = DateTime.now().add(const Duration(days: 1));
    final days = [
      for (var i = 0; i < 30; i++)
        Day({
          'date': start
              .add(Duration(days: i))
              .toIso8601String()
              .substring(0, 10),
          'title': 'Day',
          'items': [],
        }),
    ];
    await Reminders.scheduleDailyBriefings(
      tripId: 'long',
      tripTitle: 'Long trip',
      days: days,
    );
    expect(Reminders.debugScheduled, hasLength(Reminders.maxBriefingsPerTrip));
    expect(Reminders.debugScheduled.first.scheduledDate.day, start.day);
  });
}
