import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// Lock-screen Live Activity while a feed or sleep session is open.
struct SessionActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var kind: String          // bottle | breast | sleep
        var since: Date
        var side: String?
        var statusLine: String
    }
    /// Shown when the household has several children ("" otherwise).
    var babyName: String
    /// The child the session belongs to; nil on activities started by older builds.
    var babyId: String? = nil
}
#endif
