import 'package:flutter_local_notifications/flutter_local_notifications.dart'
    hide Day;
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../models/manifest.dart';

class ScheduledBriefing {
  final int id;
  final String title;
  final String body;
  final DateTime scheduledDate;
  final String tripId;

  const ScheduledBriefing({
    required this.id,
    required this.title,
    required this.body,
    required this.scheduledDate,
    required this.tripId,
  });
}

/// Local reminder 72 h before a trip starts if it isn't downloaded, and daily morning briefings.
class Reminders {
  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;
  static bool debugTesting = false;
  static final List<ScheduledBriefing> debugScheduled = [];

  static Future<void> init() async {
    tzdata.initializeTimeZones();
    try {
      final local = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(local.identifier));
    } catch (_) {
      /* keep UTC */
    }
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
        macOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
    );
    _ready = true;
  }

  static Future<void> requestPermission() async {
    await _plugin
        .resolvePlatformSpecificImplementation<
          IOSFlutterLocalNotificationsPlugin
        >()
        ?.requestPermissions(alert: true, sound: true);
    await _plugin
        .resolvePlatformSpecificImplementation<
          MacOSFlutterLocalNotificationsPlugin
        >()
        ?.requestPermissions(alert: true, sound: true);
    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();
  }

  static int _id(String tripId) => tripId.hashCode & 0x7fffffff;
  static int _dayId(String tripId, int dayIndex) =>
      ((tripId.hashCode & 0x3fffffff) << 1) ^ (dayIndex + 1);

  /// Format the morning briefing message for a single day.
  static ({String title, String body}) formatBriefing({
    required String tripTitle,
    required Day day,
    required int dayIndex,
  }) {
    final dayLabel = day.title != null && day.title!.trim().isNotEmpty
        ? day.title!.trim()
        : 'Day ${dayIndex + 1}';
    final title = '$tripTitle · $dayLabel';
    final count = day.items.length;
    final String body;
    if (count == 0) {
      body = 'Free exploration day with no scheduled stops.';
    } else if (count == 1) {
      body = '1 stop planned today: ${day.items.first.title}.';
    } else {
      final first = day.items.first.title;
      body = '$count stops planned today, starting at $first.';
    }
    return (title: title, body: body);
  }

  /// Schedules daily 8:00 AM morning briefings for an active or upcoming trip itinerary.
  /// iOS keeps at most 64 pending local notifications and silently drops the rest (the
  /// 72-hour download reminder included), so a trip schedules only its next few mornings;
  /// the rest are scheduled as the app reschedules on later launches.
  static const maxBriefingsPerTrip = 10;

  static Future<void> scheduleDailyBriefings({
    required String tripId,
    required String tripTitle,
    required List<Day> days,
  }) async {
    await cancelDailyBriefings(tripId);
    if (!_ready && !debugTesting) return;

    final now = tz.TZDateTime.now(tz.local);
    var scheduled = 0;
    for (var i = 0; i < days.length && scheduled < maxBriefingsPerTrip; i++) {
      final day = days[i];
      final dt = DateTime.tryParse(day.date);
      if (dt == null) continue;

      final when = tz.TZDateTime(tz.local, dt.year, dt.month, dt.day, 8);

      // Skip past mornings
      if (!when.isAfter(now)) continue;

      final formatted = formatBriefing(
        tripTitle: tripTitle,
        day: day,
        dayIndex: i,
      );
      final id = _dayId(tripId, i);
      scheduled++;

      debugScheduled.add(
        ScheduledBriefing(
          id: id,
          title: formatted.title,
          body: formatted.body,
          scheduledDate: when,
          tripId: tripId,
        ),
      );

      if (_ready) {
        await _plugin.zonedSchedule(
          id: id,
          title: formatted.title,
          body: formatted.body,
          scheduledDate: when,
          notificationDetails: const NotificationDetails(
            android: AndroidNotificationDetails(
              'trip-daily-briefings',
              'Daily morning briefings',
              channelDescription: 'Morning briefings during active trips',
              importance: Importance.high,
            ),
            iOS: DarwinNotificationDetails(),
            macOS: DarwinNotificationDetails(),
          ),
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          payload: '$tripId:day:$i',
        );
      }
    }
  }

  /// Cancels all scheduled daily morning briefings for a trip.
  static Future<void> cancelDailyBriefings(
    String tripId, {
    int maxDays = 60,
  }) async {
    debugScheduled.removeWhere((s) => s.tripId == tripId);
    if (!_ready) return;
    for (var i = 0; i < maxDays; i++) {
      await _plugin.cancel(id: _dayId(tripId, i));
    }
  }

  /// Schedules (or cancels) the "download before you go" reminder for a trip.
  static Future<void> sync({
    required String tripId,
    required String title,
    required String? startDate,
    required bool downloaded,
  }) async {
    if (!_ready) return;
    final id = _id(tripId);
    await _plugin.cancel(id: id);
    if (downloaded || startDate == null) return;
    final start = DateTime.tryParse(startDate);
    if (start == null) return;
    final now = tz.TZDateTime.now(tz.local);
    // 9:00 local, three days before the start date.
    var when = tz.TZDateTime(
      tz.local,
      start.year,
      start.month,
      start.day,
      9,
    ).subtract(const Duration(hours: 72));
    final tripStart = tz.TZDateTime(
      tz.local,
      start.year,
      start.month,
      start.day,
    );
    if (!tripStart.isAfter(now)) return; // already started
    if (when.isBefore(now)) when = now.add(const Duration(minutes: 1));
    await _plugin.zonedSchedule(
      id: id,
      title: 'Download "$title" before you go',
      body: 'Your trip starts soon and isn\'t saved for offline use yet. Open Waypack and tap Download while you have signal.',
      scheduledDate: when,
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'trip-reminders',
          'Trip reminders',
          importance: Importance.high,
        ),
        iOS: DarwinNotificationDetails(),
        macOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      payload: tripId,
    );
  }
}
