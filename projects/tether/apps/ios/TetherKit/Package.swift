// swift-tools-version: 6.0
// TetherKit: shared workspace models, normative pane tree engine, Keychain credential & host-key
// store, SSH/SFTP protocol + key utilities, and Worker/Supabase sync client.
import PackageDescription

let package = Package(
    name: "TetherKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "TetherKit", targets: ["TetherKit"])],
    targets: [
        .target(name: "TetherKit"),
        .testTarget(name: "TetherKitTests", dependencies: ["TetherKit"]),
    ],
    swiftLanguageModes: [.v5]
)
