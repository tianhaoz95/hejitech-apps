// swift-tools-version: 6.0
// G2DigestKit: shared data models, API client, HUD formatter, and tour engine for G2 Digest iOS.
import PackageDescription

let package = Package(
    name: "G2DigestKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "G2DigestKit", targets: ["G2DigestKit"]),
    ],
    targets: [
        .target(
            name: "G2DigestKit"
        ),
        .testTarget(
            name: "G2DigestKitTests",
            dependencies: ["G2DigestKit"]
        ),
    ],
    swiftLanguageModes: [.v5]
)
