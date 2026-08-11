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
    @FocusState private var isDescriptionFocused: Bool
    @State private var keyboardHeight: CGFloat = 0

    // The header's and the description panel's own heights at rest
    // (keyboard closed, panel expanded) — captured once from their first
    // measurement, mirroring Android's restingControlsHeightPx. Reserving
    // this much space at the top/bottom of the image keeps it from
    // overlapping either overlay in the normal case.
    @State private var restingHeaderHeight: CGFloat = 0
    @State private var restingPanelHeight: CGFloat = 0

    // Lets the user shrink the description/buttons panel down to a small
    // button to see the screenshot underneath it — a deliberate, discrete
    // resize of the image area, unlike the keyboard case, so any drawn box
    // is cleared on toggle instead of trying to rescale it: the box is
    // drawn relative to a *specific* image size, and there's no cheap way
    // to keep it correctly positioned across an arbitrary resize without
    // re-deriving it, so clearing it (the user can just redraw in a couple
    // seconds) is the simplest correct choice.
    @State private var isInputExpanded = true
    private let collapsedReserve: CGFloat = 88

    private func toggleInputExpanded() {
        dragStart = nil
        boxRect = nil
        isDescriptionFocused = false
        isInputExpanded.toggle()
    }

    var body: some View {
        // A ZStack, not a VStack: the image/box-select layer and the
        // header+controls overlay are independent siblings here, each
        // given the *full* screen bounds by ZStack (unlike VStack, which
        // divides one shared height across its children). That
        // independence is load-bearing — an earlier version of this
        // screen used a single VStack and pushed the keyboard-avoidance
        // padding onto the bottom section, which still shrank the
        // GeometryReader sibling because VStack children share space
        // sequentially. Here, moving the overlay (however far, by however
        // much padding) can never resize the image layer, so the drawn
        // box never drifts regardless of keyboard state.
        ZStack {
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
            .ignoresSafeArea()
            // Reserves space at top/bottom for the header and description
            // panel so the image doesn't sit behind them in the normal
            // case — see restingHeaderHeight/restingPanelHeight above.
            // Only the bottom reserve reacts to isInputExpanded
            // (deliberately, see toggleInputExpanded's kdoc); neither
            // reacts to the keyboard, which is what keeps the drawn box
            // from drifting while typing.
            .padding(.top, restingHeaderHeight)
            .padding(.bottom, isInputExpanded ? restingPanelHeight : collapsedReserve)
            .onTapGesture { isDescriptionFocused = false }

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
                .background(
                    GeometryReader { geo in
                        Color.clear.onAppear {
                            if restingHeaderHeight == 0 { restingHeaderHeight = geo.size.height }
                        }
                    }
                )
                .background(palette.paper)

                Spacer(minLength: 0)

                if isInputExpanded {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Spacer()
                            Button {
                                toggleInputExpanded()
                            } label: {
                                Image(systemName: "chevron.down.circle.fill")
                                    .foregroundStyle(palette.inkFaint)
                            }
                        }

                        Text(boxRect == nil ? "Drag on the screenshot to box the area you're reporting (optional)." : "Area boxed. Drag again to redraw.")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)

                        TextField("What's wrong, or what should be better?", text: $viewModel.description, axis: .vertical)
                            .lineLimit(3...6)
                            .textFieldStyle(.roundedBorder)
                            .focused($isDescriptionFocused)
                            .toolbar {
                                ToolbarItemGroup(placement: .keyboard) {
                                    Spacer()
                                    Button("Done") { isDescriptionFocused = false }
                                }
                            }

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
                    .background(
                        GeometryReader { geo in
                            Color.clear.onAppear {
                                if restingPanelHeight == 0 { restingPanelHeight = geo.size.height }
                            }
                        }
                    )
                    .background(palette.paper)
                    .padding(.bottom, keyboardHeight)
                    .animation(.easeOut(duration: 0.25), value: keyboardHeight)
                } else {
                    HStack {
                        Spacer()
                        Button {
                            toggleInputExpanded()
                        } label: {
                            Image(systemName: "chevron.up.circle.fill")
                                .font(.system(size: 44))
                                .foregroundStyle(palette.pine)
                                .background(Circle().fill(.white))
                        }
                        .padding()
                    }
                }
            }
            .ignoresSafeArea(.keyboard, edges: .bottom)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { notification in
            if let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect {
                keyboardHeight = frame.height
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardHeight = 0
        }
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
