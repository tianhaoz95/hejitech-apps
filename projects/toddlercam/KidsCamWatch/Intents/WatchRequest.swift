import Foundation
import Combine

/// Published state for handling incoming watch launcher / shortcut actions.
@MainActor
public final class WatchRequest: ObservableObject {
    public enum Action: Equatable {
        case remote
        case shutter
        case sound(String)
    }

    public static let shared = WatchRequest()

    @Published public var pendingAction: Action?

    private init() {}
}
