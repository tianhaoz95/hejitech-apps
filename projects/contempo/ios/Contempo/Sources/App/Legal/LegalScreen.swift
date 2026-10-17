import ContempoCore
import SwiftUI

struct LegalScreen: View {
    let doc: LegalDoc
    @Environment(\.contempoPalette) private var palette

    private var document: LegalDocument {
        switch doc {
        case .privacy: return LegalContent.privacy
        case .terms: return LegalContent.terms
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(document.effectiveDateNotice)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

                ForEach(document.sections, id: \.heading) { section in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(section.heading)
                            .font(ContempoFont.titleMedium())
                        ForEach(section.paragraphs, id: \.self) { paragraph in
                            Text(paragraph)
                                .font(ContempoFont.bodyLarge())
                                .foregroundStyle(palette.inkSoft)
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle(document.title)
    }
}
