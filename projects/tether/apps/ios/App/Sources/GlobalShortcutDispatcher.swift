import TetherKit
import UIKit

/// Centralized Global Hardware Keyboard Shortcut Dispatcher (PRD §13.1, §13.2).
/// Ensures non-colliding modifier chords (⌃ for workspaces, ⌘ for panes, ⌘⌥ for tabs, ⌃⌥ for presets)
/// and interactive modal states (Leader, Resize, Swap, Tab Switcher) operate 100% reliably.
@MainActor
public enum GlobalShortcutDispatcher {

    /// Processes a single hardware key press event.
    /// Returns `true` if the key press matched a global shortcut and was handled.
    public static func handlePress(
        press: UIPress,
        store: WorkspaceStore,
        workspaceVC: TilingWorkspaceViewController?
    ) -> Bool {
        guard let key = press.key else { return false }
        let flags = key.modifierFlags
        let isCmd = flags.contains(.command)
        let isCtrl = flags.contains(.control)
        let isAlt = flags.contains(.alternate)
        let isShift = flags.contains(.shift)
        let code = key.keyCode
        let char = key.charactersIgnoringModifiers.lowercased()

        // 1. Modals, Overlays, and Modes dismiss via Escape
        if code == .keyboardEscape {
            if let vc = workspaceVC {
                if vc.currentInteractionMode != .normal {
                    vc.returnToNormalMode()
                    return true
                }
                if let switcher = vc.activeTabSwitcher {
                    switcher.cancel()
                    return true
                }
                if let palette = vc.activeCommandPalette {
                    palette.dismissPalette()
                    return true
                }
                if let dialog = vc.activeDialog {
                    dialog.triggerCancelAction()
                    return true
                }
                if vc.activeHostsModal != nil ||
                    vc.activeSettingsModal != nil ||
                    vc.activeShortcutsModal != nil {
                    vc.dismissAllModals()
                    return true
                }
                if let web = vc.activeWebTabController(), web.isAddressBarActive {
                    web.deactivateAddressBar()
                    return true
                }
            }
            return false
        }

        // 2. Active Mode Handling (Resize, Swap, Leader)
        if let vc = workspaceVC {
            switch vc.currentInteractionMode {
            case .resize:
                if code == .keyboardLeftArrow {
                    store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: isShift ? -0.01 : -0.05)
                    vc.updateResizeHud()
                    return true
                } else if code == .keyboardRightArrow {
                    store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: isShift ? 0.01 : 0.05)
                    vc.updateResizeHud()
                    return true
                } else if code == .keyboardReturnOrEnter {
                    vc.returnToNormalMode()
                    return true
                }
            case .swap:
                switch code {
                case .keyboardLeftArrow:
                    store.swapDirectional(.left)
                    vc.returnToNormalMode()
                    return true
                case .keyboardRightArrow:
                    store.swapDirectional(.right)
                    vc.returnToNormalMode()
                    return true
                case .keyboardUpArrow:
                    store.swapDirectional(.up)
                    vc.returnToNormalMode()
                    return true
                case .keyboardDownArrow:
                    store.swapDirectional(.down)
                    vc.returnToNormalMode()
                    return true
                case .keyboard1:
                    if store.panes.indices.contains(0) { store.swapPanes(store.tree.focusedPaneId, store.panes[0].id) }
                    vc.returnToNormalMode()
                    return true
                case .keyboard2:
                    if store.panes.indices.contains(1) { store.swapPanes(store.tree.focusedPaneId, store.panes[1].id) }
                    vc.returnToNormalMode()
                    return true
                case .keyboard3:
                    if store.panes.indices.contains(2) { store.swapPanes(store.tree.focusedPaneId, store.panes[2].id) }
                    vc.returnToNormalMode()
                    return true
                case .keyboard4:
                    if store.panes.indices.contains(3) { store.swapPanes(store.tree.focusedPaneId, store.panes[3].id) }
                    vc.returnToNormalMode()
                    return true
                default:
                    break
                }
            case .leader:
                switch char {
                case "v", "d":
                    store.splitFocusedPane(.horizontal)
                    vc.returnToNormalMode()
                    return true
                case "h":
                    store.splitFocusedPane(.vertical)
                    vc.returnToNormalMode()
                    return true
                case "w":
                    store.closePane()
                    vc.returnToNormalMode()
                    return true
                case "m":
                    store.toggleMaximiseFocusedPane()
                    vc.returnToNormalMode()
                    return true
                case "r":
                    vc.enterResizeMode()
                    return true
                case "s", "p":
                    vc.enterSwapMode()
                    return true
                case "t":
                    store.openTab(type: .web)
                    vc.returnToNormalMode()
                    return true
                case "1": store.switchToWorkspace(at: 0); vc.returnToNormalMode(); return true
                case "2": store.switchToWorkspace(at: 1); vc.returnToNormalMode(); return true
                case "3": store.switchToWorkspace(at: 2); vc.returnToNormalMode(); return true
                case "4": store.switchToWorkspace(at: 3); vc.returnToNormalMode(); return true
                default:
                    vc.returnToNormalMode()
                    return true
                }
            case .normal:
                break
            }
        }

        // 3. Tab Switcher Overlay Active Handling (Enter commits, Ctrl+Tab steps)
        if let switcher = workspaceVC?.activeTabSwitcher {
            if code == .keyboardReturnOrEnter {
                switcher.commitSelection()
                return true
            }
            if isCtrl && code == .keyboardTab {
                switcher.step(reverse: isShift)
                return true
            }
        }

        // 4. Tab Switcher Overlay Trigger: Ctrl+Tab
        if isCtrl && !isCmd && !isAlt && code == .keyboardTab {
            workspaceVC?.showTabSwitcher(reverse: isShift)
            return true
        }

        // 5. Leader Mode Trigger: Ctrl+Space or Ctrl+B
        if (isCtrl && !isCmd && !isAlt && (code == .keyboardSpacebar || char == "b")) {
            workspaceVC?.enterLeaderMode()
            return true
        }

        // 6. Resizer HUD Trigger: Cmd+Option+R
        if isCmd && isAlt && !isCtrl && char == "r" {
            workspaceVC?.enterResizeMode()
            return true
        }

        // 7. Swap Mode Trigger: Cmd+Option+S
        if isCmd && isAlt && !isCtrl && char == "s" {
            workspaceVC?.enterSwapMode()
            return true
        }

        // 8. Focus History (MRU Flip Jump-Back): Cmd+Option+O
        if isCmd && isAlt && !isCtrl && char == "o" {
            store.focusPreviousPane()
            return true
        }

        // 9. Command Palette & Tab Search:
        // Dedicated Tab Search: Cmd+P
        if isCmd && !isAlt && !isCtrl && char == "p" {
            workspaceVC?.openTabPalette()
            return true
        }
        // General Command Palette: Cmd+K or Ctrl+K
        if (isCmd && !isAlt && char == "k") || (isCtrl && !isAlt && char == "k") {
            workspaceVC?.openCommandPalette()
            return true
        }

        // 10. Shortcuts Cheat Sheet: Cmd+/, Cmd+?
        if isCmd && !isAlt && (key.characters == "/" || key.characters == "?") {
            workspaceVC?.openKeyboardShortcutsTapped()
            return true
        }

        // 11. Settings: Cmd+, or Ctrl+,
        if (isCmd || isCtrl) && !isAlt && (char == "," || key.characters == ",") {
            workspaceVC?.openSettingsTapped()
            return true
        }

        // 12. Hosts & Keys: Cmd+Shift+H
        if (isCmd || isCtrl) && isShift && char == "h" {
            workspaceVC?.openHostsTapped()
            return true
        }

        // 13. Non-colliding numbered shortcuts:
        // A. WORKSPACES: Ctrl+1..4 (Control ONLY)
        if isCtrl && !isCmd && !isAlt && !isShift {
            switch char {
            case "1": store.switchToWorkspace(at: 0); return true
            case "2": store.switchToWorkspace(at: 1); return true
            case "3": store.switchToWorkspace(at: 2); return true
            case "4": store.switchToWorkspace(at: 3); return true
            default: break
            }
        }

        // B. PANES: Cmd+1..4 (Command ONLY)
        if isCmd && !isCtrl && !isAlt && !isShift {
            switch char {
            case "1": store.focusPaneIndex(0); return true
            case "2": store.focusPaneIndex(1); return true
            case "3": store.focusPaneIndex(2); return true
            case "4": store.focusPaneIndex(3); return true
            default: break
            }
        }

        // C. TABS: Cmd+Option+1..9 (Command + Option)
        if isCmd && isAlt && !isCtrl && !isShift {
            switch char {
            case "1": store.selectTabAtIndex(0); return true
            case "2": store.selectTabAtIndex(1); return true
            case "3": store.selectTabAtIndex(2); return true
            case "4": store.selectTabAtIndex(3); return true
            case "5": store.selectTabAtIndex(4); return true
            case "6": store.selectTabAtIndex(5); return true
            case "7": store.selectTabAtIndex(6); return true
            case "8": store.selectTabAtIndex(7); return true
            case "9": store.selectTabAtIndex(8); return true
            default: break
            }
        }

        // D. PRESETS: Ctrl+Option+1..4 (Control + Option)
        if isCtrl && isAlt && !isCmd && !isShift {
            switch char {
            case "1": store.applyPreset(.single); return true
            case "2": store.applyPreset(.twoColumn); return true
            case "3": store.applyPreset(.leftPlusTwoRight); return true
            case "4": store.applyPreset(.twoByTwo); return true
            default: break
            }
        }

        // 14. Workspace Next / Prev
        if (isCtrl && !isAlt && code == .keyboardRightArrow) ||
            (isCmd && isAlt && code == .keyboardRightArrow) {
            store.nextWorkspace()
            return true
        }
        if (isCtrl && !isAlt && code == .keyboardLeftArrow) ||
            (isCmd && isAlt && code == .keyboardLeftArrow) {
            store.prevWorkspace()
            return true
        }

        // 15. Pane Cycling
        // Next Pane: Cmd+Option+], Ctrl+`, Ctrl+~, F6 (without shift)
        if (isCmd && isAlt && key.characters == "]") ||
            (isCtrl && !isAlt && (key.characters == "`" || key.characters == "~")) ||
            (code == .keyboardF6 && !isShift) {
            store.cyclePanes(reverse: false)
            return true
        }
        // Prev Pane: Cmd+Option+[, F6 (with shift)
        if (isCmd && isAlt && key.characters == "[") ||
            (code == .keyboardF6 && isShift) {
            store.cyclePanes(reverse: true)
            return true
        }

        // 16. Directional Pane Focus: Cmd+Option+Arrows or Ctrl+Option+Arrows
        if (isCmd && isAlt) || (isCtrl && isAlt) {
            switch code {
            case .keyboardLeftArrow:
                store.focusDirectional(.left)
                return true
            case .keyboardRightArrow:
                store.focusDirectional(.right)
                return true
            case .keyboardUpArrow:
                store.focusDirectional(.up)
                return true
            case .keyboardDownArrow:
                store.focusDirectional(.down)
                return true
            case .keyboardReturnOrEnter:
                store.toggleMaximiseFocusedPane()
                return true
            default:
                break
            }
        }

        // 17. Splitting & Pane Management:
        // Split Vertically (side-by-side): Cmd+D
        if isCmd && !isShift && !isAlt && char == "d" {
            store.splitFocusedPane(.horizontal)
            return true
        }
        // Split Horizontally (top/bottom): Cmd+Shift+D
        if isCmd && isShift && !isAlt && char == "d" {
            store.splitFocusedPane(.vertical)
            return true
        }
        // Close Focused Pane: Cmd+Shift+W
        if isCmd && isShift && !isAlt && char == "w" {
            store.closePane()
            return true
        }
        // Toggle Maximise: Cmd+Shift+M
        if isCmd && isShift && !isAlt && char == "m" {
            store.toggleMaximiseFocusedPane()
            return true
        }

        // 18. Split ratio adjustment:
        if isCmd && isAlt {
            if key.characters == "=" || key.characters == "+" {
                store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: 0.05)
                return true
            }
            if key.characters == "-" || key.characters == "_" {
                store.tree = PaneTreeOps.adjustParentSplitRatio(store.tree, delta: -0.05)
                return true
            }
            if char == "0" {
                if let fId = store.focusedPane?.id,
                   let split = PaneTreeOps.findParentSplit(store.tree.root, childPaneId: fId) {
                    store.tree = PaneTreeOps.updateSplitRatio(store.tree, splitId: split.id, ratio: 0.5)
                }
                return true
            }
        }

        // 19. Tab Management:
        // New Tab: Cmd+T
        if isCmd && !isAlt && !isShift && char == "t" {
            store.openTab(type: .web)
            return true
        }
        // Close Tab: Cmd+W
        if isCmd && !isAlt && !isShift && char == "w" {
            if workspaceVC?.activeCommandPalette != nil {
                workspaceVC?.activeCommandPalette?.dismissPalette()
            } else {
                store.closeTab()
            }
            return true
        }

        // 20. Browser / Web Tab Controls:
        if isCmd && !isAlt && !isShift && char == "l" {
            if let web = workspaceVC?.activeWebTabController() {
                web.focusAddressBar()
                return true
            }
        }
        if isCmd && !isAlt && !isShift && char == "r" {
            if let web = workspaceVC?.activeWebTabController() {
                web.reloadCurrentPage()
                return true
            }
        }

        // 21. Terminal Ctrl Keys (PRD §13.2)
        if isCtrl && !isCmd && !isAlt {
            let upper = char.uppercased()
            if ["C", "D", "Z", "L", "R", "A", "E", "K", "U", "W"].contains(upper) {
                if let sshVC = workspaceVC?.activeSshTabController() {
                    sshVC.sendControlKey(upper)
                    return true
                }
            }
        }

        return false
    }

    /// Builds a comprehensive list of UIKeyCommands for UIKit registration.
    public static func buildKeyCommands(target: AnyObject) -> [UIKeyCommand] {
        return [
            // Command Palette & Tab Search
            UIKeyCommand(title: "Command Palette", action: #selector(TilingWorkspaceViewController.openCommandPalette), input: "k", modifierFlags: [.command]),
            UIKeyCommand(title: "Tab Search", action: #selector(TilingWorkspaceViewController.openTabPalette), input: "p", modifierFlags: [.command]),
            UIKeyCommand(title: "Command Palette (Ctrl)", action: #selector(TilingWorkspaceViewController.openCommandPalette), input: "k", modifierFlags: [.control]),

            // Shortcuts Cheat Sheet
            UIKeyCommand(title: "Keyboard Shortcuts", action: #selector(TilingWorkspaceViewController.openKeyboardShortcutsTapped), input: "/", modifierFlags: [.command]),
            UIKeyCommand(title: "Keyboard Shortcuts", action: #selector(TilingWorkspaceViewController.openKeyboardShortcutsTapped), input: "?", modifierFlags: [.command]),

            // Workspaces (Control 1..4)
            UIKeyCommand(title: "Workspace 1", action: #selector(TilingWorkspaceViewController.jumpToWorkspace1), input: "1", modifierFlags: [.control]),
            UIKeyCommand(title: "Workspace 2", action: #selector(TilingWorkspaceViewController.jumpToWorkspace2), input: "2", modifierFlags: [.control]),
            UIKeyCommand(title: "Workspace 3", action: #selector(TilingWorkspaceViewController.jumpToWorkspace3), input: "3", modifierFlags: [.control]),
            UIKeyCommand(title: "Workspace 4", action: #selector(TilingWorkspaceViewController.jumpToWorkspace4), input: "4", modifierFlags: [.control]),
            UIKeyCommand(title: "Next Workspace", action: #selector(TilingWorkspaceViewController.nextWorkspaceKey), input: UIKeyCommand.inputRightArrow, modifierFlags: [.control]),
            UIKeyCommand(title: "Previous Workspace", action: #selector(TilingWorkspaceViewController.prevWorkspaceKey), input: UIKeyCommand.inputLeftArrow, modifierFlags: [.control]),

            // Panes (Command 1..4)
            UIKeyCommand(title: "Pane 1", action: #selector(TilingWorkspaceViewController.jumpToPane1), input: "1", modifierFlags: [.command]),
            UIKeyCommand(title: "Pane 2", action: #selector(TilingWorkspaceViewController.jumpToPane2), input: "2", modifierFlags: [.command]),
            UIKeyCommand(title: "Pane 3", action: #selector(TilingWorkspaceViewController.jumpToPane3), input: "3", modifierFlags: [.command]),
            UIKeyCommand(title: "Pane 4", action: #selector(TilingWorkspaceViewController.jumpToPane4), input: "4", modifierFlags: [.command]),

            // MRU Flip
            UIKeyCommand(title: "Previous Pane (MRU Flip)", action: #selector(TilingWorkspaceViewController.focusPreviousPaneKey), input: "o", modifierFlags: [.command, .alternate]),

            // Tabs in Active Pane (Command+Option 1..9)
            UIKeyCommand(title: "Tab 1", action: #selector(TilingWorkspaceViewController.jumpToTab1), input: "1", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 2", action: #selector(TilingWorkspaceViewController.jumpToTab2), input: "2", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 3", action: #selector(TilingWorkspaceViewController.jumpToTab3), input: "3", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 4", action: #selector(TilingWorkspaceViewController.jumpToTab4), input: "4", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 5", action: #selector(TilingWorkspaceViewController.jumpToTab5), input: "5", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 6", action: #selector(TilingWorkspaceViewController.jumpToTab6), input: "6", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 7", action: #selector(TilingWorkspaceViewController.jumpToTab7), input: "7", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 8", action: #selector(TilingWorkspaceViewController.jumpToTab8), input: "8", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Tab 9", action: #selector(TilingWorkspaceViewController.jumpToTab9), input: "9", modifierFlags: [.command, .alternate]),

            // Presets (Control+Option 1..4)
            UIKeyCommand(title: "Preset: Single", action: #selector(TilingWorkspaceViewController.presetSingleTapped), input: "1", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Preset: Two Columns", action: #selector(TilingWorkspaceViewController.presetTwoColTapped), input: "2", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Preset: 1+2 Panes", action: #selector(TilingWorkspaceViewController.presetLeftTwoRightTapped), input: "3", modifierFlags: [.control, .alternate]),
            UIKeyCommand(title: "Preset: 2x2 Grid", action: #selector(TilingWorkspaceViewController.presetGridTapped), input: "4", modifierFlags: [.control, .alternate]),

            // Interactive Modes
            UIKeyCommand(title: "Resize Mode", action: #selector(TilingWorkspaceViewController.enterResizeMode), input: "r", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Swap Mode", action: #selector(TilingWorkspaceViewController.enterSwapMode), input: "s", modifierFlags: [.command, .alternate]),

            // Pane cycling & splitting
            UIKeyCommand(title: "Cycle Next Pane", action: #selector(TilingWorkspaceViewController.cycleNextPaneKey), input: "]", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Cycle Previous Pane", action: #selector(TilingWorkspaceViewController.cyclePrevPaneKey), input: "[", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Split Vertically", action: #selector(TilingWorkspaceViewController.splitHorizontalTapped), input: "d", modifierFlags: [.command]),
            UIKeyCommand(title: "Split Horizontally", action: #selector(TilingWorkspaceViewController.splitVerticalTapped), input: "d", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Close Focused Pane", action: #selector(TilingWorkspaceViewController.closeFocusedPaneKey), input: "w", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Toggle Maximise Pane", action: #selector(TilingWorkspaceViewController.maximisePaneTapped), input: "m", modifierFlags: [.command, .shift]),

            // Tab actions
            UIKeyCommand(title: "New Tab", action: #selector(TilingWorkspaceViewController.newTabKey), input: "t", modifierFlags: [.command]),
            UIKeyCommand(title: "Close Tab", action: #selector(TilingWorkspaceViewController.closeActiveTabKey), input: "w", modifierFlags: [.command]),
            UIKeyCommand(title: "Focus Address Bar", action: #selector(TilingWorkspaceViewController.focusAddressBarKey), input: "l", modifierFlags: [.command]),
            UIKeyCommand(title: "Reload Page", action: #selector(TilingWorkspaceViewController.reloadWebKey), input: "r", modifierFlags: [.command]),

            // Settings & Hosts
            UIKeyCommand(title: "Open Settings", action: #selector(TilingWorkspaceViewController.openSettingsTapped), input: ",", modifierFlags: [.command]),
            UIKeyCommand(title: "Hosts & Keys", action: #selector(TilingWorkspaceViewController.openHostsTapped), input: "h", modifierFlags: [.command, .shift]),
        ]
    }
}
