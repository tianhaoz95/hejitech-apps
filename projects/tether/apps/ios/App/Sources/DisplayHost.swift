import SwiftUI
import TetherKit
import UIKit

/// Isolated Display Host (PRD §4, §12.1, §12.4).
/// This is the ONLY file in the iOS app that touches `UIWindowScene`, `UIScreen`, and display
/// attach/detach notifications. In v1 it runs in mirror mode on the primary window and locks
/// orientation to landscape when an external display is connected, while keeping a clean boundary
/// so a future `UIWindowSceneDelegate` external-screen mode can be added here without touching
/// the workspace or tool views.
@MainActor
public final class DisplayHost: NSObject {
    public static let shared = DisplayHost()

    public let store = WorkspaceStore()
    private weak var primaryWindow: UIWindow?
    private var observers: [NSObjectProtocol] = []

    private override init() {
        super.init()
        setupDisplayObservers()
    }

    public func attach(to windowScene: UIWindowScene) -> UIWindow {
        let window = UIWindow(windowScene: windowScene)
        let rootVC = TilingWorkspaceViewController(store: store)
        window.rootViewController = rootVC
        self.primaryWindow = window
        applyTheme(store.settings.theme, to: window)
        refreshExternalDisplayState()
        window.makeKeyAndVisible()
        return window
    }

    public func applyTheme(_ theme: ThemeMode, to window: UIWindow? = nil) {
        let target = window ?? primaryWindow
        switch theme {
        case .system:
            target?.overrideUserInterfaceStyle = .unspecified
        case .light:
            target?.overrideUserInterfaceStyle = .light
        case .dark:
            target?.overrideUserInterfaceStyle = .dark
        }
    }

    /// Preferred interface orientations for the root container (PRD §12.4: landscape default,
    /// locked to landscape while an external monitor is connected).
    public var supportedOrientations: UIInterfaceOrientationMask {
        if store.isExternalDisplayConnected {
            return .landscape
        }
        return [.landscapeLeft, .landscapeRight, .portrait]
    }

    private func setupDisplayObservers() {
        let center = NotificationCenter.default
        observers.append(
            center.addObserver(
                forName: UIScene.willConnectNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.refreshExternalDisplayState()
                }
            }
        )
        observers.append(
            center.addObserver(
                forName: UIScene.didDisconnectNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.refreshExternalDisplayState()
                }
            }
        )
    }

    public func refreshExternalDisplayState() {
        let windowScenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        if windowScenes.count > 1, let extScene = windowScenes.last {
            let bounds = extScene.screen.nativeBounds
            let desc = "External Display (\(Int(bounds.width))×\(Int(bounds.height)) Mirror)"
            store.handleExternalDisplayChanged(connected: true, description: desc)
            requestLandscapeOrientationIfNeeded()
        } else {
            let bounds = primaryWindow?.windowScene?.screen.bounds ?? CGRect(x: 0, y: 0, width: 852, height: 393)
            let desc = "Mirror Ready (\(Int(bounds.width))×\(Int(bounds.height))pt)"
            store.handleExternalDisplayChanged(connected: false, description: desc)
        }
    }

    private func requestLandscapeOrientationIfNeeded() {
        guard let windowScene = primaryWindow?.windowScene else { return }
        let preferences = UIWindowScene.GeometryPreferences.iOS(interfaceOrientations: .landscapeRight)
        windowScene.requestGeometryUpdate(preferences) { _ in }
    }
}

// MARK: - App & Scene Delegate Entry Point

@main
final class TetherAppDelegate: UIResponder, UIApplicationDelegate {
    private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        return true
    }

    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = TetherSceneDelegate.self
        return config
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Request background execution grace window so active SSH connections survive brief app switches (PRD §10.7)
        backgroundTaskId = application.beginBackgroundTask(withName: "TetherSSHKeepAlive") { [weak self] in
            if let id = self?.backgroundTaskId, id != .invalid {
                application.endBackgroundTask(id)
                self?.backgroundTaskId = .invalid
            }
        }
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        if backgroundTaskId != .invalid {
            application.endBackgroundTask(backgroundTaskId)
            backgroundTaskId = .invalid
        }
    }
}

final class TetherSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = scene as? UIWindowScene else { return }
        self.window = DisplayHost.shared.attach(to: windowScene)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        DisplayHost.shared.refreshExternalDisplayState()
    }
}
