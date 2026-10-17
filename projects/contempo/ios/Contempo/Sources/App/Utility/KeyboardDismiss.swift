import SwiftUI
import UIKit

/// Resigns whichever text field/editor currently has focus — for a keyboard
/// toolbar "Done" button on a screen with several fields (Confirm, the
/// entry-detail inline editor), where tracking a single `@FocusState` per
/// field would be more plumbing than the screen needs. Single-field screens
/// (Chat, the Capture typing hero) use their own `@FocusState` instead, since
/// that also drives tap-outside-to-dismiss.
func hideKeyboard() {
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}
