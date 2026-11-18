import SwiftUI

struct OnboardingView: View {
    @EnvironmentObject var model: AppModel
    @State private var page = 0

    var body: some View {
        ZStack {
            NightSky()
            VStack(spacing: 0) {
                TabView(selection: $page) {
                    pageView(emoji: "🦁", title: "Stories that roar back", text: "Tell any story out loud: one you know, one you're making up. When the lion roars, Roarly roars. When it starts to rain, the rain begins.").tag(0)
                    pageView(emoji: "🐯", title: "It follows the story", text: "\"A tiger is chasing you!\" gets a growl. \"The tiger ran away\" doesn't. When Roarly isn't sure, it shows the sound and you tap it, right on time.").tag(1)
                    pageView(emoji: "🌙", title: "Made for bedtime", text: "Bedtime mode keeps big sounds soft and waits for your tap when it isn't sure. Say \"good night\" or \"the end\" and the rain and other loops fade out. Roarly listens only while the lantern is lit, and nothing you say leaves your iPhone.").tag(2)
                }
                .tabViewStyle(.page(indexDisplayMode: .always))

                Button(page < 2 ? "Next" : "Let's begin") {
                    if page < 2 {
                        withAnimation { page += 1 }
                    } else {
                        Task {
                            _ = await SpeechListener.requestPermissions()
                            model.onboarded = true
                        }
                    }
                }
                .buttonStyle(LanternButtonStyle())
                .padding(.horizontal, 28)
                .padding(.bottom, 30)
                .accessibilityIdentifier("onboarding-next")
            }
        }
    }

    private func pageView(emoji: String, title: String, text: String) -> some View {
        VStack(spacing: 22) {
            Spacer()
            Text(emoji).font(.system(size: 110))
            Text(title).font(Theme.title(30)).foregroundStyle(Theme.moon).multilineTextAlignment(.center)
            Text(text).font(Theme.body(18)).foregroundStyle(Theme.ink).multilineTextAlignment(.center).padding(.horizontal, 28)
            Spacer()
            Spacer()
        }
    }
}
