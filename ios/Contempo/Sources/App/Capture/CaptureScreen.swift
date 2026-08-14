import ContempoCore
import ContempoFirestore
import SwiftUI

/// How long the ongoing-work/trip banners linger in their "completed" state — see the two `.onChange` blocks in CaptureScreen's body.
private let recentlyCompletedDisplaySeconds: Double = 5

struct CaptureScreen: View {
    let onDrafted: (ConfirmParams) -> Void
    var onEntryClick: (String) -> Void = { _ in }
    @State private var viewModel = CaptureViewModel()
    @State private var showHelpWalkthrough = false
    @State private var photoCamera = CameraCaptureState()
    @State private var showCancelWorkDialog = false
    @State private var showCancelTripDialog = false
    // Snapshot of the most recently open trip/timer entry plus a "still in
    // its post-completion grace window" flag — see the two `.onChange`
    // blocks below and OngoingWorkBanner/OngoingTripBanner's `isCompleted`
    // doc comment for why this exists (mirrors Android's `lastTripEntry`/
    // `tripJustCompleted` locals in CaptureScreen.kt).
    @State private var lastTripEntry: Entry?
    @State private var tripJustCompleted = false
    @State private var lastTimerEntry: Entry?
    @State private var timerJustCompleted = false
    // Distinguishes a cancel from a real completion for the two `.onChange`
    // blocks below — both transitions clear the open entry the same way,
    // but only a real completion should get the "recently completed, tap
    // to edit" banner treatment; a cancelled entry no longer exists, so
    // there's nothing to edit. Set true right when the cancel confirmation
    // is tapped, consumed (reset to false) by the `.onChange` the moment it
    // reacts.
    @State private var tripWasCancelled = false
    @State private var workWasCancelled = false
    @Environment(\.contempoPalette) private var palette
    // Drives TypedCaptureHero's TextEditor focus — hoisted up here (rather
    // than local to that private struct) so this screen's own tap-outside/
    // scrollDismissesKeyboard/keyboard-toolbar wiring below can all resign
    // it, same reasoning as ChatScreen's isInputFocused.
    @FocusState private var isTypingFocused: Bool

    private var busy: Bool {
        viewModel.isRecording || viewModel.isTranscribing || viewModel.isParsing || viewModel.finalizedTranscript != nil ||
            viewModel.isProcessingPhoto
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                HStack {
                    Eyebrow("Capture")
                    Spacer()
                    // Moved here (was a full-width box below the quick-
                    // action row) in response to in-app feedback — a
                    // compact badge reads better next to the help button
                    // than a large box competing with the hero mic button
                    // for attention.
                    if viewModel.quickCaptureEnabled || viewModel.quickCaptureStatus.hasAnything {
                        QuickCaptureBadge(
                            status: viewModel.quickCaptureStatus,
                            onProcessNow: { viewModel.processQuickCaptureBacklogNow() }
                        )
                    }
                    Button {
                        showHelpWalkthrough = true
                    } label: {
                        Image(systemName: "questionmark.circle")
                            .font(.title3)
                            .foregroundStyle(palette.inkSoft)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Help & walkthrough")
                }

                TitleWordmark(confirmedHours: viewModel.confirmedHours)

                if let tripEntry = lastTripEntry {
                    // isGps is read off this entry snapshot, not
                    // viewModel.gpsTripOpen (openTripEntry?.mileageCaptureMethod
                    // == "gps") — that goes stale (always false) the instant
                    // openTripEntry flips nil, which is exactly the moment
                    // this needs to still know what kind of trip just closed.
                    let isGps = tripEntry.mileageCaptureMethod == "gps"
                    OngoingTripBanner(
                        entry: tripEntry,
                        isGps: isGps,
                        isCompleted: tripJustCompleted,
                        onComplete: {
                            if isGps { viewModel.toggleGpsTrip() } else { photoCamera.launch() }
                        },
                        onPauseToggle: {
                            if tripEntry.isPaused == true { viewModel.resumeTrip() } else { viewModel.pauseTrip() }
                        },
                        onCancel: { showCancelTripDialog = true },
                        onTapCompleted: { onEntryClick(tripEntry.id ?? "") }
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                if let timerEntry = lastTimerEntry {
                    OngoingWorkBanner(
                        entry: timerEntry,
                        isCompleted: timerJustCompleted,
                        onComplete: { viewModel.completeOpenTimer() },
                        onPauseToggle: {
                            if timerEntry.isPaused == true { viewModel.resumeWork() } else { viewModel.pauseWork() }
                        },
                        onCancel: { showCancelWorkDialog = true },
                        onTapCompleted: { onEntryClick(timerEntry.id ?? "") }
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Same top-of-screen position as the trip/timer banners
                // above, not down by the hero button — the transcript-
                // ready-to-confirm card is the same kind of "something
                // needs your attention" state they are, so it should read
                // consistently rather than appearing wherever it happens to
                // fall in the scroll. Moved here in response to feedback
                // that a bottom-of-screen placement was easy to miss/
                // inconsistent — see Android's CaptureScreen.kt for the
                // matching change.
                if let finalizedTranscript = viewModel.finalizedTranscript {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Here's what we heard")
                            .font(ContempoFont.titleMedium())
                        Text(finalizedTranscript)
                            .font(ContempoFont.bodyLarge())

                        HStack {
                            Button("Try again") { viewModel.discardTranscript() }
                                .buttonStyle(.bordered)
                            Spacer()
                            Button("Looks good — continue") {
                                viewModel.confirmTranscript(onDrafted: onDrafted)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(palette.pine)
                            .disabled(viewModel.isParsing)
                        }
                    }
                    .padding()
                    .background(palette.paperRaised)
                    .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.large))
                    .overlay(
                        RoundedRectangle(cornerRadius: ContempoRadius.large)
                            .stroke(palette.hairline, lineWidth: 1)
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                // Session-only choice between the two hero widgets below —
                // separate from Settings' persisted default, which only
                // seeds which one a *fresh* Capture visit opens into (see
                // CaptureViewModel.captureMode's doc comment: this toggle
                // never writes the persisted default back). Everything else
                // on this screen — quick-action row, photo/transcript
                // feedback, Quick Capture — renders unconditionally
                // regardless of mode; only the hero itself is mode-driven.
                VStack(spacing: 20) {
                    CaptureModeToggle(selected: viewModel.captureMode, order: viewModel.captureModeOrder, onSelect: viewModel.setCaptureMode)

                    // Asymmetric slide+fade, direction fixed per branch
                    // (typing always enters/exits via the trailing edge,
                    // voice always via the leading edge) so it reads as a
                    // left/right swap in either direction without having to
                    // compute a "forward"/"reverse" flag — see Android's
                    // CaptureScreen.kt AnimatedContent for the equivalent.
                    //
                    // `minHeight` + `.top` alignment reserves enough room for
                    // both variants' typical (non-parsing) height so the
                    // quick-action row below never shifts when switching
                    // modes — mirrors Android's `heightIn(min = 260.dp)` +
                    // `Alignment.TopCenter` on its equivalent Box.
                    //
                    // `simultaneousGesture` (not `.gesture`) so this swipe
                    // detector runs *alongside* TypedCaptureHero's TextEditor
                    // rather than stealing its touches — a plain `.gesture`
                    // on an ancestor can block a child's own text-selection
                    // drag in SwiftUI. The high distance + mostly-horizontal
                    // thresholds below exist for the same reason: a real
                    // text-selection drag is short/diagonal, a page swipe is
                    // long and flat, so this only fires for the latter.
                    Group {
                        if viewModel.captureMode == .typing {
                            TypedCaptureHero(viewModel: viewModel, onDrafted: onDrafted, isFocused: $isTypingFocused)
                                .transition(.asymmetric(
                                    insertion: .move(edge: .trailing).combined(with: .opacity),
                                    removal: .move(edge: .leading).combined(with: .opacity)
                                ))
                        } else {
                            VStack(spacing: 16) {
                                VoiceButton(
                                    isRecording: viewModel.isRecording,
                                    isThinking: viewModel.isTranscribing || viewModel.isParsing,
                                    amplitude: viewModel.recordingAmplitude
                                ) {
                                    Task {
                                        if viewModel.isRecording {
                                            if viewModel.quickCaptureEnabled {
                                                viewModel.stopQuickCaptureAndSave()
                                            } else {
                                                await viewModel.stopRecordingAndProcess()
                                            }
                                        } else {
                                            await viewModel.startRecording()
                                        }
                                    }
                                }
                                .disabled(viewModel.isTranscribing || viewModel.isParsing)

                                if viewModel.isRecording {
                                    RecordingIndicator("Listening…")
                                } else if viewModel.isTranscribing {
                                    ThinkingIndicator("Transcribing…")
                                } else if viewModel.isParsing {
                                    ThinkingIndicator(stageLabel(viewModel.parsingStage))
                                } else {
                                    Text("Tap to speak")
                                        .font(ContempoFont.titleMedium())
                                        .foregroundStyle(palette.inkSoft)
                                }
                            }
                            .transition(.asymmetric(
                                insertion: .move(edge: .leading).combined(with: .opacity),
                                removal: .move(edge: .trailing).combined(with: .opacity)
                            ))
                        }
                    }
                    .frame(minHeight: 250, alignment: .top)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.captureMode)
                    .simultaneousGesture(
                        DragGesture(minimumDistance: 24)
                            .onEnded { value in
                                guard !busy else { return }
                                let horizontal = value.translation.width
                                let vertical = value.translation.height
                                guard abs(horizontal) > 100, abs(horizontal) > abs(vertical) * 2 else { return }
                                if horizontal < 0, viewModel.captureMode == .audioFirst {
                                    viewModel.setCaptureMode(.typing)
                                } else if horizontal > 0, viewModel.captureMode == .typing {
                                    viewModel.setCaptureMode(.audioFirst)
                                }
                            }
                    )

                    // Quick actions for the other primary capture modes —
                    // promoted out of the old "More ways to capture" menu
                    // so they're discoverable without an extra tap, but
                    // sized well below the hero VoiceButton so voice
                    // stays visually primary. Each session-based one
                    // hides once its own ongoing-session banner is
                    // showing above, since the banner already owns that
                    // mode's stop/complete affordance. Photo capture has
                    // no such banner (a photo is a one-shot action, not
                    // an ongoing session) so it always shows. "Type
                    // instead" was removed once CaptureModeToggle above
                    // became the only entry point into Typing mode worth
                    // keeping — down to 3 buttons max now, spaced out a bit
                    // more than before to use the room that freed up.
                    //
                    // Still ViewThatFits, not a plain HStack — 3 buttons
                    // comfortably fit a single line on typical phone widths
                    // at this spacing, but ViewThatFits costs nothing when
                    // it doesn't need to fall back and keeps the same
                    // overflow safety net (see git history for the bug this
                    // originally fixed when there were 4 buttons) for
                    // narrower screens or larger accessibility text.
                    let quickActions = buildQuickActions()
                    ViewThatFits(in: .horizontal) {
                        quickActionsRow(quickActions)
                        VStack(spacing: 12) {
                            let half = (quickActions.count + 1) / 2
                            quickActionsRow(Array(quickActions.prefix(half)))
                            quickActionsRow(Array(quickActions.suffix(quickActions.count - half)))
                        }
                    }

                    if viewModel.isProcessingPhoto {
                        ThinkingIndicator("Looking at your photo…")
                    } else if photoCamera.permissionDenied {
                        Text("Camera access is needed to attach a photo — tap again to grant it.")
                            .font(ContempoFont.labelSmall())
                            .foregroundStyle(palette.inkFaint)
                    }

                }

                if let errorMessage = viewModel.errorMessage {
                    Text(errorMessage)
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.danger)
                }

                Spacer()
            }
            .padding(20)
            // Every lastTripEntry/lastTimerEntry mutation below is wrapped
            // in its own withAnimation rather than relying on an
            // .animation(value:) modifier here — a prior version bound
            // .animation to viewModel.openTripEntry?.id/openTimerEntry?.id,
            // but the card's actual visibility (the `if let
            // lastTripEntry`/`lastTimerEntry` + .transition() above) is
            // driven by lastTripEntry/lastTimerEntry, a *different*
            // property, and the cancel/completed-timeout paths below set
            // those well after (or via a delayed Task, not even in the
            // same run loop turn as) the openTripEntry/openTimerEntry
            // change the old modifier was actually watching. That mismatch
            // is why cancelling a trip/timer made the card vanish
            // instantly instead of animating away.
            .onChange(of: viewModel.openTripEntry) { _, newValue in
                if let newValue {
                    withAnimation(.easeInOut(duration: 0.3)) { lastTripEntry = newValue }
                    tripJustCompleted = false
                } else if tripWasCancelled {
                    // Cancelled, not completed — the entry no longer
                    // exists, so there's nothing to tap into and edit.
                    // Collapse right away instead of running the "just
                    // completed" treatment below.
                    tripWasCancelled = false
                    withAnimation(.easeInOut(duration: 0.3)) { lastTripEntry = nil }
                } else if lastTripEntry != nil {
                    // The trip just closed (openTripEntry went from set to
                    // nil) — keep the card up a few seconds longer in a
                    // "completed" state instead of collapsing instantly, so
                    // there's a window to tap straight into EntryDetail and
                    // fill in anything still missing rather than having to
                    // go find it later from Dashboard's pending list.
                    // Cancelled/restarted automatically if a new trip starts
                    // before this Task finishes, since that reruns this
                    // onChange with a non-nil newValue first.
                    // Deliberately not reset to false before clearing
                    // lastTripEntry: doing both would leave a frame where
                    // the card is still visible but isCompleted has
                    // already flipped back, flashing the in-progress
                    // treatment right before the card disappears. Leaving
                    // it true until the card is actually gone avoids
                    // that — a new trip starting already resets it
                    // explicitly (see the branch above).
                    tripJustCompleted = true
                    Task {
                        try? await Task.sleep(nanoseconds: UInt64(recentlyCompletedDisplaySeconds * 1_000_000_000))
                        withAnimation(.easeInOut(duration: 0.3)) { lastTripEntry = nil }
                    }
                }
            }
            .onChange(of: viewModel.openTimerEntry) { _, newValue in
                if let newValue {
                    withAnimation(.easeInOut(duration: 0.3)) { lastTimerEntry = newValue }
                    timerJustCompleted = false
                } else if workWasCancelled {
                    // See the trip case above for why a cancel skips the
                    // "just completed" treatment entirely.
                    workWasCancelled = false
                    withAnimation(.easeInOut(duration: 0.3)) { lastTimerEntry = nil }
                } else if lastTimerEntry != nil {
                    // See the trip case above for why this stays up briefly
                    // instead of disappearing the instant openTimerEntry goes nil.
                    // See the trip case above for why this isn't reset to
                    // false before clearing lastTimerEntry.
                    timerJustCompleted = true
                    Task {
                        try? await Task.sleep(nanoseconds: UInt64(recentlyCompletedDisplaySeconds * 1_000_000_000))
                        withAnimation(.easeInOut(duration: 0.3)) { lastTimerEntry = nil }
                    }
                }
            }
        }
        // Typing mode's TextEditor otherwise had no way to dismiss the
        // keyboard — same fix as ChatScreen's isInputFocused: interactive
        // dismiss-on-scroll, tap anywhere else to dismiss, and an explicit
        // Done key on the keyboard itself.
        .scrollDismissesKeyboard(.interactively)
        .onTapGesture { isTypingFocused = false }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { isTypingFocused = false }
                    .font(ContempoFont.labelLarge().weight(.semibold))
            }
        }
        .navigationTitle("Capture")
        .sheet(isPresented: $showHelpWalkthrough) {
            HelpWalkthroughSheet()
        }
        .fullScreenCover(isPresented: $photoCamera.isPresented) {
            CameraPicker { data in
                viewModel.processCapturedPhoto(imageData: data, onDrafted: onDrafted)
            }
            .ignoresSafeArea()
        }
        // A centered .alert, not a bottom-anchored .confirmationDialog —
        // this is a plain yes/no confirmation with no list of options to
        // choose between, which is exactly what .alert is for; a
        // confirmation dialog (action sheet) reads as overkill/unfamiliar
        // for a two-button "are you sure," matching Android's use of a
        // plain Material AlertDialog for the same prompt.
        .alert(
            "Discard this work session?",
            isPresented: $showCancelWorkDialog
        ) {
            Button("Discard", role: .destructive) {
                workWasCancelled = true
                viewModel.cancelWork()
            }
            Button("Keep going", role: .cancel) {}
        } message: {
            Text("This deletes the timer and everything logged so far. This can't be undone.")
        }
        .alert(
            "Discard this trip?",
            isPresented: $showCancelTripDialog
        ) {
            Button("Discard", role: .destructive) {
                tripWasCancelled = true
                viewModel.cancelTrip()
            }
            Button("Keep going", role: .cancel) {}
        } message: {
            Text("This deletes the trip and everything tracked so far. This can't be undone.")
        }
    }

    /// Built fresh each render so it reflects current openTimerEntry/
    /// openTripEntry/busy state — see the ViewThatFits call site in body.
    private func buildQuickActions() -> [QuickAction] {
        var actions: [QuickAction] = []
        if viewModel.openTimerEntry == nil {
            actions.append(QuickAction(id: "timer", icon: "timer", label: "Start Timer", disabled: viewModel.isTranscribing || viewModel.isParsing) {
                viewModel.startNewWork()
            })
        }
        if viewModel.openTripEntry == nil {
            actions.append(QuickAction(id: "trip", icon: "location.fill", label: "Start Trip", disabled: viewModel.isTranscribing || viewModel.isParsing) {
                viewModel.toggleGpsTrip()
            })
        }
        // The unified photo-capture entry point — the model decides
        // odometer-reading vs. work evidence once the photo is taken (see
        // CaptureViewModel.processCapturedPhoto) rather than the host
        // having to pick the right button first, so there's just one photo
        // action here.
        actions.append(QuickAction(id: "photo", icon: "camera.fill", label: "Take a photo", disabled: busy) {
            photoCamera.launch()
        })
        return actions
    }

    @ViewBuilder
    private func quickActionsRow(_ actions: [QuickAction]) -> some View {
        HStack(spacing: 16) {
            ForEach(actions) { action in
                QuickActionButton(icon: action.icon, label: action.label, tint: action.tint, tintBackground: action.tintBackground) {
                    action.action()
                }
                .disabled(action.disabled)
            }
        }
    }
}

/// The screen's title, doubling as a passive progress visualizer: letters
/// render brand-colored up through the fraction of the word matching
/// progress toward `MaterialParticipationTest.thresholdHours`, muted past
/// it. The "X / 100 hrs" caption underneath keeps the exact number visible
/// too — the fill alone reads at a glance but isn't precise, and doesn't
/// duplicate Dashboard's own "X / 100 hrs toward the Y test" callout since
/// this one omits the test name and sits in a much smaller space (see
/// CaptureViewModel.confirmedHours's doc comment for where the figure comes
/// from). Both the fill and the number animate off one shared
/// `animatedHours` value (raw hours, not the 0-1 fraction) so they're
/// always in lockstep — eases in from empty on first appearance and eases
/// to a new value whenever `confirmedHours` changes (e.g. right after
/// confirming an entry) instead of snapping, so the sweep and the count-up
/// both read as motion — see Android's TitleWordmark in CaptureScreen.kt
/// for the equivalent. A continuous brass shimmer loops through the filled
/// portion on top of that two-tone gradient — the gradient alone reads as
/// static styling once it stops moving, so the shimmer is what actually
/// keeps the letters legible as a *live* indicator rather than a one-time
/// paint job.
private struct TitleWordmark: View {
    let confirmedHours: Double
    private let thresholdHours = MaterialParticipationTest.thresholdHours

    @State private var animatedHours: Double = 0
    @State private var shimmerT: CGFloat = -0.6
    @Environment(\.contempoPalette) private var palette

    private var progress: Double {
        min(1, max(0, animatedHours / Double(thresholdHours)))
    }

    private var stops: [Gradient.Stop] {
        let p = progress
        let feather = 0.06
        return [
            Gradient.Stop(color: palette.pine, location: 0),
            Gradient.Stop(color: palette.pine, location: min(1, max(0, p - feather))),
            Gradient.Stop(color: palette.inkFaint, location: min(1, max(0, p + feather))),
            Gradient.Stop(color: palette.inkFaint, location: 1),
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Contempo")
                .font(ContempoFont.headlineMedium())
                .foregroundStyle(LinearGradient(stops: stops, startPoint: .leading, endPoint: .trailing))
                .overlay(alignment: .leading) {
                    // Confined to the filled fraction via the HStack below
                    // (filled-width rect + a Color.clear remainder, so the
                    // overlay always spans the full wordmark width the way
                    // `.overlay` expects), then clipped to just the glyph
                    // pixels via `.mask` so the sweep only ever tints
                    // already-earned letters, never the surrounding padding
                    // or the muted portion.
                    GeometryReader { proxy in
                        HStack(spacing: 0) {
                            Rectangle()
                                .fill(
                                    LinearGradient(
                                        colors: [.clear, palette.brass, .clear],
                                        startPoint: UnitPoint(x: shimmerT - 0.25, y: 0.5),
                                        endPoint: UnitPoint(x: shimmerT + 0.25, y: 0.5)
                                    )
                                )
                                .frame(width: proxy.size.width * progress)
                            Color.clear
                        }
                    }
                    .mask {
                        Text("Contempo")
                            .font(ContempoFont.headlineMedium())
                    }
                    .allowsHitTesting(false)
                }
            Text("\(Int(animatedHours)) / \(thresholdHours) hrs")
                .font(ContempoFont.labelSmall())
                .foregroundStyle(palette.inkSoft)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9)) { animatedHours = confirmedHours }
            withAnimation(.linear(duration: 2.2).repeatForever(autoreverses: false)) {
                shimmerT = 1.6
            }
        }
        .onChange(of: confirmedHours) { _, newValue in
            withAnimation(.easeInOut(duration: 0.9)) { animatedHours = newValue }
        }
    }
}

/// One entry in the Capture quick-action row — see CaptureScreen.buildQuickActions/quickActionsRow.
private struct QuickAction: Identifiable {
    let id: String
    let icon: String
    let label: String
    var tint: Color?
    var tintBackground: Color?
    var disabled: Bool = false
    let action: () -> Void
}

private func stageLabel(_ stage: ParsingStage) -> String {
    switch stage {
    case .idle: return ""
    case .reading: return "Reading…"
    case .tryingOnDevice: return "Trying on-device…"
    case .fallingBackToCloud: return "Falling back to cloud…"
    case .structuring: return "Structuring…"
    }
}

/// Switches which hero widget CaptureScreen shows below it — the big
/// VoiceButton for `.audioFirst`, or `TypedCaptureHero` for `.typing`.
/// Segmented, same visual language as the language picker in Settings.
/// Session-only: see CaptureViewModel.captureMode's doc comment for why
/// this never writes back to Settings' persisted default. `order` puts the
/// user's chosen default on the left — see
/// CaptureViewModel.captureModeOrder's doc comment for why it's a fixed
/// snapshot, not re-derived from `selected` on every recomposition (that
/// would reorder the control itself every time the user taps the other
/// segment).
private struct CaptureModeToggle: View {
    let selected: CaptureMode
    let order: [CaptureMode]
    let onSelect: (CaptureMode) -> Void

    private func label(for mode: CaptureMode) -> String {
        switch mode {
        case .audioFirst: return "Audio-first"
        case .typing: return "Typing"
        }
    }

    var body: some View {
        Picker("Capture mode", selection: Binding(get: { selected }, set: onSelect)) {
            ForEach(order, id: \.self) { mode in
                Text(label(for: mode)).tag(mode)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal)
    }
}

/// The Typing hero — same text field/parsing-row/button-row content as the
/// old "Type instead" card, minus its ContempoCard wrapper and back-arrow:
/// typing is a primary capture mode now (see CaptureModeToggle above), not a
/// dismissible overlay on top of voice capture, so there's nothing to "go
/// back" from.
private struct TypedCaptureHero: View {
    let viewModel: CaptureViewModel
    let onDrafted: (ConfirmParams) -> Void
    var isFocused: FocusState<Bool>.Binding

    @Environment(\.contempoPalette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .topLeading) {
                // TextEditor has no built-in placeholder — overlay one
                // manually, matching Android's capture_hint copy/behavior.
                if viewModel.inputText.isEmpty {
                    Text("Say or type what you did…")
                        .font(ContempoFont.bodyLarge())
                        .foregroundStyle(palette.inkFaint)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 16)
                        .allowsHitTesting(false)
                }
                TextEditor(text: Binding(
                    get: { viewModel.inputText },
                    set: { viewModel.inputText = $0 }
                ))
                    .font(ContempoFont.bodyLarge())
                    .frame(minHeight: 120)
                    .padding(8)
                    .padding(.trailing, 36)
                    .scrollContentBackground(.hidden)
                    .focused(isFocused)
            }
            // Lets a "mostly typing, sometimes voice to save time" host drop
            // into the same field they're already typing in rather than
            // switching back to Audio-first mode — see DictationButton's
            // doc comment for why this is a separate mechanism from the main
            // VoiceButton flow (raw transcript only, no LLM parse).
            .overlay(alignment: .bottomTrailing) {
                DictationButton(
                    text: Binding(
                        get: { viewModel.inputText },
                        set: { viewModel.inputText = $0 }
                    ),
                    language: ServiceLocator.captureLanguageStore.selected,
                    enabled: !viewModel.isParsing
                )
                .padding(10)
            }
            .background(palette.paper)
            .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
            .overlay(
                RoundedRectangle(cornerRadius: ContempoRadius.medium)
                    .stroke(palette.hairline, lineWidth: 1)
            )

            if viewModel.isParsing {
                HStack(spacing: 8) {
                    ProgressView()
                    Text(stageLabel(viewModel.parsingStage))
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }
            }

            // Equal-width, icon+text buttons — same treatment as
            // OngoingActionButtonRow (see its doc comment): an untinted
            // `.bordered` button next to a pine `.borderedProminent` one
            // rendered as a plain-blue secondary button beside a
            // brand-colored primary one, which is what actually read as
            // "inconsistent," not just the left/Spacer/right layout.
            HStack(spacing: 8) {
                Button {
                    viewModel.manualEntry(onDrafted: onDrafted)
                } label: {
                    Label("Enter manually", systemImage: "square.and.pencil")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .tint(palette.inkSoft)

                Button {
                    viewModel.submit(onDrafted: onDrafted)
                } label: {
                    Label("Parse & Continue", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(palette.pine)
                .disabled(viewModel.isParsing || viewModel.inputText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .labelStyle(.titleAndIcon)
            .font(ContempoFont.labelLarge())
        }
    }
}

/// Compact Quick Capture status badge, next to the help button — replaced a
/// full-width box below the quick-action row (see git history) in response
/// to in-app feedback asking for exactly this placement. Shows one thing at
/// a time, by priority: the in-progress spinner (if the one-at-a-time
/// pipeline — see AudioCaptureProcessor — is currently working on
/// something), else today's still-waiting count, else today's completed
/// count. Tapping it triggers the same "process now" action the old row's
/// "Sync now" button did, when there's a backlog and nothing's already
/// mid-pipeline.
private struct QuickCaptureBadge: View {
    let status: QuickCaptureStatusUiState
    let onProcessNow: () -> Void

    @Environment(\.contempoPalette) private var palette

    private var canProcessNow: Bool { status.pendingCount > 0 && status.processingStage == nil }

    private var accessibilityText: String {
        let statusText: String
        if let stage = status.processingStage {
            statusText = stage.rawValue
        } else if status.pendingCount > 0 {
            statusText = "\(status.pendingCount) waiting"
        } else {
            statusText = "\(status.completedTodayCount) done today"
        }
        return canProcessNow ? "\(statusText). Process quick capture backlog now." : statusText
    }

    var body: some View {
        Group {
            if status.processingStage != nil {
                ProgressView()
                    .controlSize(.mini)
                    .tint(palette.pine)
            } else if status.pendingCount > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "clock")
                    Text("\(status.pendingCount)")
                }
                .foregroundStyle(palette.brass)
            } else {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark")
                    Text("\(status.completedTodayCount)")
                }
                .foregroundStyle(palette.pine)
            }
        }
        .font(ContempoFont.labelSmall())
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(palette.paperRaised)
        .clipShape(Capsule())
        .contentShape(Capsule())
        .onTapGesture { if canProcessNow { onProcessNow() } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
        .accessibilityAddTraits(canProcessNow ? .isButton : [])
    }
}


/// Hero VoiceButton: fixed 180pt circular button with animated volume bars during recording
private struct VoiceButton: View {
    let isRecording: Bool
    let isThinking: Bool
    let amplitude: Float
    let onClick: () -> Void

    @Environment(\.contempoPalette) private var palette

    private var buttonColor: Color {
        if isRecording { return palette.danger }
        if isThinking { return palette.brass }
        return palette.pine
    }

    var body: some View {
        ZStack {
            if isThinking {
                ProgressView()
                    .scaleEffect(2.2)
                    .frame(width: 200, height: 200)
            }

            Button(action: onClick) {
                ZStack {
                    Circle()
                        .fill(buttonColor)
                        .frame(width: 180, height: 180)
                        .shadow(color: buttonColor.opacity(0.3), radius: 12, x: 0, y: 6)

                    if isRecording {
                        VolumeBars(amplitude: amplitude, color: .white)
                    } else {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 64, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(isThinking)
        }
    }
}

/// Smaller companion to `VoiceButton` (64pt vs. its 180pt) for the two other
/// primary capture modes — big enough to read as a main action, not a
/// secondary/overflow one, while still keeping voice capture visually
/// dominant.
private struct QuickActionButton: View {
    let icon: String
    let label: String
    var tint: Color?
    var tintBackground: Color?
    let action: () -> Void

    @Environment(\.contempoPalette) private var palette

    var body: some View {
        Button(action: action) {
            // Fixed width (rather than sizing to the label's own text) so all
            // buttons in the row line up as a uniform, centered group
            // regardless of label length, so without this the icon circles
            // read as unevenly placed even though the HStack itself is
            // already centered in its parent.
            // Sized down from 84/64/24pt (see git history, and Android's
            // QuickActionButton for the matching change) — at the old size,
            // 3 buttons plus the HStack's spacing left little margin against
            // ViewThatFits's 2-row fallback on narrower phones/larger
            // Dynamic Type, which is what an in-app feedback report caught
            // on the Android side of this same shared design.
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(tintBackground ?? palette.pineTint)
                        .frame(width: 56, height: 56)
                    Image(systemName: icon)
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(tint ?? palette.pine)
                }
                Text(label)
                    .font(ContempoFont.labelSmall())
                    .foregroundStyle(palette.inkSoft)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(width: 76)
        }
        .buttonStyle(.plain)
    }
}

private struct VolumeBars: View {
    let amplitude: Float
    let color: Color

    var body: some View {
        HStack(alignment: .bottom, spacing: 6) {
            ForEach(0..<5, id: \.self) { index in
                VolumeBar(amplitude: amplitude, index: index, color: color)
            }
        }
        .frame(height: 48)
    }
}

private struct VolumeBar: View {
    let amplitude: Float
    let index: Int
    let color: Color
    @State private var phase: CGFloat = 0.25

    var body: some View {
        let fraction = min(1.0, max(0.15, phase * (0.45 + CGFloat(amplitude) * 0.75)))
        RoundedRectangle(cornerRadius: 3)
            .fill(color)
            .frame(width: 6, height: 48 * fraction)
            .onAppear {
                let duration = 0.42 + Double(index) * 0.09
                withAnimation(.linear(duration: duration).repeatForever(autoreverses: true)) {
                    phase = 1.0
                }
            }
    }
}

private struct ThinkingIndicator: View {
    let text: String
    @Environment(\.contempoPalette) private var palette

    init(_ text: String) { self.text = text }

    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
            Text(text)
                .font(ContempoFont.labelSmall())
                .foregroundStyle(palette.brass)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(palette.brassTint, in: Capsule())
    }
}

/// Surfaces a work timer left open by an earlier "start work" voice
/// utterance — without this, the only way to close it was another voice
/// utterance ("finished"), so a user who forgot the phrasing (or just
/// prefers a tap) had no visible way back into a capture already in
/// progress. `onComplete` is a dedicated button now (Pause/Complete/Cancel,
/// leading to trailing) rather than a whole-card tap gesture — the previous
/// "tap the card to finish" affordance had no visible cue and was reported
/// confusing. Once `isCompleted` (a brief window right after completing,
/// before this banner is torn down entirely — see CaptureScreen's
/// `timerJustCompleted`), the controls give way to a single "tap to add
/// details" affordance that opens EntryDetail for the entry that was just
/// closed, since its property/task/duration may still need filling in
/// (it's saved as pending review, not confirmed).
private struct OngoingWorkBanner: View {
    let entry: Entry
    let isCompleted: Bool
    let onComplete: () -> Void
    let onPauseToggle: () -> Void
    let onCancel: () -> Void
    let onTapCompleted: () -> Void
    @Environment(\.contempoPalette) private var palette

    private var isPaused: Bool { entry.isPaused == true }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // A plain container with `.onTapGesture` (rather than wrapping
            // the whole thing in a `Button`, as before) so the pause/
            // complete/cancel row below can hold normal sibling `Button`s —
            // nesting a real `Button` inside another `Button`'s label is
            // unsupported/flaky in SwiftUI.
            HStack(spacing: 12) {
                Image(systemName: isCompleted ? "checkmark" : "timer")
                    .font(.title2)
                    .foregroundStyle(palette.pine)
                VStack(alignment: .leading, spacing: 2) {
                    Text(entry.task.isEmpty ? (entry.propertyName.isEmpty ? "Work in progress" : entry.propertyName) : entry.task)
                        .font(ContempoFont.labelLarge())
                        .foregroundStyle(palette.ink)
                    elapsedText
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.inkFaint)
                }
                Spacer()
                if isCompleted {
                    Text("Tap to add details")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                } else if isPaused {
                    Text("Paused")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                } else {
                    Text("In progress")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                }
            }
            if !isCompleted {
                OngoingActionButtonRow(isPaused: isPaused, onPauseToggle: onPauseToggle, onComplete: onComplete, onCancel: onCancel)
            }
        }
        .padding()
        .background(palette.pineTint)
        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
        .overlay(
            RoundedRectangle(cornerRadius: ContempoRadius.medium)
                .stroke(palette.pine.opacity(0.3), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            if isCompleted { onTapCompleted() }
        }
    }

    /// Ticks live via `Text(date, style: .timer)` when running (the anchor is
    /// shifted forward by the accumulated paused duration so it reads correct
    /// *active* elapsed time). Frozen as static text while paused, mirroring
    /// TimerLiveActivity's same calculation. Once `isCompleted`, the entry's
    /// own activityDate/pausedDurationSeconds no longer change, so this reads
    /// the now-final `entry.durationMinutes` instead of ticking off a clock.
    @ViewBuilder
    private var elapsedText: some View {
        if isCompleted {
            Text(formatElapsedDuration(Double(entry.durationMinutes) * 60))
        } else {
            let pausedDurationSeconds = Double(entry.pausedDurationSeconds ?? 0)
            if isPaused, let pausedAt = entry.pausedAt?.dateValue() {
                let frozen = max(0, pausedAt.timeIntervalSince(entry.activityDate.dateValue()) - pausedDurationSeconds)
                Text(formatElapsedDuration(frozen))
            } else {
                Text(entry.activityDate.dateValue().addingTimeInterval(pausedDurationSeconds), style: .timer)
            }
        }
    }
}

/// The Pause/Complete/Cancel row shared by `OngoingWorkBanner` and
/// `OngoingTripBanner` — icon-only now to save on-screen space, but still a
/// real full-width `HStack` of standard, bounded `Button`s below the info
/// line, not three bare `Image`-only buttons with no `.frame()` at all
/// crammed into the same row as the title/elapsed-time/status text (that
/// gave each button a tap target no bigger than its rendered SF Symbol
/// glyph — well under Apple's 44x44pt minimum recommended target — and no
/// visible boundary showing where one tap target ended and the next
/// began). Standard `.bordered`/`.borderedProminent` styles still meet the
/// 44pt minimum and each button still gets roughly a third of the card's
/// width via `.frame(maxWidth: .infinity)`; only the visible text label is
/// gone — `.labelStyle(.iconOnly)` hides it on-screen while SwiftUI still
/// exposes each `Label`'s title text as its accessibility label
/// automatically, so VoiceOver users lose nothing.
private struct OngoingActionButtonRow: View {
    let isPaused: Bool
    let onPauseToggle: () -> Void
    let onComplete: () -> Void
    let onCancel: () -> Void
    @Environment(\.contempoPalette) private var palette

    var body: some View {
        HStack(spacing: 8) {
            Button(action: onPauseToggle) {
                Label(isPaused ? "Resume" : "Pause", systemImage: isPaused ? "play.fill" : "pause.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(palette.pine)

            Button(action: onComplete) {
                Label("Complete", systemImage: "checkmark")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .tint(palette.pine)

            Button(action: onCancel) {
                Label("Cancel", systemImage: "xmark")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(palette.danger)
        }
        .labelStyle(.iconOnly)
        .font(ContempoFont.labelLarge())
    }
}

private func formatElapsedDuration(_ seconds: TimeInterval) -> String {
    let total = Int(seconds)
    let hours = total / 3600
    let minutes = (total % 3600) / 60
    let secs = total % 60
    return hours > 0 ? String(format: "%d:%02d:%02d", hours, minutes, secs) : String(format: "%d:%02d", minutes, secs)
}

/// Mirrors OngoingWorkBanner above for a running mileage trip. `onComplete`
/// is a dedicated button now, same reasoning as OngoingWorkBanner's
/// `isCompleted` doc comment — GPS trips stop tracking immediately;
/// odometer trips instead launch the ending odometer photo capture, since
/// that's how that capture method actually closes a trip (see `isGps`), so
/// tapping Complete there doesn't itself trigger `isCompleted` until that
/// photo flow finishes closing the entry.
private struct OngoingTripBanner: View {
    let entry: Entry
    let isGps: Bool
    let isCompleted: Bool
    let onComplete: () -> Void
    let onPauseToggle: () -> Void
    let onCancel: () -> Void
    let onTapCompleted: () -> Void
    @Environment(\.contempoPalette) private var palette

    private var isPaused: Bool { entry.isPaused == true }

    var body: some View {
        // Same restructuring as OngoingWorkBanner — a plain container with
        // `.onTapGesture`, and the pause/complete/cancel row (now standard
        // sibling `Button`s in `OngoingActionButtonRow`, not a Button
        // wrapping everything) below the info line instead of squeezed into
        // the same row.
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: isCompleted ? "checkmark" : "location.fill")
                    .font(.title2)
                    .foregroundStyle(palette.pine)
                Text(isCompleted
                    ? String(format: "Trip — %.2f mi", entry.miles)
                    : String(format: "Trip in progress — %.2f mi", entry.miles))
                    .font(ContempoFont.labelLarge())
                    .foregroundStyle(palette.ink)
                Spacer()
                if isCompleted {
                    Text("Tap to add details")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                } else if isPaused {
                    Text("Paused")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                } else if isGps {
                    Text("GPS tracking")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                } else {
                    Text("Ends with an odometer photo")
                        .font(ContempoFont.labelSmall())
                        .foregroundStyle(palette.pine)
                }
            }
            if !isCompleted {
                OngoingActionButtonRow(isPaused: isPaused, onPauseToggle: onPauseToggle, onComplete: onComplete, onCancel: onCancel)
            }
        }
        .padding()
        .background(palette.pineTint)
        .clipShape(RoundedRectangle(cornerRadius: ContempoRadius.medium))
        .overlay(
            RoundedRectangle(cornerRadius: ContempoRadius.medium)
                .stroke(palette.pine.opacity(0.3), lineWidth: 1)
        )
        .contentShape(Rectangle())
        .onTapGesture {
            if isCompleted { onTapCompleted() }
        }
    }
}
