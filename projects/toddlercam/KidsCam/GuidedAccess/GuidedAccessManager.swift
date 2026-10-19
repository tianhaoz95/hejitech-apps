import Foundation
import UIKit
import Combine

public final class GuidedAccessManager: ObservableObject {
    public static let shared = GuidedAccessManager()

    @Published public var isGuidedAccessActive: Bool = false

    private var cancellables = Set<AnyCancellable>()

    public init() {
        checkStatus()
        NotificationCenter.default.publisher(for: UIAccessibility.guidedAccessStatusDidChangeNotification)
            .sink { [weak self] _ in
                self?.checkStatus()
            }
            .store(in: &cancellables)
    }

    public func checkStatus() {
        DispatchQueue.main.async {
            self.isGuidedAccessActive = UIAccessibility.isGuidedAccessEnabled
        }
    }

    public func openGuidedAccessSettings() {
        // Copy "Guided Access" to clipboard so parent can instantly paste into Settings search if needed
        UIPasteboard.general.string = "Guided Access"

        // Candidate URLs prioritized for deep-linking across iOS versions:
        // On iOS 15-17: App-prefs / prefs with ACCESSIBILITY & GUIDED_ACCESS_TITLE navigates directly.
        // On iOS 18+: App-prefs opens Settings with Accessibility visible in the main section.
        let candidateURLs = [
            "App-prefs:root=ACCESSIBILITY&path=GUIDED_ACCESS_TITLE",
            "prefs:root=ACCESSIBILITY&path=GUIDED_ACCESS_TITLE",
            "App-prefs:root=ACCESSIBILITY",
            "prefs:root=ACCESSIBILITY",
            "App-prefs:ACCESSIBILITY",
            UIApplication.openSettingsURLString
        ]

        attemptOpenCandidates(candidateURLs)
    }

    private func attemptOpenCandidates(_ urls: [String]) {
        guard let first = urls.first else { return }
        guard let url = URL(string: first) else {
            attemptOpenCandidates(Array(urls.dropFirst()))
            return
        }

        UIApplication.shared.open(url, options: [:]) { [weak self] success in
            if !success && urls.count > 1 {
                self?.attemptOpenCandidates(Array(urls.dropFirst()))
            }
        }
    }
}
