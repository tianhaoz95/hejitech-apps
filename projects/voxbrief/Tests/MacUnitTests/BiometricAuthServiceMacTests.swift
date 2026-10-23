import XCTest
@testable import VoxbriefMac

final class BiometricAuthServiceMacTests: XCTestCase {
    @MainActor
    func testBiometricTypeAvailability() {
        let service = BiometricAuthService.shared
        // On macOS devices without Touch ID (or in CI), type falls back to passcode or none, never crashes
        let biometry = service.biometricType
        XCTAssertTrue([BiometricKind.faceID, .touchID, .opticID, .passcode, .none].contains(biometry))
    }

    @MainActor
    func testCanAuthenticatePropertyIsSafe() {
        let service = BiometricAuthService.shared
        // Evaluates policy safely without throwing
        _ = service.canAuthenticate
    }
}
