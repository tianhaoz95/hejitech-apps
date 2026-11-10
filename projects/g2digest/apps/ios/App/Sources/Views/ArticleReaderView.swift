import SwiftUI
import G2DigestKit

/// The full written edition, as the web's Edition page shows it: every section's text, how it was
/// put together, and its sources. Long-form reading at the size the reader chose (Dynamic Type),
/// with a table of contents and a jump to each section's cards.
struct ArticleReaderView: View {
    @ObservedObject var appModel: AppModel
    @AppStorage("g2digest_article_serif") private var serif = true

    var body: some View {
        if let bundle = appModel.currentBundle {
            let ed = bundle.edition
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 28) {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text(prettyDate(bundle.date).uppercased())
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(.secondary)
                                    .kerning(1)
                                Spacer()
                                Button { serif.toggle() } label: {
                                    Text("Aa")
                                        .font(.system(.subheadline, design: serif ? .default : .serif).weight(.semibold))
                                        .padding(.horizontal, 10).padding(.vertical, 4)
                                        .background(Color(.tertiarySystemFill), in: Capsule())
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(serif ? "Use sans-serif text" : "Use serif text")
                            }
                            Text(ed.title)
                                .font(.system(.largeTitle, design: serif ? .serif : .default).weight(.bold))
                            if let intro = ed.intro, !intro.isEmpty {
                                Text(intro)
                                    .font(.system(.title3, design: serif ? .serif : .default))
                                    .foregroundStyle(.secondary)
                            }
                        }

                        if ed.sections.count > 1 {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("IN THIS EDITION").font(.caption.weight(.semibold)).foregroundStyle(.secondary).kerning(1)
                                ForEach(Array(ed.sections.enumerated()), id: \.offset) { i, s in
                                    Button { withAnimation { proxy.scrollTo("s\(i)", anchor: .top) } } label: {
                                        HStack {
                                            Text(s.title).foregroundStyle(.primary)
                                            Spacer()
                                            Image(systemName: "chevron.down").font(.caption).foregroundStyle(.secondary)
                                        }
                                    }
                                }
                            }
                            .padding(16)
                            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
                        }

                        ForEach(Array(ed.sections.enumerated()), id: \.offset) { i, s in
                            section(s, cards: bundle.cards)
                                .id("s\(i)")
                        }

                        if bundle.edition.sections.isEmpty {
                            Text("This edition has cards only. Switch to Native to read them.")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.horizontal, 22)
                    .padding(.top, 12)
                    .padding(.bottom, 120)
                    .frame(maxWidth: 680, alignment: .leading)
                    .frame(maxWidth: .infinity)
                }
                .refreshable { await appModel.refreshAll() }
            }
        } else {
            ContentUnavailableView("No edition yet", systemImage: "newspaper", description: Text("Pull down to check again."))
        }
    }

    @ViewBuilder
    private func section(_ s: EditionSection, cards: [CardInput]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(s.title)
                .font(.system(.title2, design: serif ? .serif : .default).weight(.bold))

            ForEach(Array(paragraphs(s.body).enumerated()), id: \.offset) { _, p in
                Text(LocalizedStringKey(p))
                    .font(.system(.body, design: serif ? .serif : .default))
                    .lineSpacing(5)
                    .textSelection(.enabled)
            }

            if let first = cards.firstIndex(where: { $0.sectionId == s.sectionId }) {
                Button {
                    appModel.goToCard(index: first)
                    appModel.viewMode = .native
                } label: {
                    Label("Read as cards", systemImage: "rectangle.stack")
                        .font(.subheadline.weight(.medium))
                }
                .buttonStyle(.bordered)
            }

            if let m = s.methodology, !m.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("How this was put together", systemImage: "magnifyingglass")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(.secondary)
                    Text(m).font(.callout).foregroundStyle(.secondary).textSelection(.enabled)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 14))
            }

            if !s.sources.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("SOURCES").font(.caption.weight(.semibold)).foregroundStyle(.secondary).kerning(1)
                    ForEach(Array(s.sources.enumerated()), id: \.offset) { n, src in
                        if let url = URL(string: src.url) {
                            Link(destination: url) {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    Text("\(n + 1)").font(.caption.monospacedDigit()).foregroundStyle(.secondary)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(src.title).font(.callout).multilineTextAlignment(.leading)
                                        Text(url.host() ?? src.url).font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer(minLength: 0)
                                    Image(systemName: "arrow.up.right").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            }
            Divider().padding(.top, 8)
        }
    }

    /// Paragraphs of a section body (blank-line separated; Markdown emphasis and links render).
    private func paragraphs(_ body: String) -> [String] {
        body.components(separatedBy: "\n\n").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    private func prettyDate(_ d: String) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        guard let date = f.date(from: d) else { return d }
        return date.formatted(date: .complete, time: .omitted)
    }
}
