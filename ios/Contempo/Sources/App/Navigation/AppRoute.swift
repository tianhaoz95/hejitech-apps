import ContempoCore
import Foundation

/// Everything Capture (or Dashboard/EntryDetail, when resuming/editing) hands
/// off to Confirm. Android carries these as string-encoded nav args (no
/// Double/nullable NavType); SwiftUI's typed `NavigationStack` destinations
/// let this just be a plain `Hashable` struct instead.
struct ConfirmParams: Hashable {
    var property: String = ""
    var task: String = ""
    var durationMinutes: Int = 0
    var category: String = EntryCategory.other.firestoreValue
    var captureSource: CaptureSource = .manual
    var miles: Double = 0
    var resolvedActivityDateIso: String?
    var photoData: Data?
    var entryId: String = ""
    var captureLat: Double?
    var captureLng: Double?
}

enum LegalDoc: String, Hashable {
    case privacy
    case terms
}

/// Pushed destinations within a single tab's `NavigationStack`.
enum AppRoute: Hashable {
    case confirm(ConfirmParams)
    case entryDetail(String)
    case legal(LegalDoc)
}
