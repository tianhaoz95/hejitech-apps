import SwiftUI

/// Safe holding and hardware lock guide for parents
struct ParentGuideView: View {
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Image(systemName: "hand.raised.fill")
                        .foregroundColor(.blue)
                        .font(.title3)
                    Text("Safety & Lock Guide")
                        .font(.headline)
                }
                .padding(.top, 4)
                
                // Tip 1: Physical Buttons & Apple Restrictions
                VStack(alignment: .leading, spacing: 4) {
                    Label("Can Buttons Be Locked?", systemImage: "button.programmable")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.pink)
                    Text("Apple does not allow any third-party app to disable the physical click of the Digital Crown or Side Button for safety reasons (to prevent trapping users and ensure emergency call access). However, you can completely protect against accidental calls using the steps below!")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                
                // Tip 2: Prevent Accidental Emergency 911 Calls
                VStack(alignment: .leading, spacing: 4) {
                    Label("Prevent 911 Auto-Dial", systemImage: "sos.circle.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.red)
                    Text("When toddlers squeeze the watch, they can trigger emergency SOS. To stop auto-dialing:\n• Go to Watch Settings → SOS\n• Turn OFF 'Hold Side Button to Dial'.\nNow holding the button will NEVER dial emergency services automatically.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                
                // Tip 3: The Crown Orientation Trick
                VStack(alignment: .leading, spacing: 4) {
                    Label("Crown Flip Trick", systemImage: "arrow.triangle.2.circlepath")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.orange)
                    Text("In Watch Settings → General → Orientation, switch the Digital Crown to face toward your elbow instead of your hand. When holding a toddler, the child's fingers reach towards your wrist and cannot reach or squeeze the buttons!")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                
                // Tip 4: Keep App Active on Return
                VStack(alignment: .leading, spacing: 4) {
                    Label("Return to App: 1 Hour", systemImage: "clock.arrow.circlepath")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.yellow)
                    Text("In Watch Settings → General → Return to Clock, set 'After 1 hour'. If the toddler clicks the Crown, the watch will immediately return to TinyTouch when woken back up.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                
                // Tip 5: Screen Containment
                VStack(alignment: .leading, spacing: 4) {
                    Label("Screen Lockout", systemImage: "lock.shield.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.green)
                    Text("While TinyTouch is open, all screen touches are absorbed. Accidental phone calls, notification swipes, and watch face complications cannot be triggered by the toddler.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                
                // Tip 6: Digital Crown Taming
                VStack(alignment: .leading, spacing: 4) {
                    Label("Crown Rotation Tamed", systemImage: "circle.circle")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.cyan)
                    Text("Turning the Crown won't scroll out or open Smart Stack. Instead, TinyTouch routes rotation into musical chimes, bubble inflation, and kaleidoscope effects.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                
                // Tip 7: Total Touch Freeze (Water Lock)
                VStack(alignment: .leading, spacing: 4) {
                    Label("Water Lock Mode", systemImage: "drop.fill")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.blue)
                    Text("If you want the child to watch animations or listen to lullabies with ZERO touch input, press the Side Button and tap the Water Drop icon. Apple Watch will ignore all screen touches until you press and hold the Crown.")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.08)))
                
                Button(action: {
                    dismiss()
                }) {
                    Text("Got It")
                        .font(.system(size: 12, weight: .bold))
                        .frame(maxWidth: .infinity)
                }
                .padding(.top, 6)
            }
            .padding(.horizontal, 6)
        }
    }
}
