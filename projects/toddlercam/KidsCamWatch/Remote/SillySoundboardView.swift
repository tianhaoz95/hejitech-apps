import SwiftUI

struct SoundboardItem: Identifiable {
    let id: String
    let name: String
    let emoji: String
    let color: Color
}

public struct SillySoundboardView: View {
    @ObservedObject var sessionManager = WatchSessionManager.shared

    let sounds = [
        SoundboardItem(id: "quack", name: "Quack", emoji: "🦆", color: .yellow),
        SoundboardItem(id: "woof", name: "Puppy", emoji: "🐶", color: .orange),
        SoundboardItem(id: "meow", name: "Kitty", emoji: "🐱", color: .pink),
        SoundboardItem(id: "giggle", name: "Giggle", emoji: "👶", color: .purple),
        SoundboardItem(id: "horn", name: "Honk", emoji: "🎺", color: .red),
        SoundboardItem(id: "boing", name: "Boing", emoji: "🎪", color: .blue)
    ]

    let columns = [
        GridItem(.flexible(), spacing: 8),
        GridItem(.flexible(), spacing: 8)
    ]

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("Attention Grabbers")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(.secondary)

                LazyVGrid(columns: columns, spacing: 8) {
                    ForEach(sounds) { item in
                        Button(action: {
                            sessionManager.playAnimalSound(item.id)
                        }) {
                            VStack(spacing: 4) {
                                Text(item.emoji)
                                    .font(.system(size: 28))
                                Text(item.name)
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundColor(.white)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(item.color.opacity(0.35))
                            .cornerRadius(14)
                            .overlay(RoundedRectangle(cornerRadius: 14).stroke(item.color, lineWidth: 1.5))
                        }
                        .buttonStyle(PlainButtonStyle())
                    }
                }
            }
            .padding(.horizontal, 6)
        }
        .navigationTitle("Sounds")
    }
}
