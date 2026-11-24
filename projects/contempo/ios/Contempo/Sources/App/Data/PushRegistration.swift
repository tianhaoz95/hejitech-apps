import ContempoCore
import Foundation

/// Registers and unregisters the iPhone's APNs device token with Contempo's Worker (`POST /api/push-devices`)
/// so the daily contemporaneity nudge cron can warn the host before drafts cross the 14-day IRS cliff.
enum PushRegistration {
    static func register(deviceToken: Data) async {
        guard ContempoBackend.uid != nil else { return }
        let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
        #if DEBUG
        let env = "sandbox"
        #else
        let env = "production"
        #endif
        _ = try? await ContempoBackend.api(
            "push-devices",
            body: ["apns_token": hex, "environment": env, "label": "iPhone"]
        )
    }
}
