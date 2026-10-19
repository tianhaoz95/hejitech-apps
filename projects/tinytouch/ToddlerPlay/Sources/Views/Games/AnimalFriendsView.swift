import SwiftUI

struct AnimalFriend: Identifiable {
    let id = UUID()
    let name: String
    let emoji: String
    let soundEffect: String
    let spokenPhrase: String
    let color: Color
}

struct AnimalFriendsView: View {
    @EnvironmentObject var appState: AppState
    
    private let animals: [AnimalFriend] = [
        AnimalFriend(name: "Puppy", emoji: "🐶", soundEffect: "woof", spokenPhrase: "Puppy! Woof woof!", color: Color(red: 1.0, green: 0.65, blue: 0.2)),
        AnimalFriend(name: "Kitty", emoji: "🐱", soundEffect: "meow", spokenPhrase: "Kitty! Meow!", color: Color(red: 1.0, green: 0.5, blue: 0.7)),
        AnimalFriend(name: "Duck", emoji: "🦆", soundEffect: "quack", spokenPhrase: "Duck! Quack quack!", color: Color(red: 1.0, green: 0.85, blue: 0.2)),
        AnimalFriend(name: "Cow", emoji: "🐮", soundEffect: "moo", spokenPhrase: "Cow! Moo!", color: Color(red: 0.4, green: 0.8, blue: 0.95)),
        AnimalFriend(name: "Frog", emoji: "🐸", soundEffect: "ribbit", spokenPhrase: "Frog! Ribbit ribbit!", color: Color(red: 0.4, green: 0.9, blue: 0.5)),
        AnimalFriend(name: "Bunny", emoji: "🐰", soundEffect: "boing", spokenPhrase: "Bunny! Hop hop!", color: Color(red: 0.85, green: 0.6, blue: 1.0))
    ]
    
    @State private var selectedIndex: Int = 0
    @State private var bounceScale: CGFloat = 1.0
    @State private var bounceAngle: Double = 0.0
    @State private var floatingHearts: [CGPoint] = []
    @State private var isPeekabooBoxClosed: Bool = false
    @State private var crownValue: Double = 0.0
    
    var body: some View {
        GeometryReader { geo in
            let animal = animals[selectedIndex]
            
            ZStack {
                Color.black.ignoresSafeArea()
                
                // Subtle warm background halo
                RadialGradient(
                    colors: [animal.color.opacity(0.35), Color.clear],
                    center: .center,
                    startRadius: 20,
                    endRadius: 140
                )
                .ignoresSafeArea()
                
                VStack(spacing: 8) {
                    Spacer(minLength: 28)
                    
                    // Main Animal Stage
                    ZStack {
                        // Soft glowing podium circle
                        Circle()
                            .fill(animal.color.opacity(0.25))
                            .frame(width: 140, height: 140)
                        
                        Circle()
                            .strokeBorder(animal.color.opacity(0.7), lineWidth: 3)
                            .frame(width: 140, height: 140)
                        
                        // Animal Character
                        Text(animal.emoji)
                            .font(.system(size: 78))
                            .scaleEffect(bounceScale)
                            .rotationEffect(.degrees(bounceAngle))
                            .animation(.spring(response: 0.35, dampingFraction: 0.45), value: bounceScale)
                            .animation(.spring(response: 0.35, dampingFraction: 0.45), value: bounceAngle)
                        
                        // Floating hearts / notes on tap
                        ForEach(floatingHearts.indices, id: \.self) { idx in
                            let pt = floatingHearts[idx]
                            Text("💖")
                                .font(.system(size: 20))
                                .position(pt)
                                .transition(.opacity.combined(with: .scale))
                        }
                    }
                    .frame(width: 140, height: 140)
                    .contentShape(Circle())
                    .onTapGesture {
                        animateAnimal(animal, in: geo.size)
                    }
                    
                    // Name label with speech cue
                    Text(animal.name)
                        .font(.system(size: 16, weight: .heavy, design: .rounded))
                        .foregroundColor(animal.color)
                    
                    // Animal Selector Mini Carousel
                    HStack(spacing: 8) {
                        ForEach(animals.indices, id: \.self) { idx in
                            Button(action: {
                                selectAnimal(index: idx)
                            }) {
                                Text(animals[idx].emoji)
                                    .font(.system(size: idx == selectedIndex ? 18 : 12))
                                    .padding(4)
                                    .background(
                                        Circle()
                                            .fill(idx == selectedIndex ? animal.color.opacity(0.4) : Color.white.opacity(0.1))
                                    )
                                    .scaleEffect(idx == selectedIndex ? 1.15 : 0.9)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    
                    Spacer(minLength: 6)
                }
            }
            .contentShape(Rectangle())
            .focusable()
            .digitalCrownRotation(
                $crownValue,
                from: 0.0,
                through: Double(animals.count - 1),
                by: 1.0,
                sensitivity: .medium,
                isContinuous: true,
                isHapticFeedbackEnabled: true
            )
            .onChange(of: crownValue) { _, newVal in
                let newIndex = Int(newVal.rounded()) % animals.count
                if newIndex != selectedIndex {
                    selectAnimal(index: max(0, newIndex))
                }
            }
        }
    }
    
    private func selectAnimal(index: Int) {
        selectedIndex = index
        HapticsManager.shared.playCrownTick()
        let animal = animals[index]
        SoundManager.shared.playAnimalSound(animal.soundEffect)
    }
    
    private func animateAnimal(_ animal: AnimalFriend, in size: CGSize) {
        appState.registerTouch()
        HapticsManager.shared.playBounce()
        SoundManager.shared.playAnimalSound(animal.soundEffect)
        
        if appState.voiceEnabled {
            SoundManager.shared.speak(animal.spokenPhrase)
        }
        
        // Bouncy spring animation
        bounceScale = 1.3
        bounceAngle = Double.random(in: -15...15)
        
        // Spawn heart
        let heartPos = CGPoint(x: 70 + CGFloat.random(in: -30...30), y: 30)
        floatingHearts.append(heartPos)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            bounceScale = 1.0
            bounceAngle = 0.0
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            if !floatingHearts.isEmpty {
                floatingHearts.removeFirst()
            }
        }
    }
}
