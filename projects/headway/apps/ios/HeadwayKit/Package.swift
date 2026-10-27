// swift-tools-version: 6.0
// Headway's models, the Worker API client and Supabase sign-in (no SDK), shared by the app and
// tested on the Mac with `swift test`.
import PackageDescription

let package = Package(
    name: "HeadwayKit",
    platforms: [.iOS(.v18), .macOS(.v14), .watchOS(.v11)],
    products: [.library(name: "HeadwayKit", targets: ["HeadwayKit"])],
    targets: [
        .target(name: "HeadwayKit"),
        .testTarget(name: "HeadwayKitTests", dependencies: ["HeadwayKit"], resources: [.copy("Fixtures")]),
    ],
    swiftLanguageModes: [.v5]
)
