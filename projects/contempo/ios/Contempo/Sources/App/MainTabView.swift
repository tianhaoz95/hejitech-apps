import ContempoCore
import FeedbackKit
import SwiftUI

/// Screen tags exist solely to tell FeedbackKit which tab is visible, so a
/// shake-to-report says where it came from (`FeedbackKit.currentScreen`); they
/// don't otherwise change the native `TabView` chrome or behavior.
private enum MainTab: Hashable {
    case capture, dashboard, chat, settings
}

struct MainTabView: View {
    @State private var selectedTab: MainTab = .capture

    var body: some View {
        TabView(selection: $selectedTab) {
            CaptureTabView()
                .tabItem { Label("Capture", systemImage: "mic.circle") }
                .tag(MainTab.capture)
            RoutedNavigationStack { DashboardScreen() }
                .tabItem { Label("Dashboard", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(MainTab.dashboard)
            RoutedNavigationStack { ChatScreen() }
                .tabItem { Label("Chat", systemImage: "sparkles") }
                .tag(MainTab.chat)
            RoutedNavigationStack { SettingsScreen() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(MainTab.settings)
        }
        .onChange(of: selectedTab) { _, newValue in
            FeedbackKit.currentScreen = screenName(for: newValue)
        }
        .onAppear {
            FeedbackKit.currentScreen = screenName(for: selectedTab)
        }
    }

    private func screenName(for tab: MainTab) -> String {
        switch tab {
        case .capture: return "Capture"
        case .dashboard: return "Dashboard"
        case .chat: return "Chat"
        case .settings: return "Settings"
        }
    }
}

/// Capture needs its own explicit `NavigationPath` (unlike Dashboard/
/// EntryDetail, which push via plain `NavigationLink(value:)`), since the
/// push to Confirm happens programmatically after an async parse completes,
/// not from a direct tap.
private struct CaptureTabView: View {
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            CaptureScreen(
                onDrafted: { params in
                    path.append(AppRoute.confirm(params))
                },
                onEntryClick: { entryId in
                    path.append(AppRoute.entryDetail(entryId))
                }
            )
            .navigationDestination(for: AppRoute.self) { route in
                AppRouteDestination(route: route)
            }
        }
    }
}

/// Shared by any tab whose root pushes via `NavigationLink(value: AppRoute...)`.
struct RoutedNavigationStack<Root: View>: View {
    private let root: () -> Root

    init(@ViewBuilder root: @escaping () -> Root) {
        self.root = root
    }

    var body: some View {
        NavigationStack {
            root()
                .navigationDestination(for: AppRoute.self) { route in
                    AppRouteDestination(route: route)
                }
        }
    }
}

private struct AppRouteDestination: View {
    let route: AppRoute

    var body: some View {
        switch route {
        case .confirm(let params):
            ConfirmScreen(params: params) {}
        case .entryDetail(let entryId):
            EntryDetailScreen(entryId: entryId)
        case .legal(let doc):
            LegalScreen(doc: doc)
        }
    }
}
