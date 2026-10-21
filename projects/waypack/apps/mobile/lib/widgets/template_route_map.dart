import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/template.dart';
import '../state/app_state.dart';
import 'bundle_webview.dart';
import 'postcard.dart';
import 'scrapbook.dart';

/// A gallery template's route: the hand-drawn sketch ([RouteMapPainter]) with its day legend,
/// replaced by the real online map once it can load (Settings → Online map on, and the basemap
/// answers), like the website's template page. Templates aren't downloaded, so the map page
/// reads a manifest built from the template ([TripTemplate.mapManifest]) that the local server
/// serves as a virtual trip.
class TemplateRouteMap extends StatefulWidget {
  const TemplateRouteMap({super.key, required this.t});
  final TripTemplate t;

  static bool canDraw(TripTemplate t) => RouteMapPainter.canDraw(t);

  @override
  State<TemplateRouteMap> createState() => _TemplateRouteMapState();
}

class _TemplateRouteMapState extends State<TemplateRouteMap> {
  bool _online = false; // the basemap answered: show the live map
  bool _loaded = false; // the map page finished loading

  String get _tripId => 'template-${widget.t.slug}';

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare() async {
    final s = context.read<AppState>();
    final manifest = widget.t.mapManifest();
    final basemap = s.server.publicBasemap;
    if (!s.useOnlineMap || manifest == null || basemap == null) return;
    s.server.virtualManifests[_tripId] = jsonEncode(manifest);
    if (await _reachable(basemap) && mounted) setState(() => _online = true);
  }

  /// One tiny range read of the basemap: offline or on a captive network the sketch stays.
  static Future<bool> _reachable(String url) async {
    final client = HttpClient()..connectionTimeout = const Duration(seconds: 6);
    try {
      final req = await client.getUrl(Uri.parse(url));
      req.headers.set(HttpHeaders.rangeHeader, 'bytes=0-15');
      final res = await req.close().timeout(const Duration(seconds: 8));
      await res.drain<void>();
      return res.statusCode == HttpStatus.partialContent;
    } catch (_) {
      return false;
    } finally {
      client.close(force: true);
    }
  }

  void _openFull() {
    final s = context.read<AppState>();
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FullTemplateMap(title: widget.t.title, url: s.server.tripUrl(_tripId, page: '__waypack_map.html')),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final t = widget.t;
    final live = _online && _loaded;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: AspectRatio(
              aspectRatio: 1.8,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CustomPaint(painter: RouteMapPainter(t, dark: Theme.of(context).brightness == Brightness.dark)),
                  if (_online)
                    Opacity(
                      opacity: _loaded ? 1 : 0,
                      child: BundleWebView(
                        key: ValueKey('tpl_${t.slug}_${s.serverGeneration}'),
                        url: '${s.server.tripUrl(_tripId, page: '__waypack_map.html')}#embed',
                        origin: s.server.origin,
                        onRecover: s.ensureServer,
                        onLoaded: () {
                          if (mounted) setState(() => _loaded = true);
                        },
                      ),
                    ),
                  if (live)
                    Positioned(
                      left: 8,
                      bottom: 8,
                      child: RoundButton(
                        tooltip: 'Open the map',
                        icon: Icons.open_in_full,
                        iconSize: 17,
                        onPressed: _openFull,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        // Day colours belong to the sketch; the live map colours routes by how you get around
        // and picks days in its full-screen view.
        if (!live)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Wrap(
              spacing: 14,
              children: [
                for (var i = 0; i < t.plan.length; i++)
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 18,
                        height: 4,
                        decoration: BoxDecoration(color: dayColor(i), borderRadius: BorderRadius.circular(2)),
                      ),
                      const SizedBox(width: 5),
                      Text('Day ${i + 1}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    ],
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

/// The template's map full screen, with the day picker (like a trip's Map).
class _FullTemplateMap extends StatelessWidget {
  const _FullTemplateMap({required this.title, required this.url});
  final String title;
  final String url;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final p = Paper.of(context);
    return Scaffold(
      backgroundColor: p.bg,
      body: SafeArea(
        bottom: false,
        child: Stack(
          children: [
            Positioned.fill(
              child: BundleWebView(url: url, origin: s.server.origin, onRecover: s.ensureServer),
            ),
            Positioned(
              left: 12,
              top: 10,
              right: 64,
              child: Row(
                children: [
                  RoundButton(
                    tooltip: 'Back',
                    icon: Icons.arrow_back_ios_new,
                    iconSize: 17,
                    onPressed: () => Navigator.maybePop(context),
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Container(
                      height: 44,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      decoration: BoxDecoration(
                        color: p.card,
                        borderRadius: BorderRadius.circular(22),
                        boxShadow: const [BoxShadow(color: Color(0x333C2814), blurRadius: 4, offset: Offset(0, 1))],
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: hand(22, p.ink).copyWith(height: .9)),
                          Text('Online map', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w600, color: p.muted)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
