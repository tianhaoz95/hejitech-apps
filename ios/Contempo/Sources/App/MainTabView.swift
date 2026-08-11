import ContempoCore
import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            CaptureTabView()
                .tabItem { Label("Capture", systemImage: "mic.circle") }
            RoutedNavigationStack { DashboardScreen() }
                .tabItem { Label("Dashboard", systemImage: "chart.line.uptrend.xyaxis") }
            RoutedNavigationStack { ChatScreen() }
                .tabItem { Label("Chat", systemImage: "sparkles") }
            RoutedNavigationStack { SettingsScreen() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
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
