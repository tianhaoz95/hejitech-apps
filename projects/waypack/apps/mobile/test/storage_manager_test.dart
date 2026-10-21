import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:waypack/services/trip_store.dart';

void main() {
  test('calculateStorageUsage and clearMapTilesCache operate correctly', () async {
    final temp = Directory.systemTemp.createTempSync('storage_test');
    addTearDown(() => temp.deleteSync(recursive: true));

    final store = TripStore(temp);
    final tripsDir = Directory('${temp.path}/trips/kyoto/v1')..createSync(recursive: true);
    File('${tripsDir.path}/manifest.json').writeAsStringSync('{"title": "Kyoto"}');
    File('${tripsDir.path}/notes.txt').writeAsStringSync('Hello world notes');

    final tilesDir = Directory('${temp.path}/tiles/kyoto')..createSync(recursive: true);
    File('${tilesDir.path}/extract1.pmtiles').writeAsBytesSync(List.filled(1024 * 1024, 0)); // 1MB
    File('${tilesDir.path}/extract2.pmtiles').writeAsBytesSync(List.filled(2 * 1024 * 1024, 0)); // 2MB

    final usage = await store.calculateStorageUsage();
    expect(usage.tripCount, 1);
    expect(usage.tilesCount, 2);
    expect(usage.mapTilesBytes, 3 * 1024 * 1024);
    expect(usage.tripBundlesBytes, greaterThan(0));
    expect(usage.totalBytes, equals(usage.tripBundlesBytes + usage.mapTilesBytes + usage.sdkBytes));

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
  });
}
