import ContempoCore
import ContempoFirestore
import SwiftUI
import UIKit

/// Full-screen "shake to report" flow: shows the captured screenshot, lets
/// the user drag out a single box around the area of interest (box-select
/// only — explicitly not freehand drawing, per product requirement), takes
/// a short description, then submits both via `FeedbackViewModel`.
struct FeedbackAnnotationView: View {
    let image: UIImage
    let onDismiss: () -> Void

    @State private var viewModel = FeedbackViewModel()
    @Environment(\.contempoPalette) private var palette

    @State private var dragStart: CGPoint?
    @State private var boxRect: CGRect?
    @State private var imageFrameSize: CGSize = .zero

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Cancel") { onDismiss() }
                    .foregroundStyle(palette.inkSoft)
                Spacer()
                Text("Report an issue")
                    .font(ContempoFont.titleMedium())
                    .foregroundStyle(palette.ink)
                Spacer()
                Button("Cancel") { onDismiss() }
                    .opacity(0)
                    .accessibilityHidden(true)
            }
            .padding()

            GeometryReader { geo in
                ZStack {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)

                    if let boxRect {
                        HoleOverlay(hole: boxRect)
                            .fill(Color.black.opacity(0.5), style: FillStyle(eoFill: true))
                            .allowsHitTesting(false)
                        Rectangle()
                            .stroke(palette.pine, lineWidth: 2)
                            .frame(width: boxRect.width, height: boxRect.height)
                            .position(x: boxRect.midX, y: boxRect.midY)
                            .allowsHitTesting(false)
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 2)
                        .onChanged { value in
                            if dragStart == nil { dragStart = value.startLocation }
                            guard let start = dragStart else { return }
                            boxRect = CGRect(
                                x: min(start.x, value.location.x),
                                y: min(start.y, value.location.y),
                                width: abs(value.location.x - start.x),
                                height: abs(value.location.y - start.y)
                            )
                        }
                        .onEnded { _ in dragStart = nil }
                )
                .onAppear { imageFrameSize = geo.size }
                .onChange(of: geo.size) { _, newValue in imageFrameSize = newValue }
            }
            .clipped()

            VStack(alignment: .leading, spacing: 8) {
                Text(boxRect == nil ? "Drag on the screenshot to box the area you're reporting (optional)." : "Area boxed. Drag again to redraw.")
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkFaint)

                TextField("What's wrong, or what should be better?", text: $viewModel.description, axis: .vertical)
                    .lineLimit(3...6)
                    .textFieldStyle(.roundedBorder)

                if let submitError = viewModel.submitError {
                    Text(submitError)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.danger)
                }

                Button {
                    viewModel.submit(image: image, region: normalizedRegion(), onFinished: onDismiss)
                } label: {
                    if viewModel.isSubmitting {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Submit")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.pine)
                .disabled(viewModel.isSubmitting || viewModel.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding()
        }
        .background(palette.paper)
    }

    /// Converts the on-screen box (view coordinates within the
    /// `GeometryReader`) into a 0..1 fraction of the displayed image size —
    /// resolution-independent, matches `firestore.rules`' `isValidFeedbackRegion`.
    ///
    /// Normalizes against the image's actual displayed bounds within
    /// `imageFrameSize`, not the frame itself: `.scaledToFit()` letterboxes/
    /// pillarboxes whenever the frame's aspect ratio doesn't exactly match
    /// the screenshot's (it never does here — this GeometryReader is a
    /// partial-height section, not the full screen the screenshot was taken
    /// from), so normalizing against the raw frame would silently shift the
    /// stored region away from what the user actually boxed on the image.
    private func normalizedRegion() -> FeedbackRegion? {
        guard let boxRect, imageFrameSize.width > 0, imageFrameSize.height > 0,
              image.size.width > 0, image.size.height > 0 else { return nil }

        let imageAspect = image.size.width / image.size.height
        let frameAspect = imageFrameSize.width / imageFrameSize.height
        let displayedSize: CGSize
        if imageAspect > frameAspect {
            displayedSize = CGSize(width: imageFrameSize.width, height: imageFrameSize.width / imageAspect)
        } else {
            displayedSize = CGSize(width: imageFrameSize.height * imageAspect, height: imageFrameSize.height)
        }
        let offsetX = (imageFrameSize.width - displayedSize.width) / 2
        let offsetY = (imageFrameSize.height - displayedSize.height) / 2

        return FeedbackRegion(
            x: max(0, min(1, (boxRect.minX - offsetX) / displayedSize.width)),
            y: max(0, min(1, (boxRect.minY - offsetY) / displayedSize.height)),
            w: max(0, min(1, boxRect.width / displayedSize.width)),
            h: max(0, min(1, boxRect.height / displayedSize.height))
        )
    }
}

/// Even-odd-filled donut shape (outer bounds minus `hole`) — the scrim that
/// dims everything except the boxed region.
private struct HoleOverlay: Shape {
    let hole: CGRect

    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.addRect(rect)
        path.addRect(hole)
        return path
    }
}
