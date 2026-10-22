import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:waypack/models/trip.dart';
import 'package:waypack/services/api.dart';
import 'package:waypack/services/local_server.dart';
import 'package:waypack/services/trip_store.dart';
import 'package:waypack/state/app_state.dart';

void main() {
  test(
    'calculateStorageUsage and clearMapTilesCache operate correctly',
    () async {
      final temp = Directory.systemTemp.createTempSync('storage_test');
      addTearDown(() => temp.deleteSync(recursive: true));

      final store = TripStore(temp);
      final tripsDir = Directory('${temp.path}/trips/kyoto/v1')
        ..createSync(recursive: true);
      File('${tripsDir.path}/manifest.json')
          .writeAsStringSync('{"title": "Kyoto"}');
      File('${tripsDir.path}/notes.txt').writeAsStringSync('Hello world notes');

      final tilesDir = Directory('${temp.path}/tiles/kyoto')
        ..createSync(recursive: true);
      File('${tilesDir.path}/extract1.pmtiles')
          .writeAsBytesSync(List.filled(1024 * 1024, 0)); // 1MB
      File('${tilesDir.path}/extract2.pmtiles')
          .writeAsBytesSync(List.filled(2 * 1024 * 1024, 0)); // 2MB

      final usage = await store.calculateStorageUsage();
      expect(usage.tripCount, 1);
      expect(usage.tilesCount, 2);
      expect(usage.mapTilesBytes, 3 * 1024 * 1024);
      expect(usage.tripBundlesBytes, greaterThan(0));
      expect(
        usage.totalBytes,
        equals(usage.tripBundlesBytes + usage.mapTilesBytes + usage.sdkBytes),
      );

      // Clear cache
      final freed = await store.clearMapTilesCache();
      expect(freed, 3 * 1024 * 1024);

      // Verify pmtiles are gone but manifest remains
      expect(File('${tripsDir.path}/manifest.json').existsSync(), isTrue);
      expect(File('${tilesDir.path}/extract1.pmtiles').existsSync(), isFalse);

      final afterUsage = await store.calculateStorageUsage();
      expect(afterUsage.tilesCount, 0);
      expect(afterUsage.mapTilesBytes, 0);
      expect(afterUsage.tripBundlesBytes, usage.tripBundlesBytes);
    },
  );

  test(
    'clearing the map cache leaves trips knowing their maps are gone',
    () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      SharedPreferences.setMockInitialValues({});
      final temp = Directory.systemTemp.createTempSync('clear_cache_test');
      addTearDown(() => temp.deleteSync(recursive: true));
      final store = TripStore(temp);
      Directory('${temp.path}/trips/kyoto/v1').createSync(recursive: true);
      final tiles = Directory('${temp.path}/tiles/kyoto')
        ..createSync(recursive: true);
      File('${tiles.path}/a1b2.pmtiles').writeAsBytesSync(List.filled(4096, 0));
      final trip = LocalTrip(
        id: 'kyoto',
        title: 'Kyoto',
        version: 1,
        bundleSha256: '',
        bytes: 4096,
        downloadedAt: DateTime(2026),
        tiles: [
          LocalTiles(
            areaHash: 'a1b2',
            file: 'a1b2.pmtiles',
            sha256: '',
            bytes: 4096,
            bbox: const [0, 0, 1, 1],
            maxZoom: 14,
          ),
        ],
      );
      await store.saveMeta(trip);
      // adoptLocal registers the trip the way init() does, without Supabase.
      final s = AppState(store: store, server: LocalServer(store), api: Api())
        ..adoptLocal(trip);
      expect(s.server.tiles['kyoto'], ['a1b2.pmtiles']);

      expect(await s.clearMapCache(), 4096);

      expect(File('${tiles.path}/a1b2.pmtiles').existsSync(), isFalse);
      expect(s.upcoming.followedBy(s.past).single.local!.tiles, isEmpty);
      expect(s.server.tiles['kyoto'], isEmpty);
      expect(
        (await store.loadAll())['kyoto']!.tiles,
        isEmpty,
        reason: 'saved, so it survives a restart',
      );
    },
  );
}
