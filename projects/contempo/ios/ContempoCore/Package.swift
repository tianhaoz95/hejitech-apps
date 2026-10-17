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
        .library(name: "ContempoFirestore", targets: ["ContempoFirestore"]),
    ],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "11.0.0"),
    ],
    targets: [
        // Platform-agnostic: model enums, theme tokens, and anything usable
        // from watchOS. Depends only on FirebaseAuth (uid + REST auth
        // tokens), which — unlike FirebaseFirestore — does build for
        // watchOS: firebase-ios-sdk's Package.swift conditions the
        // FirebaseFirestore target to iOS/tvOS/macOS/macCatalyst only (its
        // gRPC/leveldb/abseil native dependencies have no watchOS slice), so
        // anything that needs the Firestore *SDK* (not just REST) lives in
        // ContempoFirestore below instead, which only the phone app links.
        .target(
            name: "ContempoCore",
            dependencies: [
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
            ]
        ),
        // Entry/Property models, EntryRepository, the Timer/Mileage
        // coordinators, and anything else that needs the real Firestore SDK
        // — iOS/macOS only in practice (nothing links this from the watch
        // target, since watchOS can't build it at all).
        .target(
            name: "ContempoFirestore",
            dependencies: [
                "ContempoCore",
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseStorage", package: "firebase-ios-sdk"),
            ]
        ),
        .testTarget(
            name: "ContempoCoreTests",
            dependencies: ["ContempoCore", "ContempoFirestore"]
        ),
    ]
)
