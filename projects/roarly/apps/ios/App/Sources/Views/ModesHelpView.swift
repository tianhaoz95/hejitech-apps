import RoarlyKit
import SwiftUI

/// The "?" next to Bedtime / Playtime: what each mode does, side by side, with the real volumes
/// (taken from `StoryEngine.volume(for:)`, so this screen can't drift from the engine) and a button
/// to hear the lion at each mode's volume.
struct ModesHelpView: View {
    @EnvironmentObject var model: AppModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            NightSky()
            ScrollView {
                VStack(spacing: 18) {
                    HStack {
                        Spacer()
                        Button { dismiss() } label: {
                            Image(systemName: "xmark").font(.headline).foregroundStyle(Theme.ink)
                                .padding(10).background(Theme.card, in: Circle())
                        }
                        .accessibilityLabel("Close")
                    }
                    Text("Bedtime or Playtime?").font(Theme.title(28)).foregroundStyle(Theme.moon)
                    Text("Same sounds, same listening. The difference is how loud it gets and how bold it is.")
                        .font(Theme.body(15)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)

                    HStack(alignment: .top, spacing: 12) {
                        ModeCard(mode: .bedtime)
                        ModeCard(mode: .play)
                    }

                    StoryCard {
                        HStack(alignment: .top, spacing: 12) {
                            Text("🌙").font(.title2)
                            VStack(alignment: .leading, spacing: 4) {
                                Text("In both modes").font(Theme.label(16)).foregroundStyle(Theme.moon)
                                Text("Say \"good night\" or \"the end\" and the rain, sea and other loops fade away. You can switch modes any time, even mid-story.")
                                    .font(Theme.body(14)).foregroundStyle(Theme.ink)
                            }
                        }
                    }
                }
                .padding(20)
            }
        }
        .preferredColorScheme(.dark)
    }
}

private struct ModeCard: View {
    @EnvironmentObject var model: AppModel
    let mode: StoryMode

    private var engine: StoryEngine { StoryEngine(settings: .init(mode: mode)) }
    private var lion: Cue? { SoundCatalog.cue("lion") }
    private var rain: Cue? { SoundCatalog.cue("rain") }
    private var on: Bool { model.mode == mode }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(mode == .bedtime ? "🌙" : "☀️").font(.system(size: 34))
                Text(mode.title).font(Theme.label(18)).foregroundStyle(Theme.moon)
                Text(mode.tagline).font(Theme.body(13)).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let lion { meter("Big sounds", emoji: "🦁", value: engine.volume(for: lion)) }
            if let rain { meter("Loops", emoji: "🌧️", value: engine.volume(for: rain)) }

            VStack(alignment: .leading, spacing: 4) {
                Text("When it isn't sure").font(Theme.label(13)).foregroundStyle(Theme.moon)
                Text(mode == .bedtime ? "Asks first: a card you tap" : "Plays more on its own")
                    .font(Theme.body(13)).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("Best for").font(Theme.label(13)).foregroundStyle(Theme.moon)
                Text(mode == .bedtime ? "Winding down, sleepy ears" : "Daytime, silly voices, loud fun")
                    .font(Theme.body(13)).foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }

            Button {
                if let lion { AudioHub.shared.preview(lion, volume: engine.volume(for: lion)) }
            } label: {
                Label("Hear it", systemImage: "speaker.wave.2.fill")
                    .font(Theme.label(14)).frame(maxWidth: .infinity).padding(.vertical, 9)
                    .foregroundStyle(Theme.skyDeep).background(Theme.lantern, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Hear the lion at \(mode.title) volume")
            .accessibilityIdentifier("hear-\(mode.rawValue)")

            Button {
                withAnimation(.snappy) { model.mode = mode }
            } label: {
                Text(on ? "Using this" : "Use \(mode.title)")
                    .font(Theme.label(14)).frame(maxWidth: .infinity).padding(.vertical, 9)
                    .foregroundStyle(on ? Theme.ink : Theme.moon)
                    .background(Theme.card, in: Capsule())
                    .overlay(Capsule().stroke(on ? Theme.lantern : Theme.cardStroke))
            }
            .buttonStyle(.plain)
            .disabled(on)
            .accessibilityIdentifier("use-\(mode.rawValue)")
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(on ? Theme.lantern.opacity(0.10) : Theme.card, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).stroke(on ? Theme.lantern : Theme.cardStroke))
    }

    private func meter(_ title: String, emoji: String, value: Double) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                Text(emoji)
                Text(title).font(Theme.label(13)).foregroundStyle(Theme.moon)
                Spacer()
                Text("\(Int((value * 100).rounded()))%").font(Theme.label(12)).foregroundStyle(Theme.ink)
            }
            GeometryReader { g in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.card)
                    Capsule().fill(Theme.lantern).frame(width: g.size.width * value)
                }
            }
            .frame(height: 8)
            .accessibilityElement()
            .accessibilityLabel("\(title) volume \(Int((value * 100).rounded())) percent")
        }
    }
}

extension StoryMode {
    /// One line for under the picker and the help cards.
    var tagline: String {
        self == .bedtime ? "Soft sounds; asks before surprises" : "Full volume; plays more on its own"
    }
}
