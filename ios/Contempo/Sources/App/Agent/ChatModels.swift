import Foundation

/// Mirrors backend/functions/src/schemas.ts `ChatMessageSchema`, plus a
/// client-only `image` for multimodal questions — in-memory display only
/// (chat history isn't persisted), never sent to the cloud schema.
public struct ChatMessage: Identifiable, Sendable {
    public let id = UUID()
    public var role: ChatRole
    public var text: String
    public var imageData: Data?

    public init(role: ChatRole, text: String, imageData: Data? = nil) {
        self.role = role
        self.text = text
        self.imageData = imageData
    }
}

public enum ChatRole: String, Sendable { case user, agent }

/// Grounding context passed with every question.
public struct UserStats: Sendable {
    public let confirmedHours: Double
    public let thresholdHours: Int
    public let testName: String

    public init(confirmedHours: Double, thresholdHours: Int, testName: String) {
        self.confirmedHours = confirmedHours
        self.thresholdHours = thresholdHours
        self.testName = testName
    }
}

public enum AskOutcome: Sendable {
    case success(answer: String, source: ParseSource)
    case failure(message: String)
}
