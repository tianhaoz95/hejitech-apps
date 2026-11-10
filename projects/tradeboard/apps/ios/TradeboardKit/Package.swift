// swift-tools-version: 6.0
// Tradeboard models, Worker API client, Supabase authentication & TOTP verification,
// shared by the iOS app and verified with `swift test`.
import PackageDescription

let package = Package(
    name: "TradeboardKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "TradeboardKit", targets: ["TradeboardKit"])],
    targets: [
        .target(name: "TradeboardKit"),
        .testTarget(name: "TradeboardKitTests", dependencies: ["TradeboardKit"]),
    ],
    swiftLanguageModes: [.v5]
)
