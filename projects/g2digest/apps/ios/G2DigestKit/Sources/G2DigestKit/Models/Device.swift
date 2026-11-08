import Foundation

public struct PairResult: Codable, Hashable, Sendable {
    public let deviceToken: String
    public let deviceId: String

    public enum CodingKeys: String, CodingKey {
        case deviceToken = "device_token"
        case deviceId = "device_id"
    }

    public init(deviceToken: String, deviceId: String) {
        self.deviceToken = deviceToken
        self.deviceId = deviceId
    }
}

public struct DeviceStatus: Codable, Hashable, Sendable {
    public let paired: Bool
    public let via: String?

    public init(paired: Bool, via: String? = nil) {
        self.paired = paired
        self.via = via
    }
}
