import SwiftUI
import TetherKit
import UIKit

/// Isolated Display Host (PRD §4, §12.1, §12.4).
/// Manages primary (phone) and secondary (external monitor) windows:
/// - External Monitor: Displays the full tiling split-pane desktop workspace (`TilingWorkspaceViewController`).
/// - Phone: Displays the remote controller (`PhoneControllerViewController`) with alternating Touchpad,
///   Developer Keyboard, Workspace/Settings manager, and Dock hardware mouse/keyboard bridge.
@MainActor
public final class DisplayHost: NSObject {
    public static let shared = DisplayHost()

    public let store = WorkspaceStore()
    public private(set) weak var primaryWindow: UIWindow?
    public private(set) var externalWindow: UIWindow?
    public private(set) var externalWorkspaceVC: TilingWorkspaceViewController?
    public private(set) var phoneControllerVC: PhoneControllerViewController?
    public private(set) var primaryWorkspaceVC: TilingWorkspaceViewController?
    private var observers: [NSObjectProtocol] = []

    private override init() {
        super.init()
        setupDisplayObservers()
    }

    public func attach(to windowScene: UIWindowScene) -> UIWindow {
        let window = UIWindow(windowScene: windowScene)
        self.primaryWindow = window

        applyTheme(store.settings.theme, to: window)
        refreshExternalDisplayState()

        if phoneControllerVC == nil {
            let controller = PhoneControllerViewController(store: store, workspaceVC: externalWorkspaceVC)
            self.phoneControllerVC = controller
            if externalWorkspaceVC == nil {
                controller.showMode(.settings)
            }
            window.rootViewController = controller
        }

        window.makeKeyAndVisible()
        return window
    }

    public func attachExternal(windowScene: UIWindowScene) {
        let extWin = UIWindow(windowScene: windowScene)
        let workspace = TilingWorkspaceViewController(store: store)
        extWin.rootViewController = workspace
        applyTheme(store.settings.theme, to: extWin)
        extWin.isHidden = false

        self.externalWindow = extWin
        self.externalWorkspaceVC = workspace

        if let controller = phoneControllerVC {
            controller.setWorkspaceVC(workspace)
        } else {
            let controller = PhoneControllerViewController(store: store, workspaceVC: workspace)
            self.phoneControllerVC = controller
            primaryWindow?.rootViewController = controller
        }

        let bounds = windowScene.screen.nativeBounds
        let desc = "External Display (\(Int(bounds.width))×\(Int(bounds.height)))"
        store.handleExternalDisplayChanged(connected: true, description: desc)
    }

    public func detachExternal() {
        externalWindow?.isHidden = true
        externalWindow = nil
        externalWorkspaceVC = nil

        // NEVER show workspace content on the phone screen!
        // When no monitor is connected, phone shows Settings mode.
        if let controller = phoneControllerVC {
            controller.setWorkspaceVC(nil)
        } else {
            let controller = PhoneControllerViewController(store: store, workspaceVC: nil)
            controller.showMode(.settings)
            self.phoneControllerVC = controller
            primaryWindow?.rootViewController = controller
        }

        let bounds = primaryWindow?.windowScene?.screen.bounds ?? CGRect(x: 0, y: 0, width: 852, height: 393)
        let desc = "No Monitor Connected (\(Int(bounds.width))×\(Int(bounds.height))pt)"
        store.handleExternalDisplayChanged(connected: false, description: desc)
    }

    public func applyTheme(_ theme: ThemeMode, to window: UIWindow? = nil) {
        let targets = [window, primaryWindow, externalWindow].compactMap { $0 }
        for target in targets {
            switch theme {
            case .system:
                target.overrideUserInterfaceStyle = .unspecified
            case .light:
                target.overrideUserInterfaceStyle = .light
            case .dark:
                target.overrideUserInterfaceStyle = .dark
            }
        }
    }

    /// Preferred interface orientations:
    /// Follows user preference in settings (landscape, portrait, or auto).
    public var supportedOrientations: UIInterfaceOrientationMask {
        switch store.settings.controllerOrientation {
        case .landscape, .landscapeFlipped:
            return [.landscapeLeft, .landscapeRight]
        case .portrait:
            return [.portrait, .portraitUpsideDown]
        case .auto:
            return [.landscapeLeft, .landscapeRight, .portrait, .portraitUpsideDown]
        }
    }

    private func setupDisplayObservers() {
        let center = NotificationCenter.default

        // UIScreen connection notifications (Direct USB-C / HDMI dock)
        observers.append(
            center.addObserver(
                forName: UIScreen.didConnectNotification,
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
                forName: UIScreen.didDisconnectNotification,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                Task { @MainActor in
                    self?.refreshExternalDisplayState()
                }
            }
        )

        // UIScene notifications (iOS 16+ WindowScenes)
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
        let extScene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first(where: { $0.session.role != .windowApplication })

        let extScreen = UIScreen.screens.first(where: { $0 != UIScreen.main })

        if let extScene {
            if externalWindow == nil {
                attachExternal(windowScene: extScene)
            }
        } else if let extScreen {
            if externalWindow == nil {
                let extWin = UIWindow(frame: extScreen.bounds)
                extWin.screen = extScreen
                let workspace = TilingWorkspaceViewController(store: store)
                extWin.rootViewController = workspace
                applyTheme(store.settings.theme, to: extWin)
                extWin.isHidden = false

                self.externalWindow = extWin
                self.externalWorkspaceVC = workspace

                if let controller = phoneControllerVC {
                    controller.setWorkspaceVC(workspace)
                } else {
                    let controller = PhoneControllerViewController(store: store, workspaceVC: workspace)
                    self.phoneControllerVC = controller
                    primaryWindow?.rootViewController = controller
                }

                let bounds = extScreen.nativeBounds
                let desc = "External Display (\(Int(bounds.width))×\(Int(bounds.height)))"
                store.handleExternalDisplayChanged(connected: true, description: desc)
            }
        } else {
            if externalWindow != nil {
                detachExternal()
            } else {
                if let controller = phoneControllerVC {
                    controller.setWorkspaceVC(nil)
                } else {
                    let controller = PhoneControllerViewController(store: store, workspaceVC: nil)
                    controller.showMode(.settings)
                    self.phoneControllerVC = controller
                    primaryWindow?.rootViewController = controller
                }
                let bounds = primaryWindow?.windowScene?.screen.bounds ?? CGRect(x: 0, y: 0, width: 852, height: 393)
                let desc = "No Monitor Connected (\(Int(bounds.width))×\(Int(bounds.height))pt)"
                store.handleExternalDisplayChanged(connected: false, description: desc)
            }
        }
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
        supportedInterfaceOrientationsFor window: UIWindow?
    ) -> UIInterfaceOrientationMask {
        return DisplayHost.shared.supportedOrientations
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
        if session.role == .windowApplication {
            self.window = DisplayHost.shared.attach(to: windowScene)
        } else {
            DisplayHost.shared.attachExternal(windowScene: windowScene)
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        if let windowScene = scene as? UIWindowScene, windowScene.session.role != .windowApplication {
            DisplayHost.shared.detachExternal()
        }
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        DisplayHost.shared.refreshExternalDisplayState()
    }
}
