import SwiftUI
import G2DigestKit

public struct BriefSheet: View {
    @ObservedObject var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    public init(appModel: AppModel) {
        self.appModel = appModel
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                if let brief = appModel.userBrief {
                    VStack(alignment: .leading, spacing: 20) {
                        // Overview Card
                        VStack(alignment: .leading, spacing: 10) {
                            Text(brief.title)
                                .font(.title2.bold())

                            HStack(spacing: 16) {
                                Label("\(brief.totalCardBudget) cards", systemImage: "rectangle.stack")
                                Label("\(brief.totalAudioBudgetSec / 60)m audio", systemImage: "clock")
                                Label(brief.language.uppercased(), systemImage: "globe")
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                        // Delivery Schedule
                        VStack(alignment: .leading, spacing: 8) {
                            Text("DELIVERY SCHEDULE")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)

                            HStack {
                                Image(systemName: "alarm")
                                Text("\(brief.delivery.time) (\(brief.delivery.timezone))")
                                Spacer()
                                Text(brief.delivery.days.map { $0.rawValue.uppercased() }.joined(separator: ", "))
                                    .font(.caption.bold())
                                    .foregroundStyle(Color.accentColor)
                            }
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }

                        // Sections
                        VStack(alignment: .leading, spacing: 12) {
                            Text("SECTIONS (\(brief.sections.count))")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)

                            ForEach(brief.sections) { sec in
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack {
                                        Text(sec.title)
                                            .font(.headline)
                                        Spacer()
                                        Text(sec.template.rawValue.uppercased())
                                            .font(.caption2.bold())
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 3)
                                            .background(Color.accentColor.opacity(0.15))
                                            .foregroundStyle(Color.accentColor)
                                            .clipShape(Capsule())
                                    }

                                    if !sec.instructions.isEmpty {
                                        Text(sec.instructions)
                                            .font(.footnote)
                                            .foregroundStyle(.secondary)
                                    }

                                    HStack {
                                        Text("Max: \(sec.maxCards) cards")
                                        Spacer()
                                        Text("Audio: \(sec.audio.glance ? "Glance" : "None") / \(sec.audio.deepDive.rawValue)")
                                    }
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                                }
                                .padding()
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                        }
                    }
                    .padding()
                } else {
                    ContentUnavailableView(
                        "No Brief Available",
                        systemImage: "doc.text",
                        description: Text("Sign in or pair your device on the web app to view your compiled brief configuration.")
                    )
                }
            }
            .navigationTitle("Your Brief")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
