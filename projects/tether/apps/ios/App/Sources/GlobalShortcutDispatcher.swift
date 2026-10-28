import TetherKit
import UIKit

/// Centralized Global Hardware Keyboard Shortcut Dispatcher (PRD §13.1, §13.2).
/// Ensures identical, prioritized shortcut handling across primary (phone) and
/// external monitor windows so physical keyboards connected via Bluetooth,
/// USB-C, or Dock work 100% reliably regardless of first-responder state.
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

        // 1. Modals & Overlays dismiss via Escape
        if code == .keyboardEscape {
            if let palette = workspaceVC?.activeCommandPalette {
                palette.dismissPalette()
                return true
            }
            if let dialog = workspaceVC?.activeDialog {
                dialog.triggerCancelAction()
                return true
            }
            if workspaceVC?.activeHostsModal != nil ||
                workspaceVC?.activeSettingsModal != nil ||
                workspaceVC?.activeShortcutsModal != nil {
                workspaceVC?.dismissAllModals()
                return true
            }
            if let web = workspaceVC?.activeWebTabController(), web.isAddressBarActive {
                web.deactivateAddressBar()
                return true
            }
            // If in terminal, allow Escape to route to terminal
            return false
        }

        // 2. Command Palette: Cmd+K, Cmd+P, Ctrl+K
        if (isCmd && !isAlt && (char == "k" || char == "p")) || (isCtrl && !isAlt && char == "k") {
            workspaceVC?.openCommandPalette()
            return true
        }

        // 3. Shortcuts Cheat Sheet: Cmd+/, Cmd+?
        if isCmd && !isAlt && (key.characters == "/" || key.characters == "?") {
            workspaceVC?.openKeyboardShortcutsTapped()
            return true
        }

        // 4. Settings: Cmd+, or Ctrl+,
        if (isCmd || isCtrl) && !isAlt && (char == "," || key.characters == ",") {
            workspaceVC?.openSettingsTapped()
            return true
        }

        // 5. Workspaces:
        // Next Workspace: Ctrl+RightArrow, Cmd+Option+RightArrow, Ctrl+Option+]
        if (isCtrl && !isAlt && code == .keyboardRightArrow) ||
            (isCmd && isAlt && code == .keyboardRightArrow) ||
            (isCtrl && isAlt && key.characters == "]") {
            store.nextWorkspace()
            return true
        }
        // Prev Workspace: Ctrl+LeftArrow, Cmd+Option+LeftArrow, Ctrl+Option+[
        if (isCtrl && !isAlt && code == .keyboardLeftArrow) ||
            (isCmd && isAlt && code == .keyboardLeftArrow) ||
            (isCtrl && isAlt && key.characters == "[") {
            store.prevWorkspace()
            return true
        }
        // Direct Workspace Jump: Cmd+Option+1..4
        if isCmd && isAlt {
            switch char {
            case "1": store.switchToWorkspace(at: 0); return true
            case "2": store.switchToWorkspace(at: 1); return true
            case "3": store.switchToWorkspace(at: 2); return true
            case "4": store.switchToWorkspace(at: 3); return true
            default: break
            }
        }

        // 6. Pane Cycling:
        // Next Pane: Cmd+Option+], Ctrl+`, Ctrl+~, F6 (without shift)
        if (isCmd && isAlt && key.characters == "]") ||
            (isCtrl && !isAlt && (key.characters == "`" || key.characters == "~")) ||
            (code == .keyboardF6 && !isShift) {
            store.cyclePanes(reverse: false)
            return true
        }
        // Prev Pane: Cmd+Option+[, Ctrl+Shift+~, Ctrl+Shift+`, F6 (with shift)
        if (isCmd && isAlt && key.characters == "[") ||
            (isCtrl && isShift && (key.characters == "~" || key.characters == "`")) ||
            (code == .keyboardF6 && isShift) {
            store.cyclePanes(reverse: true)
            return true
        }

        // 7. Directional Pane Focus: Cmd+Option+Arrows or Ctrl+Option+Arrows
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

        // 8. Splitting & Pane Management:
        // Split Vertically (Left/Right side-by-side): Cmd+D or Cmd+Option+\ or Ctrl+Option+\
        if (isCmd && !isShift && !isAlt && char == "d") ||
            (((isCmd && isAlt) || (isCtrl && isAlt)) && (key.characters == "\\" || key.characters == "|")) {
            store.splitFocusedPane(.horizontal)
            return true
        }
        // Split Horizontally (Top/Bottom): Cmd+Shift+D or Cmd+Option+- or Ctrl+Option+-
        if (isCmd && isShift && !isAlt && char == "d") ||
            (((isCmd && isAlt) || (isCtrl && isAlt)) && (key.characters == "-" || key.characters == "_")) {
            store.splitFocusedPane(.vertical)
            return true
        }
        // Close Focused Pane: Cmd+Shift+W or Cmd+Option+W or Ctrl+Option+W
        if (isCmd && isShift && !isAlt && char == "w") ||
            (((isCmd && isAlt) || (isCtrl && isAlt)) && char == "w") {
            store.closePane()
            return true
        }
        // Toggle Maximise: Cmd+Shift+M
        if isCmd && isShift && !isAlt && char == "m" {
            store.toggleMaximiseFocusedPane()
            return true
        }
        // Swap Panes: Cmd+Option+S or Ctrl+Option+S
        if ((isCmd && isAlt) || (isCtrl && isAlt)) && char == "s" {
            store.swapFocusedWithNext()
            return true
        }

        // 9. Layout Presets: Cmd+1..4 or Ctrl+Alt+1..4
        if (isCmd && !isAlt && !isShift) || (isCtrl && isAlt) {
            switch char {
            case "1": store.applyPreset(.single); return true
            case "2": store.applyPreset(.twoColumn); return true
            case "3": store.applyPreset(.leftPlusTwoRight); return true
            case "4": store.applyPreset(.twoByTwo); return true
            default: break
            }
        }

        // 10. Tab Management:
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
        // Cycle Tabs in Pane: Ctrl+Tab (next), Ctrl+Shift+Tab (prev)
        if isCtrl && !isAlt && code == .keyboardTab {
            store.tree = PaneTreeOps.selectNextTab(store.tree, reverse: isShift)
            return true
        }

        // 11. Browser / Web Tab Controls:
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

        // 12. Terminal Ctrl Keys (PRD §13.2)
        // If the focused tab is SSH terminal and user pressed Ctrl+<key> (without Command):
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
            // Command Palette
            UIKeyCommand(title: "Command Palette", action: #selector(TilingWorkspaceViewController.openCommandPalette), input: "k", modifierFlags: [.command]),
            UIKeyCommand(title: "Command Palette", action: #selector(TilingWorkspaceViewController.openCommandPalette), input: "p", modifierFlags: [.command]),
            UIKeyCommand(title: "Command Palette", action: #selector(TilingWorkspaceViewController.openCommandPalette), input: "k", modifierFlags: [.control]),

            // Shortcuts Cheat Sheet
            UIKeyCommand(title: "Keyboard Shortcuts", action: #selector(TilingWorkspaceViewController.openKeyboardShortcutsTapped), input: "/", modifierFlags: [.command]),
            UIKeyCommand(title: "Keyboard Shortcuts", action: #selector(TilingWorkspaceViewController.openKeyboardShortcutsTapped), input: "?", modifierFlags: [.command]),

            // Workspaces
            UIKeyCommand(title: "Next Workspace", action: #selector(TilingWorkspaceViewController.nextWorkspaceKey), input: UIKeyCommand.inputRightArrow, modifierFlags: [.control]),
            UIKeyCommand(title: "Previous Workspace", action: #selector(TilingWorkspaceViewController.prevWorkspaceKey), input: UIKeyCommand.inputLeftArrow, modifierFlags: [.control]),
            UIKeyCommand(title: "Next Workspace (Mac)", action: #selector(TilingWorkspaceViewController.nextWorkspaceKey), input: UIKeyCommand.inputRightArrow, modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Previous Workspace (Mac)", action: #selector(TilingWorkspaceViewController.prevWorkspaceKey), input: UIKeyCommand.inputLeftArrow, modifierFlags: [.command, .alternate]),

            // Panes
            UIKeyCommand(title: "Cycle Next Pane", action: #selector(TilingWorkspaceViewController.cycleNextPaneKey), input: "]", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Cycle Previous Pane", action: #selector(TilingWorkspaceViewController.cyclePrevPaneKey), input: "[", modifierFlags: [.command, .alternate]),
            UIKeyCommand(title: "Cycle Next Pane", action: #selector(TilingWorkspaceViewController.cycleNextPaneKey), input: "`", modifierFlags: [.control]),
            UIKeyCommand(title: "Cycle Previous Pane", action: #selector(TilingWorkspaceViewController.cyclePrevPaneKey), input: "~", modifierFlags: [.control]),

            UIKeyCommand(title: "Split Vertically", action: #selector(TilingWorkspaceViewController.splitHorizontalTapped), input: "d", modifierFlags: [.command]),
            UIKeyCommand(title: "Split Horizontally", action: #selector(TilingWorkspaceViewController.splitVerticalTapped), input: "d", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Close Focused Pane", action: #selector(TilingWorkspaceViewController.closeFocusedPaneKey), input: "w", modifierFlags: [.command, .shift]),
            UIKeyCommand(title: "Toggle Maximise Pane", action: #selector(TilingWorkspaceViewController.maximisePaneTapped), input: "m", modifierFlags: [.command, .shift]),

            // Tabs
            UIKeyCommand(title: "New Tab", action: #selector(TilingWorkspaceViewController.newTabKey), input: "t", modifierFlags: [.command]),
            UIKeyCommand(title: "Close Tab", action: #selector(TilingWorkspaceViewController.closeActiveTabKey), input: "w", modifierFlags: [.command]),
            UIKeyCommand(title: "Focus Address Bar", action: #selector(TilingWorkspaceViewController.focusAddressBarKey), input: "l", modifierFlags: [.command]),
            UIKeyCommand(title: "Reload Page", action: #selector(TilingWorkspaceViewController.reloadWebKey), input: "r", modifierFlags: [.command]),

            // Presets
            UIKeyCommand(title: "Preset 1: Single", action: #selector(TilingWorkspaceViewController.presetSingleTapped), input: "1", modifierFlags: [.command]),
            UIKeyCommand(title: "Preset 2: Two Columns", action: #selector(TilingWorkspaceViewController.presetTwoColTapped), input: "2", modifierFlags: [.command]),
            UIKeyCommand(title: "Preset 3: 1+2 Panes", action: #selector(TilingWorkspaceViewController.presetLeftTwoRightTapped), input: "3", modifierFlags: [.command]),
            UIKeyCommand(title: "Preset 4: 2x2 Grid", action: #selector(TilingWorkspaceViewController.presetGridTapped), input: "4", modifierFlags: [.command]),

            // Settings
            UIKeyCommand(title: "Open Settings", action: #selector(TilingWorkspaceViewController.openSettingsTapped), input: ",", modifierFlags: [.command]),
        ]
    }
}
