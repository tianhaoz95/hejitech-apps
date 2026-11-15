// Driver for `flutter drive`: saves screenshots taken by the test under build/drive_shots/ on the
// host (works on a physical iPhone, unlike the simulator capture in tool/screenshots.mjs).
import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() => integrationDriver(
  onScreenshot: (name, bytes, [args]) async {
    final f = File('build/drive_shots/$name.png');
    await f.parent.create(recursive: true);
    await f.writeAsBytes(bytes);
    return true;
  },
);
