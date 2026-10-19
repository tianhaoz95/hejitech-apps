import SwiftUI

public struct ParentHubView: View {
    @ObservedObject var cameraManager = DualCameraManager.shared
    @ObservedObject var soundManager = SoundEffectManager.shared
    @ObservedObject var watchConn = WatchConnectivityManager.shared
    @ObservedObject var guidedManager = GuidedAccessManager.shared
    @Environment(\.presentationMode) var presentationMode

    @State private var showGuidedAccessSheet = false
    @State private var showWatchFaceSheet = false
    @State private var showGallerySheet = false

    private var appVersionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.2.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "4"
        return "\(version) (Build \(build))"
    }

    public init() {}

    public var body: some View {
        NavigationView {
            List {
                // Section 1: Child Safety & Guided Access
                Section(header: Text("Toddler Protection")) {
                    Button(action: {
                        showGuidedAccessSheet = true
                    }) {
                        HStack(spacing: 14) {
                            Image(systemName: "lock.shield.fill")
                                .font(.system(size: 24))
                                .foregroundColor(.green)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Guided Access Setup")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(.primary)

                                Text(guidedManager.isGuidedAccessActive ? "Status: Active (Safe)" : "Status: Off (Tap to Setup)")
                                    .font(.system(size: 13, weight: .regular, design: .rounded))
                                    .foregroundColor(guidedManager.isGuidedAccessActive ? .green : .orange)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }

                    Toggle(isOn: $cameraManager.isToddlerLocked) {
                        HStack(spacing: 14) {
                            Image(systemName: "hand.tap.fill")
                                .font(.system(size: 22))
                                .foregroundColor(.pink)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("In-App Toddler Screen Lock")
                                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                                Text("Replaces screen taps with cheerful magic bubbles")
                                    .font(.system(size: 12, weight: .regular, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }

                // Section 2: Apple Watch Complications & Remote
                Section(header: Text("Apple Watch Complications")) {
                    Button(action: {
                        showWatchFaceSheet = true
                    }) {
                        HStack(spacing: 14) {
                            Image(systemName: "applewatch.side.right")
                                .font(.system(size: 24))
                                .foregroundColor(.blue)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Watch Face Complications")
                                    .font(.system(size: 16, weight: .bold, design: .rounded))
                                    .foregroundColor(.primary)

                                Text("Configure quick-launch complications for your Apple Watch")
                                    .font(.system(size: 13, weight: .regular, design: .rounded))
                                    .foregroundColor(.secondary)
                            }

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }

                    HStack {
                        Image(systemName: watchConn.isReachable ? "antenna.radiowaves.left.and.right" : "antenna.radiowaves.left.and.right.slash")
                            .foregroundColor(watchConn.isReachable ? .green : .secondary)
                        Text("Watch Remote Status")
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                        Spacer()
                        Text(watchConn.isReachable ? "Connected" : "Waiting for Watch...")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(watchConn.isReachable ? .green : .secondary)
                    }
                }

                // Section 3: Camera Preferences
                Section(header: Text("Camera Preferences")) {
                    HStack {
                        Text("Camera Layout")
                        Spacer()
                        Text("Picture-in-Picture (PiP)")
                            .foregroundColor(.secondary)
                    }

                    Toggle("Sound Effects", isOn: Binding(
                        get: { !soundManager.isMuted },
                        set: { soundManager.isMuted = !$0 }
                    ))
                }

                // Section 4: Memories
                Section(header: Text("Photos")) {
                    Button(action: {
                        showGallerySheet = true
                    }) {
                        HStack(spacing: 14) {
                            Image(systemName: "photo.fill.on.rectangle.fill")
                                .font(.system(size: 22))
                                .foregroundColor(.orange)

                            Text("View Captured Photos")
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(.primary)

                            Spacer()

                            Image(systemName: "chevron.right")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Section 5: Demo Mode
                Section(
                    header: Text("Demo Mode"),
                    footer: Text("Simulates dual camera feeds using realistic AI-generated demonstration media (toddler selfie in car seat & car interior PiP) for screenshots and testing. All demo images are 100% synthetic / AI-generated and do not depict any real person.")
                ) {
                    Toggle("Demo Mode", isOn: $cameraManager.isDemoMode)
                }

                // Section 6: App Info
                Section(header: Text("About ToddlerCam")) {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text(appVersionString)
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Child Privacy")
                        Spacer()
                        Text("100% Offline / COPPA Compliant")
                            .foregroundColor(.green)
                    }
                }
            }
            .listStyle(InsetGroupedListStyle())
            .navigationTitle("Parent Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        presentationMode.wrappedValue.dismiss()
                    }
                    .font(.system(size: 16, weight: .bold))
                }
            }
            .sheet(isPresented: $showGuidedAccessSheet) {
                GuidedAccessGuideView()
            }
            .sheet(isPresented: $showWatchFaceSheet) {
                WatchFaceStudioView()
            }
            .sheet(isPresented: $showGallerySheet) {
                PhotoGalleryView()
            }
        }
    }
}
