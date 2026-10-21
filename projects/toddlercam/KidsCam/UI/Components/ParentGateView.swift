import SwiftUI

/// The grown-ups-only question: a times-table product typed on a keypad. A toddler tapping at
/// random rarely gets a two-digit number right (about 1 in 100 tries, against 1 in 3 for the old
/// three big answer buttons), and `ParentGateAttempts` pauses the gate after a few wrong answers.
struct ParentGateChallenge: Equatable {
    let a: Int
    let b: Int

    var answer: Int { a * b }
    var question: String { "\(a) × \(b) = ?" }
    /// What VoiceOver reads, so the gate stays usable without sight.
    var spokenQuestion: String { "What is \(a) times \(b)?" }
    /// Both factors 4…9: the answer is 16…81, always two digits (1 in 90 for a random guess).
    static let factors = 4...9

    static func random<G: RandomNumberGenerator>(using generator: inout G) -> ParentGateChallenge {
        ParentGateChallenge(a: Int.random(in: factors, using: &generator), b: Int.random(in: factors, using: &generator))
    }

    static func random() -> ParentGateChallenge {
        var g = SystemRandomNumberGenerator()
        return random(using: &g)
    }

    /// Entries are checked once they have as many digits as the answer.
    var answerLength: Int { String(answer).count }

    func isCorrect(_ entry: String) -> Bool { Int(entry) == answer }
}

/// Wrong answers in a row; after `maxFailures` the gate closes for `cooldown` seconds, twice as
/// long after each further lockout (up to `maxCooldown`) until someone gets it right.
struct ParentGateAttempts: Equatable {
    static let maxFailures = 3
    static let cooldown: TimeInterval = 30
    static let maxCooldown: TimeInterval = 300

    private(set) var failures = 0
    private(set) var lockouts = 0
    private(set) var lockedUntil: Date?

    func isLocked(now: Date = Date()) -> Bool { lockedUntil.map { now < $0 } ?? false }

    func secondsLeft(now: Date = Date()) -> Int {
        guard let until = lockedUntil, now < until else { return 0 }
        return Int(until.timeIntervalSince(now).rounded(.up))
    }

    mutating func recordFailure(now: Date = Date()) {
        failures += 1
        if failures >= Self.maxFailures {
            let pause = min(Self.cooldown * pow(2, Double(lockouts)), Self.maxCooldown)
            lockedUntil = now.addingTimeInterval(pause)
            lockouts += 1
            failures = 0
        }
    }

    mutating func recordSuccess() {
        failures = 0
        lockouts = 0
        lockedUntil = nil
    }
}

public struct ParentGateView: View {
    @Binding var isUnlocked: Bool
    let onUnlocked: () -> Void
    let onCancel: () -> Void

    @State private var challenge = ParentGateChallenge.random()
    @State private var entry = ""
    @State private var isError = false
    // Kept across openings: closing and reopening the gate doesn't reset a lockout.
    @AppStorage("parentGateLockedUntil") private var storedLockedUntil: Double = 0
    @State private var attempts = ParentGateAttempts()

    private let keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"]

    public init(isUnlocked: Binding<Bool>, onUnlocked: @escaping () -> Void, onCancel: @escaping () -> Void) {
        self._isUnlocked = isUnlocked
        self.onUnlocked = onUnlocked
        self.onCancel = onCancel
    }

    public var body: some View {
        ZStack {
            Color.black.opacity(0.85)
                .edgesIgnoringSafeArea(.all)

            TimelineView(.periodic(from: .now, by: 1)) { context in
                let locked = isLocked(at: context.date)
                VStack(spacing: 18) {
                    Image(systemName: "lock.shield.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.yellow)
                        .accessibilityHidden(true)

                    Text("Grown-Ups Only")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(.white)

                    if locked {
                        Text("Too many tries. Try again in \(secondsLeft(at: context.date)) s.")
                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                            .foregroundColor(.pink)
                            .multilineTextAlignment(.center)
                            .frame(minHeight: 120)
                            .accessibilityIdentifier("parentGateLocked")
                    } else {
                        Text("Type the answer to continue:")
                            .font(.system(size: 16, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.8))

                        Text(challenge.question)
                            .font(.system(size: 38, weight: .heavy, design: .rounded))
                            .foregroundColor(.orange)
                            .accessibilityLabel(challenge.spokenQuestion)

                        entryField
                    }

                    keypad(disabled: locked)

                    Text(isError && !locked ? "Not quite, try again!" : " ")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                        .foregroundColor(.pink)
                        .accessibilityHidden(!isError)

                    Button(action: onCancel) {
                        Text("Cancel")
                            .font(.system(size: 16, weight: .medium, design: .rounded))
                            .foregroundColor(.white.opacity(0.7))
                    }
                    .accessibilityIdentifier("parentGateCancel")
                }
                .padding(28)
                .background(Color(red: 0.12, green: 0.15, blue: 0.22))
                .cornerRadius(28)
                .shadow(radius: 20)
                .padding(.horizontal, 24)
            }
        }
        .onAppear {
            if storedLockedUntil > Date().timeIntervalSince1970 {
                attempts = ParentGateAttempts.restoring(lockedUntil: Date(timeIntervalSince1970: storedLockedUntil))
            }
        }
    }

    private var entryField: some View {
        HStack(spacing: 10) {
            ForEach(0..<challenge.answerLength, id: \.self) { i in
                let chars = Array(entry)
                Text(i < chars.count ? String(chars[i]) : " ")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundColor(.white)
                    .frame(width: 48, height: 56)
                    .background(Color.white.opacity(0.12))
                    .cornerRadius(12)
                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(i == chars.count ? Color.orange : .clear, lineWidth: 2))
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(entry.isEmpty ? "Answer, empty" : "Answer, \(entry)")
    }

    private func keypad(disabled: Bool) -> some View {
        LazyVGrid(columns: Array(repeating: GridItem(.fixed(72), spacing: 12), count: 3), spacing: 10) {
            ForEach(keys.indices, id: \.self) { i in
                let key = keys[i]
                if key.isEmpty {
                    Color.clear.frame(height: 52)
                } else {
                    Button { press(key) } label: {
                        Text(key)
                            .font(.system(size: 26, weight: .bold, design: .rounded))
                            .frame(width: 72, height: 52)
                            .background(Color.white.opacity(disabled ? 0.06 : 0.18))
                            .foregroundColor(.white.opacity(disabled ? 0.3 : 1))
                            .cornerRadius(14)
                    }
                    .disabled(disabled)
                    .accessibilityLabel(key == "⌫" ? "Delete" : key)
                    .accessibilityIdentifier("parentGateKey\(key == "⌫" ? "Delete" : key)")
                }
            }
        }
    }

    private func isLocked(at date: Date) -> Bool { attempts.isLocked(now: date) }
    private func secondsLeft(at date: Date) -> Int { attempts.secondsLeft(now: date) }

    private func press(_ key: String) {
        guard !attempts.isLocked() else { return }
        if key == "⌫" {
            if !entry.isEmpty { entry.removeLast() }
            return
        }
        isError = false
        entry.append(key)
        guard entry.count >= challenge.answerLength else { return }
        if challenge.isCorrect(entry) {
            attempts.recordSuccess()
            storedLockedUntil = 0
            SoundEffectManager.shared.play(.pop)
            isUnlocked = true
            onUnlocked()
        } else {
            SoundEffectManager.shared.play(.boing)
            attempts.recordFailure()
            storedLockedUntil = attempts.lockedUntil?.timeIntervalSince1970 ?? 0
            isError = true
            entry = ""
            challenge = ParentGateChallenge.random()
        }
    }
}

extension ParentGateAttempts {
    /// A lockout carried over from an earlier opening of the gate, never longer than `maxCooldown`
    /// from now (a stored date far ahead, e.g. after a clock change, must not shut the gate for good).
    static func restoring(lockedUntil: Date, now: Date = Date()) -> ParentGateAttempts {
        var a = ParentGateAttempts()
        a.lockedUntil = min(lockedUntil, now.addingTimeInterval(maxCooldown))
        return a
    }
}
