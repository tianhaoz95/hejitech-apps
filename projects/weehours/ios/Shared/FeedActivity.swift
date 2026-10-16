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
    var babyName: String
}
#endif
