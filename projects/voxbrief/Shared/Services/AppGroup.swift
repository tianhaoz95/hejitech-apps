import Foundation

/// The App Group the app shares with its extensions (widgets, Share) for the Daily Brief
/// snapshot and shared imports. Every target that reads it needs the same
/// `com.apple.security.application-groups` entitlement in project.yml.
public enum AppGroup {
    public static let id = "group.com.jacksonzhou666.voxbrief"
}
