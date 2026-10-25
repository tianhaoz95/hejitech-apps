// swift-tools-version: 6.0
// FitLoop's models, the Worker API client and Supabase sign-in (no SDK), shared by the iPhone app and
// tested on the Mac with `swift test`.
import PackageDescription

let package = Package(
    name: "FitLoopKit",
    platforms: [.iOS(.v18), .watchOS(.v11), .macOS(.v14)],
    products: [.library(name: "FitLoopKit", targets: ["FitLoopKit"])],
    targets: [
        .target(name: "FitLoopKit"),
        .testTarget(name: "FitLoopKitTests", dependencies: ["FitLoopKit"], resources: [.copy("Fixtures")]),
    ],
    swiftLanguageModes: [.v5]
)
