import SwiftUI

/// Main iOS Companion Dashboard & Remote Control Hub for parents.
/// Allows parents to configure settings, switch games on the Apple Watch remotely,
/// monitor toddler play sessions in real-time, and access the safety guides.
struct ParentDashboardView: View {
    @StateObject private var syncManager = IOSSettingsSyncManager.shared
    @State private var showingSyncAlert = false
    @State private var syncAlertTitle = "Settings Synced"
    @State private var syncAlertMessage = ""
    
    let gameModes = [
        ("bubbles", "Bubble Pop", "circle.hexagongrid.circle.fill", Color.pink),
        ("animals", "Animal Friends", "pawprint.fill", Color.orange),
        ("soundGarden", "Sound Garden", "music.note", Color.purple),
        ("sparkles", "Magic Sparkles", "sparkles", Color.cyan),
        ("lullaby", "Sleepy Moon", "moon.stars.fill", Color.indigo)
    ]
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // 1. Apple Watch Live Status & Remote Hub
                    watchLiveRemoteCard
                    
                    // 2. Remote Game Switcher
                    remoteGameSwitcherSection
                    
                    // 3. Remote Session Timer & Lullaby Trigger
                    remoteTimerSection
                    
                    // 4. Sensory & Child Lock Settings
                    watchPreferencesSection
                    
                    // 5. Guides & Sandbox Links
                    quickLinksSection
                    
                    // 6. Screen Time & Privacy Notice
                    footerSection
                }
                .padding()
            }
            .navigationTitle("TinyTouch Remote")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: triggerManualSync) {
                        HStack(spacing: 4) {
                            if syncManager.isSyncing {
                                ProgressView()
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                            }
                            Text(syncManager.isSyncing ? "Syncing..." : "Sync")
                        }
                        .font(.footnote.weight(.semibold))
                    }
                    .disabled(syncManager.isSyncing)
                }
            }
            .alert(syncAlertTitle, isPresented: $showingSyncAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(syncAlertMessage)
            }
        }
    }
    
    private func triggerManualSync() {
        syncManager.manualSync { success, message in
            syncAlertTitle = success ? "Watch Sync Status" : "Sync Notice"
            syncAlertMessage = message
            IOSHapticsManager.shared.playSuccess()
            showingSyncAlert = true
        }
    }
    
    // MARK: - 1. Watch Live Status Card
    private var watchLiveRemoteCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14)
                        .fill(
                            LinearGradient(
                                colors: [.pink, .purple],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 48, height: 48)
                    
                    Image(systemName: "applewatch.radiowaves.left.and.right")
                        .font(.title3)
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 3) {
                    Text("Apple Watch Remote")
                        .font(.headline)
                    
                    HStack(spacing: 6) {
                        Circle()
                            .fill(syncManager.isReachable ? Color.green : Color.blue)
                            .frame(width: 8, height: 8)
                        
                        Text(syncManager.isReachable ? "Watch Active & Connected" : "Watch Ready (Auto-Syncs)")
                            .font(.caption.weight(.medium))
                            .foregroundColor(syncManager.isReachable ? .green : .secondary)
                    }
                }
                
                Spacer()
                
                Button(action: triggerManualSync) {
                    HStack(spacing: 4) {
                        if syncManager.isSyncing {
                            ProgressView()
                                .scaleEffect(0.7)
                        } else {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.system(size: 11, weight: .bold))
                        }
                        Text(syncManager.isSyncing ? "Syncing..." : "Sync Now")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.pink.opacity(0.12))
                    .foregroundColor(.pink)
                    .cornerRadius(12)
                }
                .disabled(syncManager.isSyncing)
            }
            
            Divider()
            
            // Live Session Metrics
            HStack(spacing: 20) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("CURRENT GAME")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    
                    Text(friendlyModeName(syncManager.watchCurrentMode))
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.primary)
                }
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("SENSORY TOUCHES")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    
                    Text("\(syncManager.watchTouchCount)")
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(.purple)
                }
                
                Spacer()
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("TIMER REMAINING")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)
                    
                    Text(syncManager.formattedWatchRemainingTime)
                        .font(.subheadline.weight(.bold))
                        .foregroundColor(.blue)
                }
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(20)
    }
    
    // MARK: - 2. Remote Game Switcher
    private var remoteGameSwitcherSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Switch Game on Watch", systemImage: "hand.tap.fill")
                .font(.headline)
            
            Text("Tap an activity to remotely switch what your child sees on your Apple Watch.")
                .font(.caption)
                .foregroundColor(.secondary)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(gameModes, id: \.0) { mode in
                        let isSelected = (syncManager.selectedMode.lowercased() == mode.0.lowercased() || syncManager.watchCurrentMode.lowercased() == mode.0.lowercased())
                        Button(action: {
                            syncManager.switchWatchMode(to: mode.0)
                            IOSHapticsManager.shared.playTap()
                        }) {
                            VStack(spacing: 8) {
                                ZStack {
                                    Circle()
                                        .fill(isSelected ? mode.3 : mode.3.opacity(0.15))
                                        .frame(width: 50, height: 50)
                                    
                                    Image(systemName: mode.2)
                                        .font(.title3)
                                        .foregroundColor(isSelected ? .white : mode.3)
                                }
                                
                                Text(mode.1)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(isSelected ? mode.3 : .primary)
                            }
                            .padding(.vertical, 8)
                            .padding(.horizontal, 10)
                            .background(isSelected ? mode.3.opacity(0.1) : Color(uiColor: .secondarySystemBackground))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16)
                                    .stroke(isSelected ? mode.3 : Color.clear, lineWidth: 2)
                            )
                            .cornerRadius(16)
                        }
                    }
                }
                .padding(.vertical, 4)
            }
        }
    }
    
    // MARK: - 3. Remote Session Timer & Lullaby Trigger
    private var remoteTimerSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Session Timer & Transition", systemImage: "timer")
                .font(.headline)
            
            HStack(spacing: 10) {
                ForEach([0, 3, 5, 10], id: \.self) { mins in
                    let isSelected = (syncManager.timerMinutes == mins)
                    Button(action: {
                        syncManager.setWatchTimer(minutes: mins)
                        IOSHapticsManager.shared.playTap()
                    }) {
                        Text(mins == 0 ? "Unlimited" : "\(mins)m")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(isSelected ? Color.blue : Color(uiColor: .secondarySystemBackground))
                            .foregroundColor(isSelected ? .white : .primary)
                            .cornerRadius(12)
                    }
                }
            }
            
            // Trigger Lullaby Button
            Button(action: {
                syncManager.triggerLullabyNow()
                IOSHapticsManager.shared.playSuccess()
            }) {
                HStack(spacing: 10) {
                    Image(systemName: "moon.stars.fill")
                        .foregroundColor(.yellow)
                    Text("Start Calming Lullaby Now")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                }
                .padding()
                .background(Color.indigo.opacity(0.15))
                .foregroundColor(.indigo)
                .cornerRadius(14)
            }
        }
    }
    
    // MARK: - 4. Sensory & Child Lock Preferences
    private var watchPreferencesSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label("Watch Settings & Accessibility", systemImage: "slider.horizontal.3")
                .font(.headline)
            
            VStack(spacing: 0) {
                ToggleRow(
                    icon: "speaker.wave.2.fill",
                    color: .purple,
                    title: "Sound Effects",
                    subtitle: "Play gentle pops, chimes, and notes",
                    isOn: $syncManager.soundEnabled
                )
                Divider().padding(.leading, 44)
                
                ToggleRow(
                    icon: "waveform.circle.fill",
                    color: .orange,
                    title: "Animal Speech Words",
                    subtitle: "Spoken animal names ('Duck! Quack quack!')",
                    isOn: $syncManager.voiceEnabled
                )
                Divider().padding(.leading, 44)
                
                ToggleRow(
                    icon: "hand.tap.fill",
                    color: .green,
                    title: "Tactile Haptics",
                    subtitle: "Taptic feedback on screen touches and crown",
                    isOn: $syncManager.hapticsEnabled
                )
                Divider().padding(.leading, 44)
                
                ToggleRow(
                    icon: "sparkles",
                    color: .teal,
                    title: "Low-Stimulation Mode",
                    subtitle: "Softer colors and slower animations",
                    isOn: $syncManager.lowStimulation
                )
                Divider().padding(.leading, 44)
                
                // Shield hold duration picker
                HStack(spacing: 14) {
                    Image(systemName: "lock.shield.fill")
                        .foregroundColor(.red)
                        .frame(width: 24)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Parent Shield Hold Time")
                            .font(.subheadline.weight(.medium))
                        Text("Duration required to unlock watch settings")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Picker("Hold Time", selection: $syncManager.lockHoldDuration) {
                        Text("3 sec").tag(3.0)
                        Text("5 sec").tag(5.0)
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 130)
                }
                .padding(.vertical, 12)
                .padding(.horizontal, 16)
            }
            .background(Color(uiColor: .secondarySystemBackground))
            .cornerRadius(16)
        }
    }
    
    // MARK: - 5. Quick Links (Guide & Sandbox)
    private var quickLinksSection: some View {
        VStack(spacing: 12) {
            NavigationLink(destination: SafetyGuideView()) {
                HStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .fill(Color.red.opacity(0.15))
                            .frame(width: 44, height: 44)
                        Image(systemName: "shield.checkered")
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(.red)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Toddler Lock & SOS Guide")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.primary)
                        Text("Disable accidental 911 calls & lock touch inputs")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(14)
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(16)
            }
            
            NavigationLink(destination: GamePreviewView()) {
                HStack(spacing: 16) {
                    ZStack {
                        Circle()
                            .fill(Color.blue.opacity(0.15))
                            .frame(width: 44, height: 44)
                        Image(systemName: "sparkles.rectangle.stack.fill")
                            .font(.subheadline.weight(.bold))
                            .foregroundColor(.blue)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Interactive Sensory Preview")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.primary)
                        Text("Test sound effects and interactions on iPhone")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(14)
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(16)
            }
        }
    }
    
    // MARK: - 6. Footer Section
    private var footerSection: some View {
        VStack(spacing: 14) {
            HStack(spacing: 12) {
                Image(systemName: "lock.circle.fill")
                    .font(.title2)
                    .foregroundColor(.green)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("100% Kid-Safe & Private")
                        .font(.footnote.weight(.semibold))
                    Text("No tracking, no ads, no analytics. All settings sync directly over local Bluetooth.")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.green.opacity(0.1))
            .cornerRadius(14)
            
            Text("TinyTouch v1.4 • Connected Apple Watch Companion")
                .font(.caption2)
                .foregroundColor(.secondary)
                .padding(.bottom, 16)
        }
    }
    
    private func friendlyModeName(_ raw: String) -> String {
        switch raw.lowercased() {
        case "bubbles", "bubble", "bubblepop": return "Bubble Pop"
        case "animals", "animal", "animalfriends": return "Animal Friends"
        case "soundgarden", "xylophone", "chimes": return "Sound Garden"
        case "sparkles", "sparkle", "magicsparkles": return "Magic Sparkles"
        case "lullaby", "lullabies", "sleepymoon": return "Sleepy Moon"
        default: return raw.capitalized
        }
    }
}

struct ToggleRow: View {
    let icon: String
    let color: Color
    let title: String
    let subtitle: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                Text(subtitle)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .labelsHidden()
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 16)
    }
}
