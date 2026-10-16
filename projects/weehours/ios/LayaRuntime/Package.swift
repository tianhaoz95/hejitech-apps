// swift-tools-version:5.10
import PackageDescription

// `Vendor/llama.xcframework` is built from a pinned llama.cpp commit by
// `scripts/build-llama-xcframework.sh` (not committed: ~100 MB of static libraries).
let package = Package(
    name: "LayaRuntime",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "LayaRuntime", targets: ["LayaRuntime"]),
    ],
    dependencies: [
        .package(path: "../LogCore"),
    ],
    targets: [
        .binaryTarget(name: "llama", path: "../Vendor/llama.xcframework"),
        .target(
            name: "LayaRuntime",
            dependencies: ["llama", "LogCore"],
            linkerSettings: [
                .linkedFramework("Metal"),
                .linkedFramework("MetalKit"),
                .linkedFramework("Accelerate"),
                .linkedFramework("Foundation"),
                .linkedLibrary("c++"),
            ]
        ),
        .testTarget(name: "LayaRuntimeTests", dependencies: ["LayaRuntime"]),
    ]
)
