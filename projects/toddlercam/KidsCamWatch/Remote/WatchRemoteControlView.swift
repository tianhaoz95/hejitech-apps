import SwiftUI

public struct WatchRemoteControlView: View {
    @ObservedObject var sessionManager = WatchSessionManager.shared
    @State private var isPressingShutter = false

    public init() {}

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    // Status bar
                    statusBar

                    // Giant Shutter Button
                    shutterSection

                    // Quick Action Grid
                    quickActionGrid

                    // Camera Controls Link
                    NavigationLink(destination: WatchCameraControlsView()) {
                        HStack {
                            Image(systemName: "camera.badge.ellipsis")
                                .foregroundColor(.cyan)
                            Text("Camera Controls")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                            Spacer()
                            Text(sessionManager.captureMode)
                                .font(.system(size: 10, weight: .regular, design: .rounded))
                                .foregroundColor(.secondary)
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }

                    // Photo Review Link
                    NavigationLink(destination: WatchPhotoReviewView()) {
                        HStack {
                            Image(systemName: "photo.stack")
                                .foregroundColor(.orange)
                            Text("Review Last Photo")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                            Spacer()
                            if sessionManager.lastPhotoThumbnail != nil {
                                Circle().fill(Color.green).frame(width: 6, height: 6)
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    // Face Masks (Apple Vision Face Tracking)
                    NavigationLink(destination: WatchFaceEmojiSettingsView()) {
                        HStack {
                            Text(sessionManager.activeFaceEmoji == "none" ? "🎭" : (FaceEmojiType(rawValue: sessionManager.activeFaceEmoji)?.emoji ?? "🎭"))
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Face Masks (Vision)")
                                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                                Text(sessionManager.activeFaceEmoji == "none" ? "None (Tap to set)" : (FaceEmojiType(rawValue: sessionManager.activeFaceEmoji)?.displayName ?? "Active"))
                                    .font(.system(size: 10, weight: .regular, design: .rounded))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }

                    // Full Soundboard Link
                    NavigationLink(destination: SillySoundboardView()) {
                        HStack {
                            Text("🦆")
                            Text("Silly Soundboard")
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 10)
            }
            .navigationTitle("Remote")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    // MARK: - Status Bar
    private var statusBar: some View {
        HStack {
            Circle()
                .fill(sessionManager.isReachable ? Color.green : Color.orange)
                .frame(width: 8, height: 8)

            Text(sessionManager.isReachable ? "Connected" : "Waiting for Phone")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundColor(sessionManager.isReachable ? .green : .orange)

            Spacer()

            if sessionManager.isToddlerLocked {
                HStack(spacing: 3) {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 10))
                        .foregroundColor(.yellow)
                    Text("Locked")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                        .foregroundColor(.yellow)
                }
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.yellow.opacity(0.2))
                .cornerRadius(8)
            }
        }
    }

    // MARK: - Shutter Section
    private var shutterSection: some View {
        VStack(spacing: 6) {
            // Photo / Video Mode Selector
            HStack(spacing: 4) {
                Button(action: {
                    sessionManager.setCaptureMode("Photo")
                }) {
                    HStack(spacing: 3) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 9, weight: .bold))
                        Text("Photo")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(sessionManager.captureMode == "Photo" ? Color.yellow : Color.white.opacity(0.12))
                    .foregroundColor(sessionManager.captureMode == "Photo" ? .black : .white)
                    .cornerRadius(12)
                }
                .buttonStyle(PlainButtonStyle())

                Button(action: {
                    sessionManager.setCaptureMode("Video")
                }) {
                    HStack(spacing: 3) {
                        Image(systemName: "video.fill")
                            .font(.system(size: 9, weight: .bold))
                        Text("Video")
                            .font(.system(size: 10, weight: .bold, design: .rounded))
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(sessionManager.captureMode == "Video" ? Color.red : Color.white.opacity(0.12))
                    .foregroundColor(.white)
                    .cornerRadius(12)
                }
                .buttonStyle(PlainButtonStyle())
            }

            // Giant Shutter / Record Button
            Button(action: {
                if sessionManager.captureMode == "Video" {
                    sessionManager.toggleVideoRecording()
                } else {
                    sessionManager.sendShutterCommand()
                }
            }) {
                ZStack {
                    if sessionManager.captureMode == "Video" {
                        if sessionManager.isRecordingVideo {
                            Circle()
                                .stroke(Color.red, lineWidth: 4)
                                .frame(width: 78, height: 78)

                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.red)
                                .frame(width: 30, height: 30)
                        } else {
                            Circle()
                                .fill(Color.red.opacity(0.25))
                                .frame(width: 78, height: 78)

                            Circle()
                                .fill(Color.red)
                                .frame(width: 66, height: 66)

                            Image(systemName: "video.fill")
                                .font(.system(size: 26, weight: .bold))
                                .foregroundColor(.white)
                        }
                    } else {
                        Circle()
                            .fill(Color.white.opacity(0.2))
                            .frame(width: 78, height: 78)

                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [Color(red: 1.0, green: 0.35, blue: 0.38), Color(red: 1.0, green: 0.6, blue: 0.2)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 66, height: 66)

                        Image(systemName: "camera.fill")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.white)
                    }
                }
                .scaleEffect(isPressingShutter ? 0.9 : 1.0)
            }
            .buttonStyle(PlainButtonStyle())
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressingShutter = true }
                    .onEnded { _ in isPressingShutter = false }
            )

            if sessionManager.isRecordingVideo {
                HStack(spacing: 4) {
                    Circle().fill(Color.red).frame(width: 6, height: 6)
                    Text("REC \(formatWatchDuration(sessionManager.videoDuration))")
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundColor(.red)
                }
            }
        }
    }

    // MARK: - Quick Action Grid
    private var quickActionGrid: some View {
        HStack(spacing: 8) {
            // Quick Duck Quack Sound
            Button(action: {
                sessionManager.playAnimalSound("quack")
            }) {
                VStack(spacing: 3) {
                    Text("🦆")
                        .font(.system(size: 20))
                    Text("Quack")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.yellow.opacity(0.25))
                .cornerRadius(12)
            }
            .buttonStyle(PlainButtonStyle())

            // Quick Puppy Bark Sound
            Button(action: {
                sessionManager.playAnimalSound("woof")
            }) {
                VStack(spacing: 3) {
                    Text("🐶")
                        .font(.system(size: 20))
                    Text("Woof")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.25))
                .cornerRadius(12)
            }
            .buttonStyle(PlainButtonStyle())

            // Remote Screen Lock Toggle
            Button(action: {
                sessionManager.toggleLock()
            }) {
                VStack(spacing: 3) {
                    Image(systemName: sessionManager.isToddlerLocked ? "lock.fill" : "lock.open.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(sessionManager.isToddlerLocked ? .yellow : .white)
                    Text(sessionManager.isToddlerLocked ? "Locked" : "Lock")
                        .font(.system(size: 10, weight: .bold, design: .rounded))
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(sessionManager.isToddlerLocked ? Color.yellow.opacity(0.3) : Color.gray.opacity(0.3))
                .cornerRadius(12)
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}

// MARK: - Camera & Layout Controls View
public struct WatchCameraControlsView: View {
    @ObservedObject var sessionManager = WatchSessionManager.shared

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Section 1: Capture Mode (Photo / Video)
                VStack(alignment: .leading, spacing: 6) {
                    Text("Capture Mode")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundColor(.secondary)

                    HStack(spacing: 8) {
                        Button(action: {
                            sessionManager.setCaptureMode("Photo")
                        }) {
                            VStack(spacing: 4) {
                                Image(systemName: "camera.fill")
                                    .font(.system(size: 18))
                                    .foregroundColor(.yellow)
                                Text("Photo")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(sessionManager.captureMode == "Photo" ? Color.yellow.opacity(0.35) : Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(sessionManager.captureMode == "Photo" ? Color.yellow : Color.clear, lineWidth: 1.5)
                            )
                        }
                        .buttonStyle(PlainButtonStyle())

                        Button(action: {
                            sessionManager.setCaptureMode("Video")
                        }) {
                            VStack(spacing: 4) {
                                Image(systemName: "video.fill")
                                    .font(.system(size: 18))
                                    .foregroundColor(.red)
                                Text("Video")
                                    .font(.system(size: 10, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(sessionManager.captureMode == "Video" ? Color.red.opacity(0.35) : Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(sessionManager.captureMode == "Video" ? Color.red : Color.clear, lineWidth: 1.5)
                            )
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }

                // Section 2: Camera Swap
                VStack(alignment: .leading, spacing: 6) {
                    Text("Primary Angle")
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundColor(.secondary)

                    Button(action: {
                        sessionManager.swapCameras()
                    }) {
                        HStack {
                            Image(systemName: "arrow.triangle.2.circlepath.camera.fill")
                                .foregroundColor(.cyan)
                            Text("Swap Selfie & Scene")
                                .font(.system(size: 11, weight: .bold, design: .rounded))
                                .foregroundColor(.white)
                            Spacer()
                            Image(systemName: "repeat")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.cyan)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 9)
                        .background(Color.cyan.opacity(0.2))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.cyan.opacity(0.4), lineWidth: 1)
                        )
                    }
                    .buttonStyle(PlainButtonStyle())
                }

                // Dual Camera Live Indicator
                HStack(spacing: 6) {
                    Circle().fill(Color.green).frame(width: 6, height: 6)
                    Text("Simultaneous Front + Rear Active")
                        .font(.system(size: 9, weight: .semibold, design: .rounded))
                        .foregroundColor(.secondary)
                }
                .padding(.top, 2)
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 10)
        }
        .navigationTitle("Camera")
    }
}

private func formatWatchDuration(_ seconds: TimeInterval) -> String {
    let total = Int(seconds)
    let mins = total / 60
    let secs = total % 60
    return String(format: "%02d:%02d", mins, secs)
}

