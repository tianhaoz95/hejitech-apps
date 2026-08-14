import ContempoCore
import ContempoFirestore
import SwiftUI
import UIKit

/// Full-screen "shake to report" flow: shows the captured screenshot, lets
/// the user drag out a single box around the area of interest (box-select
/// only — explicitly not freehand drawing, per product requirement), edit
/// it (drag to move, drag a corner to resize), takes a short description,
/// then submits both via `FeedbackViewModel`.
struct FeedbackAnnotationView: View {
    let image: UIImage
    let onDismiss: () -> Void

    @State private var viewModel = FeedbackViewModel()
    @Environment(\.contempoPalette) private var palette

    /// The single source of truth for the drawn box — normalized (0..1)
    /// fractions of the *displayed image* (not the container), exactly the
    /// shape submitted to Firestore (see `FeedbackRegion`/firestore.rules'
    /// isValidFeedbackRegion). Storing it normalized, not in raw view
    /// coordinates, is what lets the box survive the image resizing (e.g.
    /// collapsing the input panel, see isInputExpanded below) without
    /// having to be cleared or drifting out of place — it's simply
    /// re-denormalized against whatever `imageFrameSize` currently is.
    @State private var boxNormalized: FeedbackRegion?
    @State private var dragMode: DragMode = .idle
    @State private var boxAtDragStart: FeedbackRegion?
    @State private var dragStartLocation: CGPoint = .zero
    @State private var dragStart: CGPoint?

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
    // resize of the image area. The box (stored normalized, see above)
    // survives this resize correctly, so there's no need to clear it.
    @State private var isInputExpanded = true
    private let collapsedReserve: CGFloat = 88
    // Inset from the screen edges on both the expanded panel and the
    // collapsed FAB below — same value on both so the panel visibly floats
    // in from the same margin it collapses into, instead of the expanded
    // state reading as a flush, edge-to-edge sheet while only the
    // collapsed state looks like a floating control.
    private let panelMargin: CGFloat = 16

    private enum Corner: CaseIterable {
        case topLeft, topRight, bottomLeft, bottomRight
    }

    private enum DragMode: Equatable {
        case idle
        case creating
        case moving
        case resizing(Corner)

        static func == (lhs: DragMode, rhs: DragMode) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle), (.creating, .creating), (.moving, .moving):
                return true
            case let (.resizing(l), .resizing(r)):
                return l == r
            default:
                return false
            }
        }
    }

    private func toggleInputExpanded() {
        isDescriptionFocused = false
        // withAnimation (rather than relying on an implicit .animation
        // modifier) is what makes the panel/FAB swap below actually
        // animate — combined with the .transition on each branch, this
        // reads as the panel growing out of the FAB's corner on expand
        // and shrinking back into it on collapse, instead of an instant
        // swap.
        withAnimation(.easeInOut(duration: 0.3)) {
            isInputExpanded.toggle()
        }
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
                let displayBox = boxNormalized.map { pixelRect(for: $0, in: geo.size) }

                ZStack {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(width: geo.size.width, height: geo.size.height)

                    if let displayBox {
                        HoleOverlay(hole: displayBox)
                            .fill(Color.black.opacity(0.5), style: FillStyle(eoFill: true))
                            .allowsHitTesting(false)
                        Rectangle()
                            .stroke(palette.pine, lineWidth: 2)
                            .frame(width: displayBox.width, height: displayBox.height)
                            .position(x: displayBox.midX, y: displayBox.midY)
                            .allowsHitTesting(false)
                        ForEach(Corner.allCases, id: \.self) { corner in
                            Circle()
                                .fill(palette.pine)
                                .overlay(Circle().stroke(.white, lineWidth: 2))
                                .frame(width: 20, height: 20)
                                .position(point(for: corner, of: displayBox))
                                .allowsHitTesting(false)
                        }
                    }
                }
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 2)
                        .onChanged { value in
                            if dragMode == .idle {
                                let currentBox = boxNormalized.map { pixelRect(for: $0, in: geo.size) }
                                if let currentBox, let corner = hitTestHandle(at: value.startLocation, box: currentBox) {
                                    dragMode = .resizing(corner)
                                } else if let currentBox, currentBox.insetBy(dx: -20, dy: -20).contains(value.startLocation) {
                                    dragMode = .moving
                                } else {
                                    dragMode = .creating
                                    dragStart = value.startLocation
                                }
                                boxAtDragStart = boxNormalized
                                dragStartLocation = value.startLocation
                            }

                            switch dragMode {
                            case .creating:
                                guard let start = dragStart else { return }
                                let rect = CGRect(
                                    x: min(start.x, value.location.x),
                                    y: min(start.y, value.location.y),
                                    width: abs(value.location.x - start.x),
                                    height: abs(value.location.y - start.y)
                                )
                                boxNormalized = normalize(pixelRect: rect, in: geo.size)
                            case .moving:
                                guard let startBox = boxAtDragStart else { return }
                                let startPixel = pixelRect(for: startBox, in: geo.size)
                                let moved = startPixel.offsetBy(
                                    dx: value.location.x - dragStartLocation.x,
                                    dy: value.location.y - dragStartLocation.y
                                )
                                boxNormalized = normalize(pixelRect: clamp(moved, to: displayRect(in: geo.size)), in: geo.size)
                            case .resizing(let corner):
                                guard let startBox = boxAtDragStart else { return }
                                let startPixel = pixelRect(for: startBox, in: geo.size)
                                let resized = resizedRect(startPixel, corner: corner, to: value.location)
                                boxNormalized = normalize(pixelRect: clamp(resized, to: displayRect(in: geo.size)), in: geo.size)
                            case .idle:
                                break
                            }
                        }
                        .onEnded { _ in
                            dragMode = .idle
                            dragStart = nil
                            boxAtDragStart = nil
                        }
                )
                .onAppear { imageFrameSize = geo.size }
                .onChange(of: geo.size) { _, newValue in imageFrameSize = newValue }
            }
            .ignoresSafeArea()
            // Reserves space at top/bottom for the header and description
            // panel so the image doesn't sit behind them in the normal
            // case — see restingHeaderHeight/restingPanelHeight above.
            // Only the bottom reserve reacts to isInputExpanded
            // (deliberately, see its comment above); neither reacts to
            // the keyboard, which is what keeps the drawn box from
            // drifting while typing.
            .padding(.top, restingHeaderHeight)
            .padding(.bottom, isInputExpanded ? restingPanelHeight + panelMargin : collapsedReserve)
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

                        Text(boxNormalized == nil ? "Drag on the screenshot to box the area you're reporting (optional)." : "Drag the corners to resize, drag inside to move, or drag elsewhere to redraw.")
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

                        // On-device dictation, same pipeline as Confirm's
                        // task field — a labeled button (mic icon + text),
                        // not icon-only, so it's clear what tapping it does.
                        if viewModel.isTranscribingDescription {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Transcribing…")
                                    .font(ContempoFont.labelSmall())
                                    .foregroundStyle(palette.inkSoft)
                            }
                        } else {
                            Button {
                                Task {
                                    if viewModel.isRecordingDescription {
                                        await viewModel.stopRecordingDescription()
                                    } else {
                                        await viewModel.startRecordingDescription()
                                    }
                                }
                            } label: {
                                Label(viewModel.isRecordingDescription ? "Stop" : "Dictate", systemImage: viewModel.isRecordingDescription ? "stop.fill" : "mic")
                            }
                            .buttonStyle(.bordered)
                            .tint(viewModel.isRecordingDescription ? palette.danger : palette.inkSoft)
                        }

                        if let submitError = viewModel.submitError {
                            Text(submitError)
                                .font(ContempoFont.labelSmall())
                                .foregroundStyle(palette.danger)
                        }

                        Button {
                            viewModel.submit(image: image, region: boxNormalized, onFinished: onDismiss)
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
                        .buttonBorderShape(.capsule)
                        .tint(palette.pine)
                        .disabled(
                            viewModel.isSubmitting || viewModel.isRecordingDescription || viewModel.isTranscribingDescription
                                || viewModel.description.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        )
                    }
                    .padding()
                    .background(
                        GeometryReader { geo in
                            Color.clear.onAppear {
                                if restingPanelHeight == 0 { restingPanelHeight = geo.size.height }
                            }
                        }
                    )
                    // A floating rounded card, not a flush edge-to-edge
                    // sheet — inset by panelMargin on the sides/bottom
                    // (matching the collapsed FAB's own inset below) with a
                    // shadow to read as genuinely floating above the image,
                    // not just a bar pinned to the screen edge.
                    .background(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .fill(palette.paper)
                            .shadow(color: .black.opacity(0.15), radius: 14, x: 0, y: 6)
                    )
                    .padding(.horizontal, panelMargin)
                    .padding(.bottom, panelMargin)
                    .padding(.bottom, keyboardHeight)
                    .animation(.easeOut(duration: 0.25), value: keyboardHeight)
                    // Anchored at the same corner the FAB sits in below,
                    // so this visibly grows out of it on expand and
                    // shrinks back into it on collapse — see
                    // toggleInputExpanded's withAnimation.
                    .transition(.scale(scale: 0.05, anchor: .bottomTrailing).combined(with: .opacity))
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
                                .shadow(color: .black.opacity(0.15), radius: 8, x: 0, y: 3)
                        }
                        .padding(panelMargin)
                    }
                    .transition(.scale(scale: 0.05, anchor: .bottomTrailing).combined(with: .opacity))
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

    /// The displayed image's bounds within `frameSize` — `.scaledToFit()`
    /// letterboxes/pillarboxes whenever `frameSize`'s aspect ratio doesn't
    /// exactly match the screenshot's, so this is almost never just
    /// `(0, 0, frameSize.width, frameSize.height)`.
    private func displayRect(in frameSize: CGSize) -> CGRect {
        guard frameSize.width > 0, frameSize.height > 0, image.size.width > 0, image.size.height > 0 else {
            return .zero
        }
        let imageAspect = image.size.width / image.size.height
        let frameAspect = frameSize.width / frameSize.height
        let displayedSize: CGSize
        if imageAspect > frameAspect {
            displayedSize = CGSize(width: frameSize.width, height: frameSize.width / imageAspect)
        } else {
            displayedSize = CGSize(width: frameSize.height * imageAspect, height: frameSize.height)
        }
        let offsetX = (frameSize.width - displayedSize.width) / 2
        let offsetY = (frameSize.height - displayedSize.height) / 2
        return CGRect(origin: CGPoint(x: offsetX, y: offsetY), size: displayedSize)
    }

    /// Denormalizes a 0..1 region into pixel/view coordinates within
    /// `frameSize`'s current displayed image bounds.
    private func pixelRect(for region: FeedbackRegion, in frameSize: CGSize) -> CGRect {
        let display = displayRect(in: frameSize)
        return CGRect(
            x: display.minX + region.x * display.width,
            y: display.minY + region.y * display.height,
            width: region.w * display.width,
            height: region.h * display.height
        )
    }

    /// Normalizes a pixel/view rect (within `frameSize`) into a 0..1
    /// region, matching `firestore.rules`' `isValidFeedbackRegion`.
    private func normalize(pixelRect: CGRect, in frameSize: CGSize) -> FeedbackRegion? {
        let display = displayRect(in: frameSize)
        guard display.width > 0, display.height > 0 else { return nil }
        return FeedbackRegion(
            x: max(0, min(1, (pixelRect.minX - display.minX) / display.width)),
            y: max(0, min(1, (pixelRect.minY - display.minY) / display.height)),
            w: max(0, min(1, pixelRect.width / display.width)),
            h: max(0, min(1, pixelRect.height / display.height))
        )
    }

    private func point(for corner: Corner, of rect: CGRect) -> CGPoint {
        switch corner {
        case .topLeft: return CGPoint(x: rect.minX, y: rect.minY)
        case .topRight: return CGPoint(x: rect.maxX, y: rect.minY)
        case .bottomLeft: return CGPoint(x: rect.minX, y: rect.maxY)
        case .bottomRight: return CGPoint(x: rect.maxX, y: rect.maxY)
        }
    }

    private func hitTestHandle(at point: CGPoint, box: CGRect, radius: CGFloat = 22) -> Corner? {
        for corner in Corner.allCases {
            let cornerPoint = self.point(for: corner, of: box)
            let dx = point.x - cornerPoint.x
            let dy = point.y - cornerPoint.y
            if (dx * dx + dy * dy).squareRoot() <= radius { return corner }
        }
        return nil
    }

    /// A drag under 8px in both axes reads as a tap, not an intentional
    /// resize/move — callers guard against this via `minimumDistance` on
    /// the gesture itself, so no separate check is needed here.
    private func resizedRect(_ rect: CGRect, corner: Corner, to point: CGPoint, minSize: CGFloat = 24) -> CGRect {
        var newRect = rect
        switch corner {
        case .topLeft:
            newRect.origin.x = min(point.x, rect.maxX - minSize)
            newRect.origin.y = min(point.y, rect.maxY - minSize)
            newRect.size.width = rect.maxX - newRect.origin.x
            newRect.size.height = rect.maxY - newRect.origin.y
        case .topRight:
            newRect.origin.y = min(point.y, rect.maxY - minSize)
            newRect.size.width = max(minSize, point.x - rect.minX)
            newRect.size.height = rect.maxY - newRect.origin.y
        case .bottomLeft:
            newRect.origin.x = min(point.x, rect.maxX - minSize)
            newRect.size.width = rect.maxX - newRect.origin.x
            newRect.size.height = max(minSize, point.y - rect.minY)
        case .bottomRight:
            newRect.size.width = max(minSize, point.x - rect.minX)
            newRect.size.height = max(minSize, point.y - rect.minY)
        }
        return newRect
    }

    private func clamp(_ rect: CGRect, to bounds: CGRect) -> CGRect {
        guard bounds.width > 0, bounds.height > 0 else { return rect }
        var r = rect
        r.size.width = min(r.width, bounds.width)
        r.size.height = min(r.height, bounds.height)
        r.origin.x = max(bounds.minX, min(r.origin.x, bounds.maxX - r.width))
        r.origin.y = max(bounds.minY, min(r.origin.y, bounds.maxY - r.height))
        return r
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
