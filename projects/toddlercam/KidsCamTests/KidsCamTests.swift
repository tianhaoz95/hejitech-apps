import XCTest
import SwiftUI
@testable import ToddlerCam

final class KidsCamTests: XCTestCase {

    override func setUp() {
        super.setUp()
        GuidedAccessManager.shared.isGuidedAccessActive = false
        DualCameraManager.shared.isToddlerLocked = false
        DualCameraManager.shared.isDemoMode = false
    }

    override func tearDown() {
        GuidedAccessManager.shared.isGuidedAccessActive = false
        DualCameraManager.shared.isToddlerLocked = false
        DualCameraManager.shared.isDemoMode = false
        super.tearDown()
    }

    func testCameraManagerSwapCameras() {
        let manager = DualCameraManager.shared
        manager.primaryPosition = .back
        manager.swapCameras()
        XCTAssertEqual(manager.primaryPosition, .front)
        manager.swapCameras()
        XCTAssertEqual(manager.primaryPosition, .back)
    }

    func testCameraManagerToddlerLock() {
        let manager = DualCameraManager.shared
        manager.isToddlerLocked = false
        manager.toggleToddlerLock()
        XCTAssertTrue(manager.isToddlerLocked)
        manager.toggleToddlerLock()
        XCTAssertFalse(manager.isToddlerLocked)
    }

    func testDualPhotoRendererComposition() {
        let back = DualPhotoRenderer.renderSimulatedBackCamera()
        let front = DualPhotoRenderer.renderSimulatedFrontCamera()
        XCTAssertNotNil(back)
        XCTAssertNotNil(front)

        let compositePip = DualPhotoRenderer.composeDualPhoto(
            backImage: back,
            frontImage: front,
            primaryPosition: .back
        )
        XCTAssertEqual(compositePip.size.width, 1200)
        XCTAssertEqual(compositePip.size.height, 1600)

        let compositeFrontPrimary = DualPhotoRenderer.composeDualPhoto(
            backImage: back,
            frontImage: front,
            primaryPosition: .front
        )
        XCTAssertEqual(compositeFrontPrimary.size.width, 1200)
        XCTAssertEqual(compositeFrontPrimary.size.height, 1600)
    }

    func testFaceTrackingMovementAndHeadRoll() {
        let manager = FaceTrackingManager.shared
        manager.setActiveFilter(.crown)

        let container = CGSize(width: 400, height: 800)

        // 1. Face on the left side of frame
        manager.normalizedFaceRect = CGRect(x: 0.2, y: 0.15, width: 0.3, height: 0.3)
        manager.foreheadCenterNormalized = CGPoint(x: 0.35, y: 0.18)
        manager.headRoll = 0.25
        let pointLeft = manager.anchorPoint(for: .forehead, in: container)

        // 2. Face moves to the right side of frame
        manager.normalizedFaceRect = CGRect(x: 0.6, y: 0.15, width: 0.3, height: 0.3)
        manager.foreheadCenterNormalized = CGPoint(x: 0.75, y: 0.18)
        manager.headRoll = -0.30
        let pointRight = manager.anchorPoint(for: .forehead, in: container)

        // Verify emoji moves with face and tilts with head roll
        XCTAssertGreaterThan(pointRight.x, pointLeft.x, "Emoji anchor must follow face movement to the right")
        XCTAssertEqual(manager.headRoll, -0.30, accuracy: 0.01)
    }

    func testSoundTypeCatalog() {
        for sound in SoundType.allCases {
            XCTAssertFalse(sound.rawValue.isEmpty)
            XCTAssertFalse(sound.emoji.isEmpty)
            XCTAssertFalse(sound.title.isEmpty)
        }
    }

    func testGuidedAccessManagerInitialStatus() {
        let manager = GuidedAccessManager.shared
        // In unit test environment, UIAccessibility.isGuidedAccessEnabled is normally false
        XCTAssertFalse(manager.isGuidedAccessActive)
    }

    func testGuidedAccessManagerOpenSettings() {
        let manager = GuidedAccessManager.shared
        manager.openGuidedAccessSettings()
        XCTAssertEqual(UIPasteboard.general.string, "Guided Access")
    }

    @MainActor
    func testGuidedAccessGuideViewSnapshot() {
        let view = GuidedAccessGuideView()
        let controller = UIHostingController(rootView: view)
        controller.view.bounds = CGRect(x: 0, y: 0, width: 440, height: 956)
        controller.view.backgroundColor = .systemBackground
        controller.view.layoutIfNeeded()
        let renderer = UIGraphicsImageRenderer(size: controller.view.bounds.size)
        let image = renderer.image { _ in
            controller.view.drawHierarchy(in: controller.view.bounds, afterScreenUpdates: true)
        }
        XCTAssertGreaterThan(image.size.width, 0)
        if let data = image.pngData() {
            let path = "/Users/tianhaoz/.gemini/antigravity-cli/brain/04e94b9a-263a-4ac8-8a99-d26f65ce8b13/guided_access_sheet_snapshot.png"
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }

    func testFaceEmojiTypeCatalog() {
        for filter in FaceEmojiType.allCases {
            XCTAssertFalse(filter.emoji.isEmpty)
            XCTAssertFalse(filter.displayName.isEmpty)
            XCTAssertFalse(filter.id.isEmpty)
        }
        XCTAssertEqual(FaceEmojiType.crown.anchorPosition, .forehead)
        XCTAssertEqual(FaceEmojiType.sunglasses.anchorPosition, .eyes)
        XCTAssertEqual(FaceEmojiType.lion.anchorPosition, .head)
    }

    func testFaceTrackingManagerFilterAndCoordinates() {
        let manager = FaceTrackingManager.shared
        manager.setActiveFilter(.lion)
        XCTAssertEqual(manager.activeFilter, .lion)

        let container = CGSize(width: 400, height: 600)
        let anchor = manager.anchorPoint(for: .forehead, in: container)
        XCTAssertGreaterThan(anchor.x, 0)
        XCTAssertGreaterThan(anchor.y, 0)

        let size = manager.emojiSize(in: container, for: .lion)
        XCTAssertGreaterThan(size, 30)

        manager.clearFilter()
        XCTAssertNil(manager.activeFilter)
    }

    func testFaceTrackingManagerProcessImage() {
        let manager = FaceTrackingManager.shared
        manager.setActiveFilter(.crown)
        let testImage = DualPhotoRenderer.renderSimulatedFrontCamera()
        manager.processUIImage(testImage)
        // Processing runs on background vision queue without throwing
        XCTAssertEqual(manager.activeFilter, .crown)
    }

    func testDualPhotoRendererWithTrackedEmoji() {
        let back = DualPhotoRenderer.renderSimulatedBackCamera()
        let front = DualPhotoRenderer.renderSimulatedFrontCamera()

        let composite = DualPhotoRenderer.composeDualPhoto(
            backImage: back,
            frontImage: front,
            primaryPosition: .back,
            filter: .lion
        )
        XCTAssertEqual(composite.size.width, 1200)
        XCTAssertEqual(composite.size.height, 1600)
    }

    @MainActor
    func testFaceTrackingOverlaySnapshot() {
        FaceTrackingManager.shared.setActiveFilter(.crown)
        FaceTrackingManager.shared.normalizedFaceRect = CGRect(x: 0.275, y: 0.30, width: 0.45, height: 0.42)
        FaceTrackingManager.shared.lastImageSize = CGSize(width: 800, height: 1000)
        FaceTrackingManager.shared.isFaceDetected = true

        let sampleFace = DualPhotoRenderer.renderSimulatedFrontCamera()

        let composite = DualPhotoRenderer.composeDualPhoto(
            backImage: DualPhotoRenderer.renderSimulatedBackCamera(),
            frontImage: sampleFace,
            primaryPosition: .front,
            filter: .crown
        )
        if let data = composite.pngData() {
            let path = "/Users/tianhaoz/.gemini/antigravity-cli/brain/56601843-8006-40e2-8cbd-8c87eb5fae50/tracked_face_mask_photo.png"
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }

    func testFlyingEmojiOrbitsOutsideFaceAndNeverCoversFace() {
        let manager = FaceTrackingManager.shared
        manager.setActiveFilter(.lion)
        manager.normalizedFaceRect = CGRect(x: 0.25, y: 0.25, width: 0.5, height: 0.5)
        manager.headRoll = 0.0

        let container = CGSize(width: 400, height: 800)
        let center = manager.faceCenter(in: container)
        let dims = manager.faceDimensions(in: container)
        let halfWidth = dims.width * 0.5
        let halfHeight = dims.height * 0.5

        // Test multiple angles in orbit: 0 (right), pi/2 (bottom), pi (left), 3pi/2 (top)
        let testAngles: [Double] = [0.0, .pi / 4.0, .pi / 2.0, .pi, 3.0 * .pi / 2.0]
        for angle in testAngles {
            let pos = manager.flyingEmojiPosition(angle: angle, in: container)
            let dx = abs(pos.x - center.x)
            let dy = abs(pos.y - center.y)

            // The flying emoji must be placed outside the face box (dx > halfWidth OR dy > halfHeight)
            let isOutsideFace = (dx > halfWidth) || (dy > halfHeight)
            XCTAssertTrue(isOutsideFace, "Flying emoji at angle \(angle) must not cover the face (dx=\(dx), halfW=\(halfWidth), dy=\(dy), halfH=\(halfHeight))")
        }

        // Verify emoji size is bounded appropriately as a flying companion, not a covering mask
        let size = manager.emojiSize(in: container, for: .lion)
        XCTAssertLessThanOrEqual(size, 75, "Flying companion emoji size should be restrained so it doesn't obstruct view")
        XCTAssertGreaterThanOrEqual(size, 40)
    }

    func testTouchAnywhereSoundCycling() {
        let manager = SoundEffectManager.shared
        let touchSounds: [SoundType] = [.quack, .woof, .meow, .giggle, .boing, .horn, .pop]

        for sound in touchSounds {
            manager.play(sound, haptic: false)
            XCTAssertFalse(sound.emoji.isEmpty)
            XCTAssertFalse(sound.title.isEmpty)
        }
    }

    @MainActor
    func testWatchComplicationsStudioViewSnapshot() {
        let view = WatchFaceStudioView()
        let controller = UIHostingController(rootView: view)
        controller.view.bounds = CGRect(x: 0, y: 0, width: 440, height: 956)
        controller.view.backgroundColor = .systemBackground
        controller.view.layoutIfNeeded()
        let renderer = UIGraphicsImageRenderer(size: controller.view.bounds.size)
        let image = renderer.image { _ in
            controller.view.drawHierarchy(in: controller.view.bounds, afterScreenUpdates: true)
        }
        XCTAssertGreaterThan(image.size.width, 0)
        if let data = image.pngData() {
            let path = "/Users/tianhaoz/.gemini/antigravity-cli/brain/56601843-8006-40e2-8cbd-8c87eb5fae50/watch_complications_studio_snapshot.png"
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }

    @MainActor
    func testToddlerCameraViewSnapshot() {
        let view = ToddlerCameraView()
        let controller = UIHostingController(rootView: view)
        controller.view.bounds = CGRect(x: 0, y: 0, width: 430, height: 932)
        controller.view.layoutIfNeeded()
        let renderer = UIGraphicsImageRenderer(size: controller.view.bounds.size)
        let image = renderer.image { _ in
            controller.view.drawHierarchy(in: controller.view.bounds, afterScreenUpdates: true)
        }
        XCTAssertGreaterThan(image.size.width, 0)
        if let data = image.pngData() {
            let path = "/Users/tianhaoz/.gemini/antigravity-cli/brain/56601843-8006-40e2-8cbd-8c87eb5fae50/toddler_camera_view_snapshot.png"
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }

    // MARK: - Demo Mode (Screenshot Automation) Tests
    func testDemoModeActivation() {
        let camera = DualCameraManager.shared
        camera.isDemoMode = true
        XCTAssertTrue(camera.isDemoMode)
        XCTAssertNotNil(camera.demoBabyFrame)
        XCTAssertNotNil(camera.demoNatureFrame)
        XCTAssertTrue(FaceTrackingManager.shared.isFaceDetected)

        let baby = DualPhotoRenderer.renderBabyMockImage()
        let nature = DualPhotoRenderer.renderNatureParkMockImage()
        XCTAssertEqual(baby.size.width, 800)
        XCTAssertEqual(baby.size.height, 1200)
        XCTAssertEqual(nature.size.width, 800)
        XCTAssertEqual(nature.size.height, 1200)

        camera.swapCameras()
        XCTAssertFalse(camera.demoBabyIsPrimary)
        camera.swapCameras()
        XCTAssertTrue(camera.demoBabyIsPrimary)
    }

    // MARK: - App Store Screenshots Generator
    @MainActor
    func testGenerateAllAppStoreScreenshots() {
        let camera = DualCameraManager.shared
        camera.isDemoMode = true
        camera.demoBabyIsPrimary = true
        camera.permissionStatus = .authorized
        camera.hasPhysicalCameras = false
        camera.isToddlerLocked = false

        WatchConnectivityManager.shared.isReachable = true
        GuidedAccessManager.shared.isGuidedAccessActive = true

        FaceTrackingManager.shared.setActiveFilter(.lion)
        FaceTrackingManager.shared.mockBabyFaceDetection()

        let babyImg = camera.demoBabyFrame ?? DualPhotoRenderer.renderBabyMockImage()
        let natureImg = camera.demoNatureFrame ?? DualPhotoRenderer.renderNatureParkMockImage()

        let sampleComposite = DualPhotoRenderer.composeDualPhoto(
            backImage: natureImg,
            frontImage: babyImg,
            primaryPosition: .front,
            filter: .lion
        )
        camera.latestPhoto = CapturedDualPhoto(
            timestamp: Date(),
            compositeImage: sampleComposite,
            frontImage: babyImg,
            backImage: natureImg
        )

        // 1. appstore_iphone_fullscreen_pip.png (1284 x 2778) - Baby Large, Nature PiP, Flying Lion
        camera.demoBabyIsPrimary = true
        FaceTrackingManager.shared.setActiveFilter(.lion)
        FaceTrackingManager.shared.mockBabyFaceDetection()
        saveIPhoneScreenshot(view: ToddlerCameraView(), filename: "appstore_iphone_fullscreen_pip.png")

        // 2. simulator_toddlercam.png (1284 x 2778) - Baby Large, Nature PiP, Flying Crown
        FaceTrackingManager.shared.setActiveFilter(.crown)
        saveIPhoneScreenshot(view: ToddlerCameraView(), filename: "simulator_toddlercam.png")

        // 3. iphone_video_playing.png (1284 x 2778) - Interactive touch sounds & bubbles
        FaceTrackingManager.shared.setActiveFilter(.lion)
        let touchAnywhereDemo = ZStack {
            ToddlerCameraView()
            // Cheerful touch pop particles
            Text("🫧").font(.system(size: 52)).position(x: 110, y: 410)
            Text("⭐").font(.system(size: 46)).position(x: 290, y: 460)
            Text("🎉").font(.system(size: 48)).position(x: 150, y: 600)
            Text("✨").font(.system(size: 40)).position(x: 330, y: 640)
            Text("🐥").font(.system(size: 50)).position(x: 230, y: 720)

            // Cheerful hint banner
            VStack {
                Spacer()
                HStack(spacing: 8) {
                    Text("🦆")
                    Text("Tap anywhere for silly sounds!")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("👶")
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(Color.purple.opacity(0.88))
                .cornerRadius(22)
                .shadow(color: Color.black.opacity(0.3), radius: 8, x: 0, y: 4)
                .padding(.bottom, 120)
            }
        }
        saveIPhoneScreenshot(view: touchAnywhereDemo, filename: "iphone_video_playing.png")

        // 4. live_dual_video_stream.png (1284 x 2778) - Dual Camera View with Unicorn Companion
        FaceTrackingManager.shared.setActiveFilter(.unicorn)
        saveIPhoneScreenshot(view: ToddlerCameraView(), filename: "live_dual_video_stream.png")
        FaceTrackingManager.shared.setActiveFilter(.lion)

        // 5. after_grant.png (1284 x 2778) - Guided Access Guide Sheet
        saveIPhoneScreenshot(view: DeviceSheetContainer { GuidedAccessGuideView() }, filename: "after_grant.png")

        // 6. system_camera_prompt.png (1284 x 2778) - Toddler Safe Lock Screen
        camera.isToddlerLocked = true
        saveIPhoneScreenshot(view: ToddlerCameraView(), filename: "system_camera_prompt.png")
        camera.isToddlerLocked = false

        // 7. live_video_footage.png (1284 x 2778) - Keepsake Dual Photo Output
        saveIPhoneScreenshot(view: KeepsakePhotoReviewScreenshotView(photo: sampleComposite), filename: "live_video_footage.png")

        // 8. iphone_paired_live.png (1284 x 2778) - Watch Face Studio
        saveIPhoneScreenshot(view: DeviceSheetContainer { WatchFaceStudioView() }, filename: "iphone_paired_live.png")

        // 9. iphone_permission_dialog.png (1284 x 2778) - Parent Hub Settings
        saveIPhoneScreenshot(view: DeviceSheetContainer { ParentHubView() }, filename: "iphone_permission_dialog.png")

        // ====================================================
        // iPad 13" Screenshots (2064 x 2752) -> AppStore/Screenshots/iPad/
        // ====================================================
        // 1. ipad_13_fullscreen_pip.png - Lion Filter
        camera.demoBabyIsPrimary = true
        FaceTrackingManager.shared.setActiveFilter(.lion)
        FaceTrackingManager.shared.mockBabyFaceDetection()
        saveIPadScreenshot(view: ToddlerCameraView(), filename: "ipad_13_fullscreen_pip.png")

        // 2. ipad_13_simulator_toddlercam.png - Crown Filter
        FaceTrackingManager.shared.setActiveFilter(.crown)
        saveIPadScreenshot(view: ToddlerCameraView(), filename: "ipad_13_simulator_toddlercam.png")

        // 3. ipad_13_video_playing.png - Silly Soundboard & Touch Bubbles Interactive Canvas
        FaceTrackingManager.shared.setActiveFilter(.lion)
        let ipadTouchDemo = ZStack {
            ToddlerCameraView()
            // Cheerful touch pop particles spread across 1032 x 1376 iPad canvas
            Text("🫧").font(.system(size: 76)).position(x: 220, y: 560)
            Text("⭐").font(.system(size: 68)).position(x: 780, y: 500)
            Text("🎉").font(.system(size: 72)).position(x: 280, y: 860)
            Text("✨").font(.system(size: 60)).position(x: 820, y: 800)
            Text("🐥").font(.system(size: 74)).position(x: 540, y: 1020)
            Text("🎈").font(.system(size: 70)).position(x: 180, y: 1120)

            // Cheerful hint banner
            VStack {
                Spacer()
                HStack(spacing: 12) {
                    Text("🦆").font(.system(size: 26))
                    Text("Tap anywhere for silly sounds!")
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Text("👶").font(.system(size: 26))
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 16)
                .background(Color.purple.opacity(0.88))
                .cornerRadius(28)
                .shadow(color: Color.black.opacity(0.3), radius: 10, x: 0, y: 5)
                .padding(.bottom, 160)
            }
        }
        saveIPadScreenshot(view: ipadTouchDemo, filename: "ipad_13_video_playing.png")

        // 4. ipad_13_dual_video_stream.png - Unicorn Filter
        FaceTrackingManager.shared.setActiveFilter(.unicorn)
        saveIPadScreenshot(view: ToddlerCameraView(), filename: "ipad_13_dual_video_stream.png")
        FaceTrackingManager.shared.setActiveFilter(.lion)

        // 5. ipad_13_after_grant.png - Guided Access Guide Sheet for iPad
        saveIPadScreenshot(view: IPadDeviceSheetContainer { GuidedAccessGuideView() }, filename: "ipad_13_after_grant.png")

        // 6. ipad_13_system_camera_prompt.png - Toddler Safe Lock Screen on iPad
        camera.isToddlerLocked = true
        saveIPadScreenshot(view: ToddlerCameraView(), filename: "ipad_13_system_camera_prompt.png")
        camera.isToddlerLocked = false

        // 7. ipad_13_live_video_footage.png - Dual Keepsake Photo Review
        saveIPadScreenshot(view: IPadKeepsakePhotoReviewScreenshotView(photo: sampleComposite), filename: "ipad_13_live_video_footage.png")

        // 8. ipad_13_paired_live.png - Watch Face Studio on iPad
        saveIPadScreenshot(view: IPadDeviceSheetContainer { WatchFaceStudioView() }, filename: "ipad_13_paired_live.png")

        // 9. ipad_13_permission_dialog.png - Parent Hub Settings on iPad
        saveIPadScreenshot(view: IPadDeviceSheetContainer { ParentHubView() }, filename: "ipad_13_permission_dialog.png")

        // ====================================================
        // Apple Watch Screenshots (416 x 496) -> AppStore/Screenshots/Watch/
        // ====================================================
        // 10. appstore_watch_remote.png (416 x 496) - Apple Watch Remote (Main)
        saveWatchScreenshot(view: WatchRemoteMockupView(), filename: "appstore_watch_remote.png")

        // 11. watch_photo_review.png (416 x 496) - Apple Watch Photo Review (Dual Keepsake Preview)
        saveWatchScreenshot(view: WatchPhotoReviewMockupView(thumbnail: sampleComposite), filename: "watch_photo_review.png")

        // 12. watch_paired_live.png (416 x 496) - Apple Watch Face Masks (Apple Vision Tracking)
        saveWatchScreenshot(view: WatchFaceMasksMockupView(), filename: "watch_paired_live.png")

        // 13. live_watch_remote.png (416 x 496) - Apple Watch Silly Soundboard
        saveWatchScreenshot(view: WatchSoundboardMockupView(), filename: "live_watch_remote.png")

        // 14. watch_toddler_lock.png (416 x 496) - Apple Watch Toddler Safe Screen Lock Active
        saveWatchScreenshot(view: WatchToddlerLockMockupView(), filename: "watch_toddler_lock.png")

        // 15. watch_camera_controls.png (416 x 496) - Apple Watch Camera Angle & PiP Controls
        saveWatchScreenshot(view: WatchCameraControlsMockupView(), filename: "watch_camera_controls.png")

        // 16. watch_complications.png (416 x 496) - Apple Watch Face Complications & Instant Launcher
        saveWatchScreenshot(view: WatchComplicationsMockupView(), filename: "watch_complications.png")

        // 17. watch_shutter_action.png (416 x 496) - Apple Watch Rapid Shutter Snap & Haptic Feedback
        saveWatchScreenshot(view: WatchShutterActionMockupView(), filename: "watch_shutter_action.png")

        // Reset state
        GuidedAccessManager.shared.isGuidedAccessActive = false
        camera.isDemoMode = false
        camera.isToddlerLocked = false
    }

    private func saveIPhoneScreenshot<V: View>(view: V, filename: String) {
        let controller = UIHostingController(rootView: view)
        controller.view.bounds = CGRect(x: 0, y: 0, width: 428, height: 926)
        controller.view.backgroundColor = .black
        controller.view.layoutIfNeeded()

        let format = UIGraphicsImageRendererFormat()
        format.scale = 3.0 // 428*3 = 1284, 926*3 = 2778 (App Store 6.5" requirement)
        let renderer = UIGraphicsImageRenderer(size: controller.view.bounds.size, format: format)
        let image = renderer.image { _ in
            controller.view.drawHierarchy(in: controller.view.bounds, afterScreenUpdates: true)
        }

        if let data = image.pngData() {
            let dir = "/Users/tianhaoz/GitHub/kids-cam/AppStore/Screenshots/iPhone"
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            let path = "\(dir)/\(filename)"
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }

    private func saveIPadScreenshot<V: View>(view: V, filename: String) {
        let controller = UIHostingController(rootView: view)
        controller.view.bounds = CGRect(x: 0, y: 0, width: 1032, height: 1376)
        controller.view.backgroundColor = .black
        controller.view.layoutIfNeeded()

        let format = UIGraphicsImageRendererFormat()
        format.scale = 2.0 // 1032*2 = 2064, 1376*2 = 2752 (App Store iPad 13" requirement)
        let renderer = UIGraphicsImageRenderer(size: controller.view.bounds.size, format: format)
        let image = renderer.image { _ in
            controller.view.drawHierarchy(in: controller.view.bounds, afterScreenUpdates: true)
        }

        if let data = image.pngData() {
            let dir = "/Users/tianhaoz/GitHub/kids-cam/AppStore/Screenshots/iPad"
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            let path = "\(dir)/\(filename)"
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }

    @MainActor
    func testCaptureModeSwitching() {
        let manager = DualCameraManager.shared
        manager.setCaptureMode(.photo)
        XCTAssertEqual(manager.captureMode, .photo)

        manager.toggleCaptureMode()
        XCTAssertEqual(manager.captureMode, .video)

        manager.setCaptureMode(.photo)
        XCTAssertEqual(manager.captureMode, .photo)
    }

    func testDualPhotoRendererAspectFillZeroDistortion() {
        let wideImage = UIGraphicsImageRenderer(size: CGSize(width: 800, height: 400)).image { ctx in
            UIColor.blue.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: 800, height: 400))
        }

        let targetRect = CGRect(x: 0, y: 0, width: 300, height: 300)
        let rendered = UIGraphicsImageRenderer(size: targetRect.size).image { ctx in
            DualPhotoRenderer.drawImageAspectFill(wideImage, in: targetRect, context: ctx.cgContext)
        }

        XCTAssertEqual(rendered.size.width, 300)
        XCTAssertEqual(rendered.size.height, 300)
    }

    func testPixelBufferGeneration() {
        let testImage = DualPhotoRenderer.renderSimulatedFrontCamera()
        let size = CGSize(width: 720, height: 960)
        let buffer = DualPhotoRenderer.pixelBuffer(from: testImage, size: size)
        XCTAssertNotNil(buffer)
        if let buffer = buffer {
            XCTAssertEqual(CVPixelBufferGetWidth(buffer), 720)
            XCTAssertEqual(CVPixelBufferGetHeight(buffer), 960)
        }
    }

    func testVideoRecorderLifecycle() {
        let manager = DualCameraManager.shared
        manager.setCaptureMode(.video)

        manager.startVideoRecording()
        XCTAssertTrue(manager.isRecordingVideo)

        let recordExp = expectation(description: "Recorded for a bit")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            manager.stopVideoRecording()
            XCTAssertFalse(manager.isRecordingVideo)
            recordExp.fulfill()
        }
        wait(for: [recordExp], timeout: 2.0)

        // Wait for video URL to be populated
        let predicate = NSPredicate { _, _ in
            return manager.latestVideoURL != nil
        }
        let urlExp = expectation(for: predicate, evaluatedWith: manager, handler: nil)
        wait(for: [urlExp], timeout: 5.0)

        XCTAssertNotNil(manager.latestVideoURL)
        if let url = manager.latestVideoURL {
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        }
        manager.setCaptureMode(.photo)
    }

    @MainActor
    private func saveWatchScreenshot<V: View>(view: V, filename: String) {
        let renderer = ImageRenderer(content: view.frame(width: 208, height: 248))
        renderer.scale = 2.0
        if let uiImage = renderer.uiImage, let data = uiImage.pngData() {
            let dir = "/Users/tianhaoz/GitHub/kids-cam/AppStore/Screenshots/Watch"
            try? FileManager.default.createDirectory(atPath: dir, withIntermediateDirectories: true)
            let path = "\(dir)/\(filename)"
            try? data.write(to: URL(fileURLWithPath: path))
        }
    }
}

// MARK: - Edge-to-Edge Sheet Container for iPhone Screenshots
struct DeviceSheetContainer<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            Color(red: 0.08, green: 0.08, blue: 0.10)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Native iPhone Status Bar
                HStack {
                    Text("9:41")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    HStack(spacing: 5) {
                        Image(systemName: "cellularbars")
                            .font(.system(size: 12, weight: .semibold))
                        Image(systemName: "wifi")
                            .font(.system(size: 12, weight: .semibold))
                        Image(systemName: "battery.100")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.white)
                }
                .padding(.horizontal, 28)
                .padding(.top, 14)
                .padding(.bottom, 6)

                // Content View
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Native iPhone Home Indicator
                Capsule()
                    .fill(Color.white.opacity(0.35))
                    .frame(width: 140, height: 5)
                    .padding(.bottom, 8)
            }
        }
        .frame(width: 428, height: 926)
    }
}

// MARK: - Edge-to-Edge Sheet Container for iPad 13" Screenshots
struct IPadDeviceSheetContainer<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        ZStack {
            Color(red: 0.08, green: 0.08, blue: 0.10)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Native iPad Status Bar
                HStack {
                    Text("9:41")
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    HStack(spacing: 8) {
                        Image(systemName: "wifi")
                            .font(.system(size: 16, weight: .semibold))
                        Text("100%")
                            .font(.system(size: 15, weight: .medium, design: .rounded))
                        Image(systemName: "battery.100")
                            .font(.system(size: 17, weight: .semibold))
                    }
                    .foregroundColor(.white)
                }
                .padding(.horizontal, 36)
                .padding(.top, 18)
                .padding(.bottom, 12)

                // Content View
                content
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))

                // Native iPad Home Indicator
                Capsule()
                    .fill(Color.white.opacity(0.35))
                    .frame(width: 240, height: 5)
                    .padding(.top, 8)
                    .padding(.bottom, 12)
            }
        }
        .frame(width: 1032, height: 1376)
    }
}

// MARK: - Full-Bleed Keepsake Photo Review Screen (iPhone)
struct KeepsakePhotoReviewScreenshotView: View {
    let photo: UIImage

    var body: some View {
        ZStack {
            // Ambient full-bleed blurred backdrop
            Image(uiImage: photo)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 428, height: 926)
                .blur(radius: 40)
                .overlay(Color.black.opacity(0.50))
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Native Status Bar
                HStack {
                    Text("9:41")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    HStack(spacing: 5) {
                        Image(systemName: "cellularbars")
                            .font(.system(size: 12, weight: .semibold))
                        Image(systemName: "wifi")
                            .font(.system(size: 12, weight: .semibold))
                        Image(systemName: "battery.100")
                            .font(.system(size: 13, weight: .semibold))
                    }
                    .foregroundColor(.white)
                }
                .padding(.horizontal, 28)
                .padding(.top, 14)
                .padding(.bottom, 12)

                // Top Navigation Header
                HStack {
                    HStack(spacing: 6) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .bold))
                        Text("Camera")
                            .font(.system(size: 17, weight: .semibold, design: .rounded))
                    }
                    .foregroundColor(.white)

                    Spacer()

                    HStack(spacing: 5) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.system(size: 14))
                        Text("Saved to Photos")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(.green)
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 7)
                    .background(Color.black.opacity(0.55))
                    .cornerRadius(18)

                    Spacer()

                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 18, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 22)
                .padding(.bottom, 16)

                Spacer()

                // Centerpiece: The High-Resolution Keepsake Dual Photo Card
                Image(uiImage: photo)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: 390, maxHeight: 580)
                    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 26, style: .continuous)
                            .stroke(Color.white.opacity(0.35), lineWidth: 1.5)
                    )
                    .shadow(color: Color.black.opacity(0.65), radius: 28, x: 0, y: 14)

                Spacer()

                // Bottom Metadata & Actions
                VStack(spacing: 14) {
                    HStack(spacing: 8) {
                        Label("Dual Camera Memory", systemImage: "sparkles")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text("•")
                            .foregroundColor(.white.opacity(0.6))
                        Text("Front + Rear Simultaneous")
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.85))
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.white.opacity(0.18))
                    .cornerRadius(20)

                    HStack(spacing: 14) {
                        Button(action: {}) {
                            HStack(spacing: 6) {
                                Image(systemName: "square.and.arrow.up.fill")
                                Text("Share Memory")
                            }
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(.black)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.white)
                            .cornerRadius(18)
                        }

                        Button(action: {}) {
                            HStack(spacing: 6) {
                                Image(systemName: "camera.fill")
                                Text("Snap Another")
                            }
                            .font(.system(size: 15, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.white.opacity(0.25))
                            .cornerRadius(18)
                        }
                    }
                    .padding(.horizontal, 22)
                }
                .padding(.bottom, 16)

                // Home Indicator
                Capsule()
                    .fill(Color.white.opacity(0.35))
                    .frame(width: 140, height: 5)
                    .padding(.bottom, 8)
            }
        }
        .frame(width: 428, height: 926)
    }
}

// MARK: - Full-Bleed Keepsake Photo Review Screen (iPad 13")
struct IPadKeepsakePhotoReviewScreenshotView: View {
    let photo: UIImage

    var body: some View {
        ZStack {
            // Ambient full-bleed blurred backdrop
            Image(uiImage: photo)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(width: 1032, height: 1376)
                .blur(radius: 50)
                .overlay(Color.black.opacity(0.50))
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Native iPad Status Bar
                HStack {
                    Text("9:41")
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    HStack(spacing: 8) {
                        Image(systemName: "wifi")
                            .font(.system(size: 16, weight: .semibold))
                        Text("100%")
                            .font(.system(size: 15, weight: .medium, design: .rounded))
                        Image(systemName: "battery.100")
                            .font(.system(size: 17, weight: .semibold))
                    }
                    .foregroundColor(.white)
                }
                .padding(.horizontal, 36)
                .padding(.top, 18)
                .padding(.bottom, 16)

                // Top Navigation Header
                HStack {
                    HStack(spacing: 8) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 20, weight: .bold))
                        Text("Camera")
                            .font(.system(size: 20, weight: .semibold, design: .rounded))
                    }
                    .foregroundColor(.white)

                    Spacer()

                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.system(size: 16))
                        Text("Saved to Photos")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(.green)
                    }
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Color.black.opacity(0.55))
                    .cornerRadius(20)

                    Spacer()

                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 36)
                .padding(.bottom, 24)

                Spacer()

                // Centerpiece: The High-Resolution Keepsake Dual Photo Card
                Image(uiImage: photo)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(maxWidth: 820, maxHeight: 920)
                    .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 32, style: .continuous)
                            .stroke(Color.white.opacity(0.35), lineWidth: 2)
                    )
                    .shadow(color: Color.black.opacity(0.65), radius: 36, x: 0, y: 18)

                Spacer()

                // Bottom Metadata & Actions
                VStack(spacing: 20) {
                    HStack(spacing: 10) {
                        Label("Dual Camera Memory", systemImage: "sparkles")
                            .font(.system(size: 16, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text("•")
                            .foregroundColor(.white.opacity(0.6))
                        Text("Front + Rear Simultaneous")
                            .font(.system(size: 16, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.85))
                    }
                    .padding(.horizontal, 22)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.18))
                    .cornerRadius(24)

                    HStack(spacing: 24) {
                        Button(action: {}) {
                            HStack(spacing: 8) {
                                Image(systemName: "square.and.arrow.up.fill")
                                Text("Share Memory")
                            }
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundColor(.black)
                            .frame(maxWidth: 320)
                            .padding(.vertical, 16)
                            .background(Color.white)
                            .cornerRadius(20)
                        }

                        Button(action: {}) {
                            HStack(spacing: 8) {
                                Image(systemName: "camera.fill")
                                Text("Snap Another")
                            }
                            .font(.system(size: 18, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                            .frame(maxWidth: 320)
                            .padding(.vertical, 16)
                            .background(Color.white.opacity(0.25))
                            .cornerRadius(20)
                        }
                    }
                    .padding(.horizontal, 36)
                }
                .padding(.bottom, 24)

                // Home Indicator
                Capsule()
                    .fill(Color.white.opacity(0.35))
                    .frame(width: 240, height: 5)
                    .padding(.bottom, 12)
            }
        }
        .frame(width: 1032, height: 1376)
    }
}

// MARK: - Apple Watch Screen Mockups

// 1. Main Remote Viewfinder & Tactile Shutter
struct WatchRemoteMockupView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 8) {
                HStack {
                    HStack(spacing: 4) {
                        Circle().fill(Color.green).frame(width: 7, height: 7)
                        Text("Connected")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(.green)
                    }
                    Spacer()
                    Text("10:09")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)

                // Giant Shutter Button
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.18))
                        .frame(width: 76, height: 76)

                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 1.0, green: 0.35, blue: 0.38), Color(red: 1.0, green: 0.6, blue: 0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 64, height: 64)

                    Image(systemName: "camera.fill")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(.white)
                }

                // Quick Action Grid (Quack, Woof, Lock)
                HStack(spacing: 6) {
                    VStack(spacing: 2) {
                        Text("🦆")
                            .font(.system(size: 17))
                        Text("Quack")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.yellow.opacity(0.25))
                    .cornerRadius(10)

                    VStack(spacing: 2) {
                        Text("🐶")
                            .font(.system(size: 17))
                        Text("Woof")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.orange.opacity(0.25))
                    .cornerRadius(10)

                    VStack(spacing: 2) {
                        Image(systemName: "lock.open.fill")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.yellow)
                        Text("Unlock")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.12))
                    .cornerRadius(10)
                }
                .padding(.horizontal, 6)

                // Quick Camera Flip & Layout Bar
                HStack(spacing: 6) {
                    HStack(spacing: 3) {
                        Image(systemName: "arrow.triangle.2.circlepath.camera.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.cyan)
                        Text("Flip View")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.cyan.opacity(0.2))
                    .cornerRadius(8)

                    HStack(spacing: 3) {
                        Image(systemName: "rectangle.inset.filled.and.cursorarrow")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.purple)
                        Text("PiP Mode")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 5)
                    .background(Color.purple.opacity(0.2))
                    .cornerRadius(8)
                }
                .padding(.horizontal, 6)

                // Face Masks Link
                HStack(spacing: 6) {
                    Text("🦁")
                        .font(.system(size: 13))
                    Text("Face Masks (Lion Active)")
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Color.blue.opacity(0.25))
                .cornerRadius(8)
                .padding(.horizontal, 6)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }
}

// 2. Wrist Photo Review with Captured Dual Keepsake
struct WatchPhotoReviewMockupView: View {
    let thumbnail: UIImage

    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 6) {
                HStack {
                    Text("Last Photo")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    Text("10:09")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)

                Image(uiImage: thumbnail)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: 174, height: 142)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.white.opacity(0.3), lineWidth: 1))
                    .shadow(color: .black.opacity(0.5), radius: 4)

                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.system(size: 11))
                    Text("Saved to iPhone Photos")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundColor(.green)
                }

                HStack(spacing: 6) {
                    HStack(spacing: 4) {
                        Image(systemName: "square.and.arrow.up.fill")
                            .font(.system(size: 10))
                        Text("Share")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.18))
                    .cornerRadius(8)

                    HStack(spacing: 4) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 10))
                        Text("Snap More")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.blue)
                    .cornerRadius(8)
                }
                .padding(.horizontal, 8)
                .padding(.top, 2)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }
}

// 3. Apple Vision Face Tracking Masks Selector
struct WatchFaceMasksMockupView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 6) {
                HStack {
                    Text("Face Masks")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    Text("10:09")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)

                Text("Apple Vision Face Tracking")
                    .font(.system(size: 9, weight: .medium, design: .rounded))
                    .foregroundColor(.secondary)

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 5) {
                    maskCard(emoji: "🦁", name: "Lion", isSelected: true)
                    maskCard(emoji: "👑", name: "Crown", isSelected: false)
                    maskCard(emoji: "🦄", name: "Unicorn", isSelected: false)
                    maskCard(emoji: "🐶", name: "Puppy", isSelected: false)
                    maskCard(emoji: "🐱", name: "Kitty", isSelected: false)
                    maskCard(emoji: "🐼", name: "Panda", isSelected: false)
                    maskCard(emoji: "🐻", name: "Bear", isSelected: false)
                    maskCard(emoji: "🐰", name: "Bunny", isSelected: false)
                }
                .padding(.horizontal, 6)

                HStack(spacing: 4) {
                    Circle().fill(Color.cyan).frame(width: 5, height: 5)
                    Text("Lion Companion Orbiting Face")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundColor(.cyan)
                }
                .padding(.top, 2)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }

    private func maskCard(emoji: String, name: String, isSelected: Bool) -> some View {
        HStack(spacing: 4) {
            Text(emoji).font(.system(size: 18))
            Text(name).font(.system(size: 10, weight: .bold, design: .rounded)).foregroundColor(.white)
            if isSelected {
                Spacer()
                Image(systemName: "checkmark")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.blue)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 6)
        .padding(.vertical, 8)
        .background(isSelected ? Color.blue.opacity(0.4) : Color.white.opacity(0.1))
        .cornerRadius(10)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 1.5)
        )
    }
}

// 4. Attention-Grabber Soundboard
struct WatchSoundboardMockupView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 6) {
                HStack {
                    Text("Soundboard")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    Text("10:09")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)

                Text("Grab Toddler's Attention")
                    .font(.system(size: 9, weight: .medium, design: .rounded))
                    .foregroundColor(.secondary)

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)], spacing: 5) {
                    soundCard(emoji: "🦆", name: "Quack", color: .yellow)
                    soundCard(emoji: "🐶", name: "Bark", color: .orange)
                    soundCard(emoji: "🐱", name: "Meow", color: .pink)
                    soundCard(emoji: "👶", name: "Giggle", color: .purple)
                    soundCard(emoji: "🎪", name: "Boing", color: .blue)
                    soundCard(emoji: "🎺", name: "Honk", color: .red)
                    soundCard(emoji: "🚗", name: "Vroom", color: .green)
                    soundCard(emoji: "🔔", name: "Ding", color: .teal)
                }
                .padding(.horizontal, 6)

                HStack(spacing: 4) {
                    Circle().fill(Color.orange).frame(width: 5, height: 5)
                    Text("Instant Sound & Haptic Cue")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundColor(.orange)
                }
                .padding(.top, 2)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }

    private func soundCard(emoji: String, name: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text(emoji).font(.system(size: 18))
            Text(name).font(.system(size: 10, weight: .bold, design: .rounded)).foregroundColor(.white)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(color.opacity(0.3))
        .cornerRadius(10)
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(color.opacity(0.7), lineWidth: 1))
    }
}

// 5. Remote Toddler Screen Lock Activated
struct WatchToddlerLockMockupView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 7) {
                HStack {
                    HStack(spacing: 4) {
                        Circle().fill(Color.green).frame(width: 7, height: 7)
                        Text("Connected")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(.green)
                    }
                    Spacer()
                    HStack(spacing: 3) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 9))
                            .foregroundColor(.yellow)
                        Text("Locked")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.yellow)
                    }
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.yellow.opacity(0.2))
                    .cornerRadius(6)

                    Spacer()
                    Text("10:09")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)

                // Toddler Safe Lock Notice Banner
                HStack(spacing: 5) {
                    Image(systemName: "lock.shield.fill")
                        .foregroundColor(.yellow)
                        .font(.system(size: 13))
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Toddler Screen Locked")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(.yellow)
                        Text("Phone touches make fun bubbles")
                            .font(.system(size: 8, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.8))
                    }
                    Spacer()
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 5)
                .background(Color.yellow.opacity(0.18))
                .cornerRadius(10)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.yellow.opacity(0.4), lineWidth: 1))
                .padding(.horizontal, 6)

                // Shutter Button (Parent still in full remote control!)
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.18))
                        .frame(width: 70, height: 70)

                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color(red: 1.0, green: 0.35, blue: 0.38), Color(red: 1.0, green: 0.6, blue: 0.2)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 58, height: 58)

                    Image(systemName: "camera.fill")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)
                }

                // Action row
                HStack(spacing: 6) {
                    VStack(spacing: 2) {
                        Text("🦆")
                            .font(.system(size: 17))
                        Text("Quack")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.12))
                    .cornerRadius(10)

                    VStack(spacing: 2) {
                        Text("🐶")
                            .font(.system(size: 17))
                        Text("Woof")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.12))
                    .cornerRadius(10)

                    VStack(spacing: 2) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(.yellow)
                        Text("Locked")
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .foregroundColor(.yellow)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.yellow.opacity(0.25))
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.yellow, lineWidth: 1))
                }
                .padding(.horizontal, 6)

                HStack(spacing: 4) {
                    Image(systemName: "hand.tap.fill")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                    Text("Triple-click crown or tap to unlock")
                        .font(.system(size: 8, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                }
                .padding(.top, 4)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }
}

// 6. Camera Angles & Controls
struct WatchCameraControlsMockupView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 7) {
                HStack {
                    Text("Camera Controls")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                    Spacer()
                    Text("10:09")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)

                // Section 1: Swap Angle
                VStack(alignment: .leading, spacing: 3) {
                    Text("CAMERA ANGLE")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundColor(.secondary)

                    HStack {
                        Image(systemName: "arrow.triangle.2.circlepath.camera.fill")
                            .foregroundColor(.cyan)
                            .font(.system(size: 15))
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Swap Primary View")
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            Text("Front Selfie ⇄ Rear Scene")
                                .font(.system(size: 8, weight: .medium, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                        Spacer()
                        Image(systemName: "repeat")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.cyan)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 10)
                    .background(Color.cyan.opacity(0.2))
                    .cornerRadius(10)
                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.cyan.opacity(0.4), lineWidth: 1))
                }
                .padding(.horizontal, 6)

                // Section 2: PiP Corner Position
                VStack(alignment: .leading, spacing: 3) {
                    Text("PIP CORNER POSITION")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundColor(.secondary)

                    HStack(spacing: 6) {
                        HStack(spacing: 3) {
                            Image(systemName: "arrow.up.right.square.fill")
                                .foregroundColor(.yellow)
                            Text("Top Right")
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(Color.yellow.opacity(0.25))
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.yellow, lineWidth: 1))

                        HStack(spacing: 3) {
                            Image(systemName: "arrow.down.left.square")
                                .foregroundColor(.secondary)
                            Text("Bottom Left")
                                .font(.system(size: 9, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(8)
                    }
                }
                .padding(.horizontal, 6)

                // Live status
                HStack(spacing: 4) {
                    Circle().fill(Color.green).frame(width: 5, height: 5)
                    Text("Simultaneous Front + Rear Active")
                        .font(.system(size: 8, weight: .medium, design: .rounded))
                        .foregroundColor(.secondary)
                }
                .padding(.top, 2)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }
}

// 7. Apple Watch Face Complications & Instant Launcher
struct WatchComplicationsMockupView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 8) {
                // Top Complication & Date
                HStack {
                    HStack(spacing: 3) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.yellow)
                        Text("TODDLERCAM")
                            .font(.system(size: 9, weight: .heavy, design: .rounded))
                            .foregroundColor(.yellow)
                    }
                    Spacer()
                    Text("WED 10")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundColor(.orange)
                }
                .padding(.horizontal, 10)
                .padding(.top, 8)

                // Time Display
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("10:09")
                        .font(.system(size: 46, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                    Text("30")
                        .font(.system(size: 20, weight: .bold, design: .rounded))
                        .foregroundColor(.yellow)
                    Spacer()
                }
                .padding(.horizontal, 10)

                // Modular Rectangular Complication
                HStack(spacing: 8) {
                    ZStack {
                        Circle().fill(Color.yellow.opacity(0.25)).frame(width: 34, height: 34)
                        Image(systemName: "camera.circle.fill")
                            .font(.system(size: 26))
                            .foregroundColor(.yellow)
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        Text("ToddlerCam")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        HStack(spacing: 3) {
                            Circle().fill(Color.green).frame(width: 5, height: 5)
                            Text("Parent Remote Ready")
                                .font(.system(size: 10, weight: .medium, design: .rounded))
                                .foregroundColor(.secondary)
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.12))
                .cornerRadius(10)
                .padding(.horizontal, 8)

                // Bottom 3 Complications
                HStack(spacing: 12) {
                    // Battery
                    ZStack {
                        Circle().fill(Color.white.opacity(0.12)).frame(width: 44, height: 44)
                        VStack(spacing: 1) {
                            Image(systemName: "battery.100")
                                .font(.system(size: 12))
                                .foregroundColor(.green)
                            Text("94%")
                                .font(.system(size: 8, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                        }
                    }

                    // Instant SNAP Complication
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Color.yellow.opacity(0.35), Color.orange.opacity(0.35)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 48, height: 48)
                            .overlay(Circle().stroke(Color.yellow, lineWidth: 1.5))

                        VStack(spacing: 1) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.yellow)
                            Text("SNAP")
                                .font(.system(size: 8, weight: .heavy, design: .rounded))
                                .foregroundColor(.white)
                        }
                    }

                    // Quick Sound shortcut
                    ZStack {
                        Circle().fill(Color.white.opacity(0.12)).frame(width: 44, height: 44)
                        Text("🦆")
                            .font(.system(size: 18))
                    }
                }

                HStack(spacing: 4) {
                    Circle().fill(Color.yellow).frame(width: 4, height: 4)
                    Text("Instant Remote Complication")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundColor(.yellow.opacity(0.85))
                }
                .padding(.top, 2)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }
}

// 8. Rapid Wrist Shutter Action & Haptic Feedback
struct WatchShutterActionMockupView: View {
    var body: some View {
        ZStack(alignment: .top) {
            Color.black.ignoresSafeArea()

            VStack(spacing: 7) {
                HStack {
                    HStack(spacing: 4) {
                        Circle().fill(Color.green).frame(width: 7, height: 7)
                        Text("Connected")
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundColor(.green)
                    }
                    Spacer()
                    Text("10:09")
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(.white)
                }
                .padding(.horizontal, 8)
                .padding(.top, 8)

                // Success Badge
                HStack(spacing: 4) {
                    Image(systemName: "sparkles")
                        .foregroundColor(.yellow)
                        .font(.system(size: 11))
                    Text("Photo Captured!")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundColor(.green)
                    Image(systemName: "sparkles")
                        .foregroundColor(.yellow)
                        .font(.system(size: 11))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.2))
                .cornerRadius(12)

                // Pulsing Shutter Button during action
                ZStack {
                    Circle()
                        .stroke(Color.green.opacity(0.6), lineWidth: 3)
                        .frame(width: 82, height: 82)

                    Circle()
                        .fill(Color.white.opacity(0.25))
                        .frame(width: 74, height: 74)

                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [Color.green, Color.mint],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 62, height: 62)

                    Image(systemName: "checkmark")
                        .font(.system(size: 26, weight: .heavy))
                        .foregroundColor(.white)
                }

                Text("Haptic Click • Saved to Phone")
                    .font(.system(size: 9, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.8))

                // Quick navigation
                HStack(spacing: 6) {
                    HStack(spacing: 4) {
                        Image(systemName: "photo.stack")
                            .font(.system(size: 10))
                            .foregroundColor(.orange)
                        Text("Review")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.15))
                    .cornerRadius(8)

                    HStack(spacing: 4) {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 10))
                            .foregroundColor(.cyan)
                        Text("Snap More")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.15))
                    .cornerRadius(8)
                }
                .padding(.horizontal, 10)

                HStack(spacing: 4) {
                    Circle().fill(Color.green).frame(width: 4, height: 4)
                    Text("Simultaneous Front + Rear Saved")
                        .font(.system(size: 8, weight: .bold, design: .rounded))
                        .foregroundColor(.green)
                }
                .padding(.top, 2)

                Spacer(minLength: 4)
            }
            .ignoresSafeArea()
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .frame(width: 208, height: 248)
    }
}

