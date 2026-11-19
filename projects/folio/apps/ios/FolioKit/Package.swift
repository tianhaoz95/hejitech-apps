// swift-tools-version:5.9
// Folio's iPhone app and Share extension share this: Supabase sign-in, the session in a shared
// Keychain group, the Folio REST client and its models, and turning shared items into files.
import PackageDescription

let package = Package(
    name: "FolioKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "FolioKit", targets: ["FolioKit"])],
    targets: [
        .target(name: "FolioKit"),
        .testTarget(name: "FolioKitTests", dependencies: ["FolioKit"]),
    ]
)
