import SwiftUI

/// Sensory game previewer allowing parents to test the sounds and animations
/// of all 5 activities right on their iPhone.
struct GamePreviewView: View {
    @StateObject private var soundManager = IOSSoundManager.shared
    @State private var selectedActivity = 0
    
    // Bubble pop interactive state
    @State private var bubbles: [BubbleItem] = []
    
    // Sparkle interactive state
    @State private var sparkles: [SparkleItem] = []
    
    let activities = [
        ("Bubble Pop", "circle.hexagongrid.circle", Color.pink),
        ("Animal Friends", "pawprint.fill", Color.orange),
        ("Sound Garden", "music.note", Color.purple),
        ("Magic Sparkles", "sparkles", Color.cyan),
        ("Sleepy Moon", "moon.stars.fill", Color.indigo)
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            // Activity picker tabs
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(0..<activities.count, id: \.self) { idx in
                        let item = activities[idx]
                        Button(action: {
                            selectedActivity = idx
                            IOSHapticsManager.shared.playTap()
                        }) {
                            HStack(spacing: 6) {
                                Image(systemName: item.1)
                                Text(item.0)
                            }
                            .font(.subheadline.weight(.medium))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(selectedActivity == idx ? item.2 : Color(uiColor: .secondarySystemBackground))
                            .foregroundColor(selectedActivity == idx ? .white : .primary)
                            .cornerRadius(20)
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 10)
            }
            .background(Color(uiColor: .systemBackground))
            
            Divider()
            
            // Interactive sandbox canvas
            ZStack {
                Color.black.edgesIgnoringSafeArea(.bottom)
                
                switch selectedActivity {
                case 0:
                    bubbleSandbox
                case 1:
                    animalSandbox
                case 2:
                    soundGardenSandbox
                case 3:
                    sparkleSandbox
                case 4:
                    sleepyMoonSandbox
                default:
                    EmptyView()
                }
            }
        }
        .navigationTitle("Interactive Preview")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            spawnInitialBubbles()
        }
    }
    
    // MARK: - Activity 1: Bubble Pop
    private var bubbleSandbox: some View {
        ZStack {
            ForEach(bubbles) { bubble in
                Circle()
                    .fill(
                        RadialGradient(
                            gradient: Gradient(colors: [bubble.color.opacity(0.8), bubble.color.opacity(0.3)]),
                            center: .topLeading,
                            startRadius: 5,
                            endRadius: bubble.size / 2
                        )
                    )
                    .overlay(
                        Circle()
                            .stroke(Color.white.opacity(0.6), lineWidth: 2)
                    )
                    .frame(width: bubble.size, height: bubble.size)
                    .position(bubble.position)
                    .onTapGesture {
                        popBubble(bubble)
                    }
            }
            
            VStack {
                Spacer()
                Text("Tap bubbles to pop them!")
                    .font(.footnote)
                    .foregroundColor(.white.opacity(0.7))
                    .padding(8)
                    .background(Color.black.opacity(0.5))
                    .cornerRadius(12)
                    .padding(.bottom, 20)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { location in
            addBubble(at: location)
        }
    }
    
    private func spawnInitialBubbles() {
        bubbles = (0..<8).map { i in
            BubbleItem(
                id: UUID(),
                position: CGPoint(x: CGFloat.random(in: 60...320), y: CGFloat.random(in: 100...400)),
                size: CGFloat.random(in: 65...100),
                color: [.pink, .purple, .cyan, .yellow, .green][i % 5]
            )
        }
    }
    
    private func popBubble(_ bubble: BubbleItem) {
        IOSHapticsManager.shared.playPop()
        let sound = ["pop_high", "pop_mid", "pop_low"].randomElement() ?? "pop_mid"
        soundManager.playSound(sound)
        withAnimation(.easeOut(duration: 0.2)) {
            bubbles.removeAll { $0.id == bubble.id }
        }
        // Respawn after short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            withAnimation(.spring()) {
                bubbles.append(
                    BubbleItem(
                        id: UUID(),
                        position: CGPoint(x: CGFloat.random(in: 60...320), y: CGFloat.random(in: 100...400)),
                        size: CGFloat.random(in: 65...100),
                        color: [.pink, .purple, .cyan, .yellow, .green].randomElement() ?? .pink
                    )
                )
            }
        }
    }
    
    private func addBubble(at location: CGPoint) {
        IOSHapticsManager.shared.playPop()
        soundManager.playSound("pop_high")
        withAnimation(.spring()) {
            bubbles.append(
                BubbleItem(
                    id: UUID(),
                    position: location,
                    size: CGFloat.random(in: 70...100),
                    color: [.pink, .purple, .cyan, .yellow, .green].randomElement() ?? .cyan
                )
            )
        }
    }
    
    // MARK: - Activity 2: Animal Friends
    private var animalSandbox: some View {
        let animals = [
            ("Puppy", "🐶", "animal_puppy", Color.yellow),
            ("Kitten", "🐱", "animal_kitten", Color.orange),
            ("Duckling", "🦆", "animal_duck", Color.green),
            ("Froggy", "🐸", "animal_frog", Color.mint),
            ("Bear", "🐻", "animal_bear", Color.brown)
        ]
        
        return VStack(spacing: 24) {
            Text("Friendly sensory animals")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.8))
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 20) {
                ForEach(animals, id: \.0) { item in
                    Button(action: {
                        IOSHapticsManager.shared.playTap()
                        soundManager.playSound(item.2)
                    }) {
                        VStack(spacing: 8) {
                            Text(item.1)
                                .font(.system(size: 60))
                            Text(item.0)
                                .font(.headline)
                                .foregroundColor(.white)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .background(item.3.opacity(0.3))
                        .overlay(
                            RoundedRectangle(cornerRadius: 20)
                                .stroke(item.3, lineWidth: 2)
                        )
                        .cornerRadius(20)
                    }
                }
            }
            .padding(.horizontal, 24)
            
            Spacer()
        }
        .padding(.top, 30)
    }
    
    // MARK: - Activity 3: Sound Garden (Pentatonic)
    private var soundGardenSandbox: some View {
        let chimes = [
            ("Do", "chime_do", Color.red),
            ("Re", "chime_re", Color.orange),
            ("Mi", "chime_mi", Color.yellow),
            ("Sol", "chime_sol", Color.green),
            ("La", "chime_la", Color.blue)
        ]
        
        return VStack(spacing: 20) {
            Text("Harmonious Pentatonic Chimes")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.8))
            
            VStack(spacing: 14) {
                ForEach(chimes, id: \.0) { chime in
                    Button(action: {
                        IOSHapticsManager.shared.playTap()
                        soundManager.playSound(chime.1)
                    }) {
                        HStack {
                            Circle()
                                .fill(chime.2)
                                .frame(width: 32, height: 32)
                            Text(chime.0)
                                .font(.title3.weight(.bold))
                                .foregroundColor(.white)
                            Spacer()
                            Image(systemName: "speaker.wave.2.fill")
                                .foregroundColor(chime.2)
                        }
                        .padding()
                        .background(chime.2.opacity(0.25))
                        .cornerRadius(16)
                    }
                }
            }
            .padding(.horizontal, 24)
            
            Spacer()
        }
        .padding(.top, 30)
    }
    
    // MARK: - Activity 4: Magic Sparkles
    private var sparkleSandbox: some View {
        ZStack {
            ForEach(sparkles) { sparkle in
                Circle()
                    .fill(sparkle.color)
                    .frame(width: sparkle.size, height: sparkle.size)
                    .position(sparkle.position)
                    .opacity(sparkle.opacity)
            }
            
            VStack {
                Spacer()
                Text("Drag or tap anywhere to create sparkling star trails")
                    .font(.footnote)
                    .foregroundColor(.white.opacity(0.7))
                    .padding(8)
                    .background(Color.black.opacity(0.5))
                    .cornerRadius(12)
                    .padding(.bottom, 20)
            }
        }
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    addSparkle(at: value.location)
                }
        )
    }
    
    private func addSparkle(at location: CGPoint) {
        IOSHapticsManager.shared.playTap()
        soundManager.playSound("sparkle_high")
        
        let newSparkle = SparkleItem(
            id: UUID(),
            position: location,
            size: CGFloat.random(in: 12...28),
            color: [.yellow, .cyan, .white, .purple].randomElement() ?? .yellow,
            opacity: 1.0
        )
        sparkles.append(newSparkle)
        
        if sparkles.count > 25 {
            sparkles.removeFirst()
        }
    }
    
    // MARK: - Activity 5: Sleepy Moon
    private var sleepyMoonSandbox: some View {
        VStack(spacing: 30) {
            Spacer()
            
            ZStack {
                Circle()
                    .fill(Color.yellow.opacity(0.15))
                    .frame(width: 140, height: 140)
                
                Image(systemName: "moon.stars.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.yellow)
            }
            
            Text("Gentle Bedtime Lullaby")
                .font(.title3.weight(.semibold))
                .foregroundColor(.white)
            
            Text("Calming, low-stimulation visuals and soft wind chimes to help wind down before naptime.")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            
            Button(action: {
                IOSHapticsManager.shared.playTap()
                soundManager.playSound("lullaby_gentle")
            }) {
                HStack(spacing: 10) {
                    Image(systemName: "play.circle.fill")
                        .font(.title2)
                    Text("Play Soothing Lullaby")
                        .font(.headline)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .background(Color.indigo)
                .cornerRadius(24)
            }
            
            Spacer()
        }
    }
}

struct BubbleItem: Identifiable {
    let id: UUID
    var position: CGPoint
    var size: CGFloat
    var color: Color
}

struct SparkleItem: Identifiable {
    let id: UUID
    var position: CGPoint
    var size: CGFloat
    var color: Color
    var opacity: Double
}
