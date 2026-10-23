import ContempoCore
import Foundation
import Observation

/// Persisted store for the host's selected statutory material participation test target.
/// Backed by UserDefaults (shared across app components).
@Observable
@MainActor
public final class TaxTestStore {
    private static let key = "statutory_tax_test"
    private let defaults: UserDefaults

    public var selectedTest: StatutoryTaxTest {
        didSet {
            defaults.set(selectedTest.rawValue, forKey: Self.key)
        }
    }

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        if let raw = defaults.string(forKey: Self.key), let test = StatutoryTaxTest(rawValue: raw) {
            self.selectedTest = test
        } else {
            self.selectedTest = .hundredHours
        }
    }

    public func setTest(_ test: StatutoryTaxTest) {
        self.selectedTest = test
    }
}
