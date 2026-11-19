import FolioKit
import SwiftUI

/// File-by-file changes with added and removed lines, like a code review. Long unchanged runs stay
/// collapsed into the hunks the server computed.
struct DiffList: View {
    let files: [FileDiff]

    var body: some View {
        if files.isEmpty {
            Text("No changes.").foregroundStyle(.secondary).frame(maxWidth: .infinity).padding()
        } else {
            LazyVStack(alignment: .leading, spacing: 14) {
                ForEach(files) { FileDiffCard(file: $0) }
            }
        }
    }
}

struct FileDiffCard: View {
    let file: FileDiff
    @State private var expanded = true
    @State private var width: CGFloat = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button { withAnimation(.snappy) { expanded.toggle() } } label: {
                HStack(spacing: 8) {
                    Image(systemName: expanded ? "chevron.down" : "chevron.right").font(.caption.weight(.bold)).foregroundStyle(.secondary).frame(width: 12)
                    Text(file.from.map { "\($0) → \(file.path)" } ?? file.path).font(.subheadline.monospaced().weight(.semibold)).lineLimit(1).truncationMode(.middle)
                    Spacer()
                    statusTag
                    if file.added > 0 { Text("+\(file.added)").foregroundStyle(.green) }
                    if file.removed > 0 { Text("−\(file.removed)").foregroundStyle(.red) }
                }
                .font(.caption.monospacedDigit().weight(.semibold))
                .padding(.horizontal, 12).padding(.vertical, 10)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(file.path), \(file.status.rawValue), \(file.added) added, \(file.removed) removed")

            if expanded {
                Divider()
                if file.status == .binary {
                    Text("Binary file changed").font(.footnote).foregroundStyle(.secondary).padding(12)
                } else if file.truncated == true {
                    Text("Too large to show line by line.").font(.footnote).foregroundStyle(.secondary).padding(12)
                } else {
                    // Line colors span the card even when every line is short.
                    ScrollView(.horizontal, showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 0) {
                            ForEach(Array(file.hunks.enumerated()), id: \.offset) { i, h in
                                if i > 0 || h.aStart > 1 {
                                    Text("@@ \(h.aStart),\(h.aLines) → \(h.bStart),\(h.bLines)")
                                        .font(.caption2.monospaced())
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 10).padding(.vertical, 4)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(Color.accentColor.opacity(0.07))
                                }
                                ForEach(Array(h.lines.enumerated()), id: \.offset) { _, l in DiffLineRow(line: l) }
                            }
                        }
                        .frame(minWidth: width, alignment: .leading)
                    }
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
                }
            }
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(.quaternary))
    }

    @ViewBuilder private var statusTag: some View {
        switch file.status {
        case .added: Text("new").foregroundStyle(.green)
        case .deleted: Text("deleted").foregroundStyle(.red)
        case .renamed: Text("renamed").foregroundStyle(.orange)
        default: EmptyView()
        }
    }
}

private struct DiffLineRow: View {
    let line: DiffLine

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            Text(line.kind == .del ? "−" : line.kind == .add ? "+" : " ")
                .frame(width: 18)
                .foregroundStyle(line.kind == .add ? .green : line.kind == .del ? .red : .secondary)
            Text(line.text.isEmpty ? " " : line.text)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.trailing, 12)
        }
        .font(.caption.monospaced())
        .padding(.vertical, 1.5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(line.kind == .add ? Color.green.opacity(0.12) : line.kind == .del ? Color.red.opacity(0.12) : .clear)
        .accessibilityLabel("\(line.kind == .add ? "Added" : line.kind == .del ? "Removed" : "Unchanged"): \(line.text)")
    }
}
