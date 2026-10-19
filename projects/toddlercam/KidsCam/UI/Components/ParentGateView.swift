import SwiftUI

public struct ParentGateView: View {
    @Binding var isUnlocked: Bool
    let onUnlocked: () -> Void
    let onCancel: () -> Void

    @State private var num1: Int = Int.random(in: 2...5)
    @State private var num2: Int = Int.random(in: 2...4)
    @State private var options: [Int] = []
    @State private var isError: Bool = false

    public init(isUnlocked: Binding<Bool>, onUnlocked: @escaping () -> Void, onCancel: @escaping () -> Void) {
        self._isUnlocked = isUnlocked
        self.onUnlocked = onUnlocked
        self.onCancel = onCancel
    }

    public var body: some View {
        ZStack {
            Color.black.opacity(0.85)
                .edgesIgnoringSafeArea(.all)

            VStack(spacing: 24) {
                // Lock Icon
                Image(systemName: "lock.shield.fill")
                    .font(.system(size: 56))
                    .foregroundColor(.yellow)

                Text("Grown-Ups Only")
                    .font(.system(size: 26, weight: .bold, design: .rounded))
                    .foregroundColor(.white)

                Text("Please ask a parent to answer:")
                    .font(.system(size: 16, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.8))

                Text("\(num1) + \(num2) = ?")
                    .font(.system(size: 38, weight: .heavy, design: .rounded))
                    .foregroundColor(.orange)
                    .padding(.vertical, 8)

                // Options
                HStack(spacing: 16) {
                    ForEach(options, id: \.self) { opt in
                        Button(action: {
                            checkAnswer(opt)
                        }) {
                            Text("\(opt)")
                                .font(.system(size: 28, weight: .bold, design: .rounded))
                                .frame(width: 70, height: 70)
                                .background(Color.white.opacity(0.2))
                                .foregroundColor(.white)
                                .cornerRadius(16)
                        }
                    }
                }

                if isError {
                    Text("Oops, try again!")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundColor(.pink)
                }

                Button(action: {
                    onCancel()
                }) {
                    Text("Cancel")
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.7))
                        .padding(.top, 10)
                }
            }
            .padding(32)
            .background(Color(red: 0.12, green: 0.15, blue: 0.22))
            .cornerRadius(28)
            .shadow(radius: 20)
            .padding(.horizontal, 30)
            .onAppear {
                generateOptions()
            }
        }
    }

    private func generateOptions() {
        let answer = num1 + num2
        var opts = Set<Int>([answer])
        while opts.count < 3 {
            let offset = Int.random(in: -3...3)
            let fake = answer + offset
            if fake > 0 && fake != answer {
                opts.insert(fake)
            }
        }
        self.options = opts.shuffled()
    }

    private func checkAnswer(_ choice: Int) {
        if choice == (num1 + num2) {
            SoundEffectManager.shared.play(.pop)
            isUnlocked = true
            onUnlocked()
        } else {
            SoundEffectManager.shared.play(.boing)
            isError = true
            num1 = Int.random(in: 2...5)
            num2 = Int.random(in: 2...4)
            generateOptions()
        }
    }
}
