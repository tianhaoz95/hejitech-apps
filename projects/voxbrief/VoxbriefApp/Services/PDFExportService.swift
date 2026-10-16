import Foundation
#if canImport(UIKit) && !os(watchOS)
import UIKit
#endif
#if canImport(PDFKit)
import PDFKit
#endif

public final class PDFExportService: Sendable {
    public static let shared = PDFExportService()

    public init() {}

    public func exportTemporaryPDF(for note: VoiceNote) -> URL? {
        let tempDir = FileManager.default.temporaryDirectory
        let safeTitle = note.title
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
        let filename = (safeTitle.isEmpty ? "voxbrief-\(note.id.uuidString.prefix(8))" : safeTitle) + ".pdf"
        let fileURL = tempDir.appendingPathComponent(filename)

        #if canImport(UIKit) && !os(watchOS)
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        do {
            let data = try renderer.pdfData { context in
                context.beginPage()

                let margin: CGFloat = 40
                var currentY: CGFloat = margin
                let contentWidth = pageRect.width - (margin * 2)

                // Title
                let titleFont = UIFont.boldSystemFont(ofSize: 22)
                let titleAttributes: [NSAttributedString.Key: Any] = [
                    .font: titleFont,
                    .foregroundColor: UIColor.label
                ]
                let titleString = NSAttributedString(string: note.title, attributes: titleAttributes)
                let titleRect = CGRect(x: margin, y: currentY, width: contentWidth, height: 40)
                titleString.draw(in: titleRect)
                currentY += 44

                // Metadata
                let metaFont = UIFont.systemFont(ofSize: 11)
                let metaAttributes: [NSAttributedString.Key: Any] = [
                    .font: metaFont,
                    .foregroundColor: UIColor.secondaryLabel
                ]
                let metaText = "\(note.createdAt.relativeOrFormattedString) · \(note.source.displayName) · Duration: \(note.duration.formattedDuration)"
                let metaString = NSAttributedString(string: metaText, attributes: metaAttributes)
                metaString.draw(in: CGRect(x: margin, y: currentY, width: contentWidth, height: 20))
                currentY += 26

                // Summary
                if !note.summary.isEmpty {
                    let summaryFont = UIFont.italicSystemFont(ofSize: 13)
                    let summaryAttributes: [NSAttributedString.Key: Any] = [
                        .font: summaryFont,
                        .foregroundColor: UIColor.darkGray
                    ]
                    let summaryString = NSAttributedString(string: "Summary: \(note.summary)", attributes: summaryAttributes)
                    let summaryBounds = summaryString.boundingRect(with: CGSize(width: contentWidth, height: 100), options: .usesLineFragmentOrigin, context: nil)
                    summaryString.draw(in: CGRect(x: margin, y: currentY, width: contentWidth, height: summaryBounds.height))
                    currentY += summaryBounds.height + 16
                }

                // Divider line
                let linePath = UIBezierPath()
                linePath.move(to: CGPoint(x: margin, y: currentY))
                linePath.addLine(to: CGPoint(x: pageRect.width - margin, y: currentY))
                UIColor.separator.setStroke()
                linePath.lineWidth = 1
                linePath.stroke()
                currentY += 16

                // Content
                let content = note.cleanedNote.isEmpty ? note.rawTranscript : note.cleanedNote
                let contentFont = UIFont.systemFont(ofSize: 12)
                let paragraphStyle = NSMutableParagraphStyle()
                paragraphStyle.lineSpacing = 4
                let contentAttributes: [NSAttributedString.Key: Any] = [
                    .font: contentFont,
                    .foregroundColor: UIColor.label,
                    .paragraphStyle: paragraphStyle
                ]
                let contentString = NSAttributedString(string: content, attributes: contentAttributes)
                let remainingHeight = pageRect.height - currentY - margin
                contentString.draw(in: CGRect(x: margin, y: currentY, width: contentWidth, height: max(remainingHeight, 50)))
            }

            try data.write(to: fileURL, options: .atomic)
            return fileURL
        } catch {
            print("[PDFExportService] Failed to render PDF: \(error)")
            return nil
        }
        #elseif canImport(PDFKit)
        let doc = PDFDocument()
        let page = PDFPage()
        doc.insert(page, at: 0)
        if doc.write(to: fileURL) {
            return fileURL
        }
        return nil
        #else
        return nil
        #endif
    }
}
