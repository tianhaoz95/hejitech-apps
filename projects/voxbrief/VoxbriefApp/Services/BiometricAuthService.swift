import Foundation
#if canImport(LocalAuthentication)
import LocalAuthentication
#endif

public enum BiometricKind: String, Sendable {
    case faceID = "Face ID"
    case touchID = "Touch ID"
    case opticID = "Optic ID"
    case passcode = "Passcode"
    case none = "None"
}

@MainActor
public final class BiometricAuthService: ObservableObject {
    public static let shared = BiometricAuthService()

    public init() {}

    public var biometricType: BiometricKind {
        #if canImport(LocalAuthentication)
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            return .passcode
        }
        switch context.biometryType {
        case .faceID:
            return .faceID
        case .touchID:
            return .touchID
        case .opticID:
            return .opticID
        case .none:
            return .passcode
        @unknown default:
            return .passcode
        }
        #else
        return .none
        #endif
    }

    public var canAuthenticate: Bool {
        #if canImport(LocalAuthentication)
        let context = LAContext()
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
        #else
        return false
        #endif
    }

    public func authenticate(reason: String = "Unlock this protected voice note") async -> Bool {
        #if canImport(LocalAuthentication)
        let context = LAContext()
        context.localizedCancelTitle = "Cancel"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            print("[BiometricAuthService] Policy cannot be evaluated: \(String(describing: error))")
            return false
        }

        do {
            return try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
        } catch {
            print("[BiometricAuthService] Authentication failed: \(error)")
            return false
        }
        #else
        return false
        #endif
    }
}
