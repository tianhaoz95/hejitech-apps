// swift-tools-version:5.10
import PackageDescription

let package = Package(
    name: "ContempoCore",
    platforms: [
        .iOS(.v17),
        .watchOS(.v10),
        // macOS is not a real deployment target for this package — it's added
        // solely so `swift build`/`swift test` can run locally in CI/dev
        // shells that lack a full Xcode+Simulator toolchain for iOS/watchOS.
        .macOS(.v14),
    ],
    products: [
        .library(name: "ContempoCore", targets: ["ContempoCore"]),
        .library(name: "ContempoData", targets: ["ContempoData"]),
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift.git", from: "2.30.0"),
    ],
    targets: [
        // Platform-agnostic: model enums, theme tokens, Timestamp, the Supabase client
        // (ContempoBackend) and the watch-side writers. supabase-swift builds for watchOS, so the
        // watch talks to the same backend as the phone.
        .target(
            name: "ContempoCore",
            dependencies: [
                .product(name: "Supabase", package: "supabase-swift"),
            ]
        ),
        // Entry/Property models, EntryRepository on Supabase, the Timer/Mileage coordinators —
        // what the phone app uses (schema contempo in the shared HEJI Supabase project).
        .target(
            name: "ContempoData",
            dependencies: [
                "ContempoCore",
                .product(name: "Supabase", package: "supabase-swift"),
            ]
        ),
        .testTarget(
            name: "ContempoCoreTests",
            dependencies: ["ContempoCore", "ContempoData"]
        ),
    ]
)
