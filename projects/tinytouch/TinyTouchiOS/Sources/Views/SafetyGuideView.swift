import SwiftUI

/// Detailed guide for parents on how to secure their Apple Watch from toddler mis-taps,
/// accidental emergency calls (SOS), and screen switches.
struct SafetyGuideView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header card
                VStack(alignment: .leading, spacing: 10) {
                    Label("Parent Safety Blueprint", systemImage: "shield.lefthalf.filled")
                        .font(.title2.weight(.bold))
                        .foregroundColor(.blue)
                    
                    Text("Toddlers love grabbing watches. TinyTouch combined with watchOS features creates a virtually unbreakable toddler-safe sandbox.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(uiColor: .secondarySystemBackground))
                .cornerRadius(16)
                
                // Section 1: Emergency SOS
                GuideCard(
                    stepNumber: "1",
                    iconName: "phone.down.waves.and.radiowaves",
                    iconColor: .red,
                    title: "Prevent Accidental 911 / SOS Dials",
                    subtitle: "Crucial for toddlers who press and hold the side button.",
                    steps: [
                        "Open the Watch app on your iPhone.",
                        "Scroll down and tap Emergency SOS.",
                        "Turn OFF 'Hold Side Button to Dial'.",
                        "Now, long-pressing the side button will show sliders rather than automatically dialing emergency services."
                    ]
                )
                
                // Section 2: Water Lock
                GuideCard(
                    stepNumber: "2",
                    iconName: "drop.fill",
                    iconColor: .cyan,
                    title: "Hardware Touchscreen Lock (Water Lock)",
                    subtitle: "Completely freezes touch inputs on your watch.",
                    steps: [
                        "Launch TinyTouch on your Apple Watch.",
                        "Swipe up (or press side button on watchOS 10+) to open Control Center.",
                        "Tap the Water Droplet icon to activate Water Lock.",
                        "The screen will now ignore all toddler finger taps and swipes.",
                        "To exit, press and hold the Digital Crown for 2 seconds."
                    ]
                )
                
                // Section 3: Parent Shield
                GuideCard(
                    stepNumber: "3",
                    iconName: "lock.shield.fill",
                    iconColor: .green,
                    title: "In-App 3-Second Parent Shield",
                    subtitle: "Prevents toddlers from changing games or accessing settings.",
                    steps: [
                        "Look at the lock icon at the top-left corner of the watch screen.",
                        "To unlock the Parent Dashboard, press and hold the lock icon for 3 full seconds.",
                        "A progress ring will fill with ticking haptic feedback.",
                        "Releasing early instantly resets the lock, keeping toddlers out."
                    ]
                )
                
                // Section 4: Screen Keep-Alive
                GuideCard(
                    stepNumber: "4",
                    iconName: "sun.max.fill",
                    iconColor: .orange,
                    title: "Always-On Play Session",
                    subtitle: "Keeps the game active while the toddler is playing.",
                    steps: [
                        "TinyTouch starts a local Extended Runtime Session.",
                        "The screen stays active and responds to gentle taps without dimming or going back to the watch face.",
                        "When play time is done, exit the app or take off the watch."
                    ]
                )
            }
            .padding()
        }
        .navigationTitle("Safety & Lock Guide")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct GuideCard: View {
    let stepNumber: String
    let iconName: String
    let iconColor: Color
    let title: String
    let subtitle: String
    let steps: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(iconColor.opacity(0.15))
                        .frame(width: 44, height: 44)
                    Image(systemName: iconName)
                        .font(.title3.weight(.semibold))
                        .foregroundColor(iconColor)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                        .foregroundColor(.primary)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Divider()
            
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Array(steps.enumerated()), id: \.offset) { index, step in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(index + 1).")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(iconColor)
                            .frame(width: 20, alignment: .leading)
                        
                        Text(step)
                            .font(.subheadline)
                            .foregroundColor(.primary)
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .secondarySystemBackground))
        .cornerRadius(16)
    }
}
