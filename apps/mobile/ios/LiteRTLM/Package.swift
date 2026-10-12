// swift-tools-version: 5.9
// LiteRT-LM's Swift API, vendored from google-ai-edge/LiteRT-LM v0.18.0 (swift/, Apache 2.0) so the
// build doesn't clone that ~900 MB repository; the native runtime is Google's prebuilt release
// binary, pinned by checksum. Used by Runner/WaypackLocalModel.swift (DECISIONS #68). To update:
// copy swift/*.swift (not the tests) from the new tag and change the URL and checksum below.
import PackageDescription

let package = Package(
  name: "LiteRTLM",
  platforms: [.iOS(.v15)],
  products: [.library(name: "LiteRTLM", targets: ["LiteRTLM"])],
  targets: [
    .binaryTarget(
      name: "CLiteRTLM",
      url: "https://github.com/google-ai-edge/LiteRT-LM/releases/download/v0.18.0/CLiteRTLM.xcframework.zip",
      checksum: "d765b99592d4ec3d0c9e2bd69469454af06c834861340672da1891c0c121c347"
    ),
    .target(name: "LiteRTLM", dependencies: ["CLiteRTLM"]),
  ]
)
