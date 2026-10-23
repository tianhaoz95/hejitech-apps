import Foundation

/// Statutory tax defense tests for material participation under IRS IRC §469.
public enum StatutoryTaxTest: String, CaseIterable, Codable, Sendable, Identifiable {
    /// 100 hours of active participation and more than any other individual (Treas. Reg. §1.469-5T(a)(3)).
    case hundredHours = "hundred_hours"
    /// 500 hours of active participation during the tax year (Treas. Reg. §1.469-5T(a)(1)).
    case fiveHundredHours = "five_hundred_hours"
    /// Real Estate Professional Status (IRC §469(c)(7)): 750 hours + >50% personal services.
    case realEstateProfessional = "reps_750"

    public var id: String { rawValue }

    public var thresholdHours: Int {
        switch self {
        case .hundredHours: return 100
        case .fiveHundredHours: return 500
        case .realEstateProfessional: return 750
        }
    }

    public var shortName: String {
        switch self {
        case .hundredHours: return "STR (100h)"
        case .fiveHundredHours: return "500h Test"
        case .realEstateProfessional: return "REPS (750h)"
        }
    }

    public var title: String {
        switch self {
        case .hundredHours: return "Short-Term Rental (100 hours)"
        case .fiveHundredHours: return "Material Participation (500 hours)"
        case .realEstateProfessional: return "Real Estate Professional Status (750 hours)"
        }
    }

    public var legalCitation: String {
        switch self {
        case .hundredHours: return "Treas. Reg. §1.469-5T(a)(3)"
        case .fiveHundredHours: return "Treas. Reg. §1.469-5T(a)(1)"
        case .realEstateProfessional: return "IRC §469(c)(7)"
        }
    }
}
