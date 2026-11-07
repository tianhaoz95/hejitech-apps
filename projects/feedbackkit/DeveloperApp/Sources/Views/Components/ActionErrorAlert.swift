import SwiftUI

extension View {
    /// Shows `AppState.actionErrorMessage`. Lives on the app's root so a failed
    /// triage action is seen from any screen, including one that just closed.
    func actionErrorAlert(_ appState: AppState) -> some View {
        alert(
            "Something went wrong",
            isPresented: Binding(
                get: { appState.actionErrorMessage != nil },
                set: { if !$0 { appState.actionErrorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(appState.actionErrorMessage ?? "")
        }
    }
}
