// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "LogCore",
    platforms: [.iOS(.v17), .watchOS(.v10), .macOS(.v14)],
    products: [
        .library(name: "LogCore", targets: ["LogCore"]),
        .executable(name: "logeval", targets: ["LogEval"]),
    ],
    targets: [
        .target(
            name: "LogCore",
            resources: [.copy("Resources/event-types.json"), .copy("Resources/calibration.json")],
            linkerSettings: [.linkedLibrary("sqlite3")]
        ),
        .executableTarget(name: "LogEval", dependencies: ["LogCore"]),
        .testTarget(
            name: "LogCoreTests",
            dependencies: ["LogCore"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
