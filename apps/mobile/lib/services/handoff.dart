import 'dart:io';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../widgets/scrapbook.dart';

/// Native hand-offs used by the SDK bridge and native screens (design §7.2).
class Handoff {
  static const _mapsAppKey = 'maps_app';
  static const mapsAppNames = {
    'apple': 'Apple Maps',
    'google': 'Google Maps',
    'waze': 'Waze',
  };

  /// The maps app the user chose to always use on this device, or null to ask.
  static Future<String?> rememberedMapsApp() async =>
      (await SharedPreferences.getInstance()).getString(_mapsAppKey);

  static Future<void> setRememberedMapsApp(String? app) async {
    final prefs = await SharedPreferences.getInstance();
    app == null
        ? await prefs.remove(_mapsAppKey)
        : await prefs.setString(_mapsAppKey, app);
  }

  static Future<bool> _installed(String scheme) async {
    try {
      return await canLaunchUrl(Uri.parse('$scheme://'));
    } catch (_) {
      return false;
    }
  }

  /// Maps apps offered on this device, with whether each opens natively.
  static Future<Map<String, bool>> availableMapsApps() async => {
    'apple': true,
    'google': Platform.isIOS && await _installed('comgooglemaps'),
    if (Platform.isIOS && await _installed('waze')) 'waze': true,
  };

  /// Hands a place to a maps app. With `app: 'auto'` on iPhone/Mac it uses the remembered
  /// app, or asks (Apple Maps, Google Maps, Waze) with an option to remember the choice.
  /// A page's explicit app wins (a trip's `nav_app` doesn't reach here). Android keeps the
  /// system's default.
  static Future<void> navigateTo(
    BuildContext context, {
    required double lat,
    required double lon,
    String? label,
    String app = 'auto',
    bool navigate = true,
    String? fallbackUrl,
  }) async {
    if (app == 'auto' && (Platform.isIOS || Platform.isMacOS)) {
      final chosen =
          await rememberedMapsApp() ??
          (context.mounted ? await _chooseMapsApp(context, label) : null);
      if (chosen == null) return;
      // The page's fallback URL was built for its default app, not the chosen one.
      return openInMaps(
        lat: lat,
        lon: lon,
        label: label,
        app: chosen,
        navigate: navigate,
      );
    }
    return openInMaps(
      lat: lat,
      lon: lon,
      label: label,
      app: app,
      navigate: navigate,
      fallbackUrl: fallbackUrl,
    );
  }

  static Future<String?> _chooseMapsApp(
    BuildContext context,
    String? label,
  ) async {
    final apps = await availableMapsApps();
    if (!context.mounted) return null;
    var remember = false;
    final app = await showMapsAppSheet(
      context,
      apps: apps,
      title: label == null ? 'Open in…' : 'Directions to $label',
      footer: StatefulBuilder(
        builder: (ctx, setState) => PaperRow(
          icon: Icons.push_pin_outlined,
          chip: ChipColor.yellow,
          title: 'Remember my choice',
          subtitle: 'Change it any time in Settings',
          trailing: Switch.adaptive(
            value: remember,
            onChanged: (v) => setState(() => remember = v),
          ),
          onTap: () => setState(() => remember = !remember),
        ),
      ),
    );
    if (app != null && remember) await setRememberedMapsApp(app);
    return app;
  }

  /// A sheet listing [apps]; pops the chosen key ('ask' for [askOption]).
  static Future<String?> showMapsAppSheet(
    BuildContext context, {
    required Map<String, bool> apps,
    required String title,
    Widget? footer,
    bool askOption = false,
    String? selected,
  }) => showPaperSheet<String>(
    context,
    builder: (ctx) {
      Widget? check(String key) =>
          selected == key ? Icon(Icons.check, color: Paper.of(ctx).ink) : null;
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 0, 22, 14),
            child: Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: hand(30, Paper.of(ctx).ink),
            ),
          ),
          PaperCard(
            children: [
              if (askOption)
                PaperRow(
                  icon: Icons.help_outline,
                  chip: ChipColor.lilac,
                  title: 'Ask every time',
                  trailing: check('ask'),
                  onTap: () => Navigator.pop(ctx, 'ask'),
                ),
              for (final e in apps.entries)
                PaperRow(
                  icon: switch (e.key) {
                    'apple' => Icons.map_outlined,
                    'google' => Icons.public,
                    _ => Icons.directions_car_outlined,
                  },
                  chip: switch (e.key) {
                    'apple' => ChipColor.pink,
                    'google' => ChipColor.blue,
                    _ => ChipColor.mint,
                  },
                  title: mapsAppNames[e.key]!,
                  subtitle: e.value
                      ? null
                      : 'Opens in the browser · needs a connection',
                  trailing: check(e.key),
                  onTap: () => Navigator.pop(ctx, e.key),
                ),
            ],
          ),
          if (footer != null) ...[
            const SizedBox(height: 12),
            PaperCard(children: [footer]),
          ],
        ],
      );
    },
  );

  /// Opens Google Maps / Apple Maps / Waze for a coordinate. Prefers the installed app.
  static Future<void> openInMaps({
    required double lat,
    required double lon,
    String? label,
    String app = 'auto',
    bool navigate = true,
    String? fallbackUrl,
  }) async {
    final ll = '$lat,$lon';
    final q = label == null ? '' : Uri.encodeComponent(label);
    final apple = Platform.isIOS || Platform.isMacOS;
    final useApple = app == 'apple' || (app == 'auto' && apple);
    final candidates = <Uri>[];
    // maps:// opens Apple Maps on iPhone, iPad and Mac.
    if (app == 'waze') {
      candidates.add(
        Uri.parse('waze://?ll=$ll${navigate ? '&navigate=yes' : ''}'),
      );
    } else if (useApple && apple) {
      candidates.add(
        Uri.parse(
          navigate
              ? 'maps://?daddr=$ll${q.isEmpty ? '' : '&q=$q'}'
              : 'maps://?ll=$ll&q=${q.isEmpty ? ll : q}',
        ),
      );
    } else if (Platform.isIOS) {
      candidates.add(
        Uri.parse(
          navigate
              ? 'comgooglemaps://?daddr=$ll&directionsmode=driving'
              : 'comgooglemaps://?q=$ll&center=$ll',
        ),
      );
    } else if (Platform.isAndroid) {
      candidates.add(
        Uri.parse(
          navigate
              ? 'google.navigation:q=$ll'
              : 'geo:$ll?q=$ll${q.isEmpty ? '' : '($q)'}',
        ),
      );
    }
    candidates.add(
      Uri.parse(
        fallbackUrl ??
            (app == 'waze'
                ? 'https://waze.com/ul?ll=$ll${navigate ? '&navigate=yes' : ''}'
                : useApple
                ? 'https://maps.apple.com/?${navigate ? 'daddr' : 'll'}=$ll${q.isEmpty ? '' : '&q=$q'}'
                : navigate
                ? 'https://www.google.com/maps/dir/?api=1&destination=$ll'
                : 'https://www.google.com/maps/search/?api=1&query=$ll'),
      ),
    );
    for (final u in candidates) {
      try {
        if (await launchUrl(u, mode: LaunchMode.externalApplication)) return;
      } catch (_) {
        /* try next */
      }
    }
  }

  static Future<void> openExternal(String url) async {
    final u = Uri.tryParse(url);
    if (u == null ||
        !const {
          'http',
          'https',
          'tel',
          'mailto',
          'sms',
          'maps',
          'geo',
        }.contains(u.scheme)) {
      return;
    }
    await launchUrl(u, mode: LaunchMode.externalApplication);
  }

  static Future<void> share(String text) =>
      SharePlus.instance.share(ShareParams(text: text));
}
