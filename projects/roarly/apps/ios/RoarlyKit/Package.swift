// swift-tools-version: 6.0
// Roarly's platform-free logic: the sound catalog, the story listener's decisions (which sound,
// when, how sure), the small-model prompt and the watch messages. The iPhone and watch apps both
// link it; `swift test` runs its tests on a Mac in seconds.
import PackageDescription

let package = Package(
    name: "RoarlyKit",
    platforms: [.iOS("26.0"), .watchOS("26.0"), .macOS("26.0")],
    products: [.library(name: "RoarlyKit", targets: ["RoarlyKit"])],
    targets: [
        .target(name: "RoarlyKit", swiftSettings: [.swiftLanguageMode(.v5)]),
        .testTarget(
            name: "RoarlyKitTests",
            dependencies: ["RoarlyKit"],
            resources: [.copy("Resources/stories.json")],
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
