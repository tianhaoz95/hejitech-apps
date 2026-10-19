import SwiftUI

/// Parent Dashboard for selecting game modes, configuring play timers,
/// adjusting sensory settings, and accessing holding safety tips.
struct ParentDashboardView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                // Section 1: Activities
                Section {
                    ForEach(GameMode.allCases) { mode in
                        Button(action: {
                            appState.currentMode = mode
                            HapticsManager.shared.playTap()
                        }) {
                            HStack(spacing: 10) {
                                Image(systemName: mode.systemIcon)
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(mode.themeColor)
                                    .frame(width: 24)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(mode.title)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundColor(.white)
                                    Text(mode.developmentalFocus)
                                        .font(.system(size: 9))
                                        .foregroundColor(.gray)
                                }
                                
                                Spacer()
                                
                                if appState.currentMode == mode {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                        .font(.system(size: 14))
                                }
                            }
                            .padding(.vertical, 3)
                        }
                    }
                } header: {
                    Text("Toddler Activities")
                        .font(.system(size: 10, weight: .bold))
                }
                
                // Section 2: Play Timer & Gentle Wind-Down
                Section {
                    HStack {
                        Image(systemName: "timer")
                            .foregroundColor(.orange)
                        Text("Timer")
                            .font(.system(size: 12))
                        Spacer()
                        Text(appState.isTimerActive ? appState.formattedRemainingTime : "Off")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(appState.isTimerActive ? .orange : .gray)
                    }
                    
                    HStack(spacing: 6) {
                        timerPill(title: "Off", minutes: 0)
                        timerPill(title: "3m", minutes: 3)
                        timerPill(title: "5m", minutes: 5)
                        timerPill(title: "10m", minutes: 10)
                    }
                    .padding(.vertical, 2)
                    
                    if appState.isTimerActive {
                        Text("When time ends, app gently transitions to Sleepy Lullaby mode to avoid tears.")
                            .font(.system(size: 9))
                            .foregroundColor(.secondary)
                    }
                } header: {
                    Text("Session Limit")
                        .font(.system(size: 10, weight: .bold))
                }
                
                // Section 3: Sensory & Audio Settings
                Section {
                    Toggle(isOn: $appState.soundEnabled) {
                        HStack {
                            Image(systemName: appState.soundEnabled ? "speaker.wave.2.fill" : "speaker.slash.fill")
                                .foregroundColor(.cyan)
                            Text("Sound Effects")
                                .font(.system(size: 12))
                        }
                    }
                    
                    Toggle(isOn: $appState.voiceEnabled) {
                        HStack {
                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                .foregroundColor(.yellow)
                            Text("Spoken Words")
                                .font(.system(size: 12))
                        }
                    }
                    
                    Toggle(isOn: $appState.hapticsEnabled) {
                        HStack {
                            Image(systemName: "hand.tap.fill")
                                .foregroundColor(.purple)
                            Text("Taptic Pulses")
                                .font(.system(size: 12))
                        }
                    }
                    
                    Toggle(isOn: $appState.lowStimulation) {
                        HStack {
                            Image(systemName: "tortoise.fill")
                                .foregroundColor(.mint)
                            Text("Low Stimulation")
                                .font(.system(size: 12))
                        }
                    }
                } header: {
                    Text("Sensory Options")
                        .font(.system(size: 10, weight: .bold))
                }
                
                // Section 4: Safe Holding & Water Lock Guide
                Section {
                    Button(action: {
                        appState.isParentGuideOpen = true
                    }) {
                        HStack {
                            Image(systemName: "shield.lefthalf.filled")
                                .foregroundColor(.blue)
                            Text("Lock & Safety Guide")
                                .font(.system(size: 12, weight: .medium))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 10))
                                .foregroundColor(.gray)
                        }
                    }
                } header: {
                    Text("Safety Tips")
                        .font(.system(size: 10, weight: .bold))
                }
                
                // Section 5: Session Stats
                Section {
                    HStack {
                        Text("Touches this turn")
                            .font(.system(size: 11))
                        Spacer()
                        Text("\(appState.sessionTouchesCount)")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.green)
                    }
                } header: {
                    Text("Engagement")
                        .font(.system(size: 10, weight: .bold))
                }
                
                // Section 6: Resume Play Button
                Section {
                    Button(action: {
                        HapticsManager.shared.playTap()
                        appState.isParentMenuOpen = false
                    }) {
                        HStack {
                            Spacer()
                            Image(systemName: "play.fill")
                            Text("Return to Toddler Play")
                                .font(.system(size: 13, weight: .bold))
                            Spacer()
                        }
                        .foregroundColor(.white)
                        .padding(.vertical, 6)
                    }
                    .listRowBackground(Color.blue)
                }
            }
            .navigationTitle("Parent Menu")
            .sheet(isPresented: $appState.isParentGuideOpen) {
                ParentGuideView()
            }
        }
    }
    
    @ViewBuilder
    private func timerPill(title: String, minutes: Int) -> some View {
        Button(action: {
            appState.setPlayTimer(minutes: minutes)
            HapticsManager.shared.playTap()
        }) {
            Text(title)
                .font(.system(size: 11, weight: .bold))
                .padding(.vertical, 6)
                .padding(.horizontal, 8)
                .background(
                    Capsule().fill(appState.selectedTimerMinutes == minutes ? Color.orange : Color.gray.opacity(0.3))
                )
                .foregroundColor(appState.selectedTimerMinutes == minutes ? .black : .white)
        }
        .buttonStyle(.plain)
    }
}
