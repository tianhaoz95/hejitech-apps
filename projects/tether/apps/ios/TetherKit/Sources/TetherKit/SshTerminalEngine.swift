import CryptoKit
import Foundation
import Network

/// ANSI / xterm-256color terminal cell attributes.
public struct TerminalCell: Equatable, Sendable {
    public var char: Character
    public var fgColorIndex: Int? // nil = default fg, 0..255 = xterm-256color index
    public var bgColorIndex: Int? // nil = default bg, 0..255 = xterm-256color index
    public var bold: Bool
    public var underline: Bool

    public init(
        char: Character = " ",
        fgColorIndex: Int? = nil,
        bgColorIndex: Int? = nil,
        bold: Bool = false,
        underline: Bool = false
    ) {
        self.char = char
        self.fgColorIndex = fgColorIndex
        self.bgColorIndex = bgColorIndex
        self.bold = bold
        self.underline = underline
    }
}

/// Full `xterm-256color` terminal buffer supporting:
/// - UTF-8 stream decoding
/// - 256-color SGR (`\x1b[...m`, including `38;5;n` and `48;5;n`)
/// - Cursor positioning (`H`, `f`, `A`, `B`, `C`, `D`, `J`, `K`)
/// - Alternate screen buffer (`\x1b[?1049h` / `\x1b[?1049l`) for `vim`, `htop`, `less`, `tmux`
/// - Scrollback buffer of >= 10,000 lines (PRD §10.4)
/// - Dynamic PTY `window-change` resize (`cols`, `rows`)
public final class TerminalEmulatorBuffer: @unchecked Sendable {
    public private(set) var cols: Int
    public private(set) var rows: Int
    public let maxScrollbackLines: Int
    public private(set) var isAlternateScreen: Bool = false
    public private(set) var cursorRow: Int = 0
    public private(set) var cursorCol: Int = 0

    public private(set) var scrollback: [String] = []
    public private(set) var primaryGrid: [[TerminalCell]]
    public private(set) var alternateGrid: [[TerminalCell]]
    private var savedPrimaryCursor: (row: Int, col: Int) = (0, 0)

    private var currentFg: Int?
    private var currentBg: Int?
    private var currentBold: Bool = false
    private var currentUnderline: Bool = false

    public var onWindowChange: ((_ cols: Int, _ rows: Int) -> Void)?

    public init(
        cols: Int = 80,
        rows: Int = 24,
        maxScrollbackLines: Int = TetherConstants.minScrollbackLines
    ) {
        self.cols = max(20, cols)
        self.rows = max(5, rows)
        self.maxScrollbackLines = max(TetherConstants.minScrollbackLines, maxScrollbackLines)
        self.primaryGrid = Array(
            repeating: Array(repeating: TerminalCell(), count: self.cols),
            count: self.rows
        )
        self.alternateGrid = Array(
            repeating: Array(repeating: TerminalCell(), count: self.cols),
            count: self.rows
        )
    }

    public var activeGrid: [[TerminalCell]] {
        get { isAlternateScreen ? alternateGrid : primaryGrid }
        set {
            if isAlternateScreen {
                alternateGrid = newValue
            } else {
                primaryGrid = newValue
            }
        }
    }

    /// Resizes the terminal grid and triggers a PTY `window-change` callback (PRD §10.4).
    public func resize(cols newCols: Int, rows newRows: Int) {
        let clampedCols = max(20, newCols)
        let clampedRows = max(5, newRows)
        guard clampedCols != cols || clampedRows != rows else { return }

        func resizeGrid(_ grid: [[TerminalCell]]) -> [[TerminalCell]] {
            var next = Array(
                repeating: Array(repeating: TerminalCell(), count: clampedCols),
                count: clampedRows
            )
            for r in 0..<min(grid.count, clampedRows) {
                for c in 0..<min(grid[r].count, clampedCols) {
                    next[r][c] = grid[r][c]
                }
            }
            return next
        }

        primaryGrid = resizeGrid(primaryGrid)
        alternateGrid = resizeGrid(alternateGrid)
        cols = clampedCols
        rows = clampedRows
        cursorRow = min(cursorRow, rows - 1)
        cursorCol = min(cursorCol, cols - 1)
        onWindowChange?(cols, rows)
    }

    public func clearScrollback() {
        scrollback.removeAll()
        primaryGrid = Array(
            repeating: Array(repeating: TerminalCell(), count: cols),
            count: rows
        )
        cursorRow = 0
        cursorCol = 0
    }

    /// Feeds UTF-8 text (including ANSI CSI / DECSET escape sequences) into the terminal buffer.
    public func feed(_ text: String) {
        var idx = text.startIndex
        while idx < text.endIndex {
            let ch = text[idx]
            if ch == "\u{1B}" {
                let nextIdx = text.index(after: idx)
                if nextIdx < text.endIndex && text[nextIdx] == "[" {
                    // Parse CSI sequence: \x1b[ ... <final byte 0x40..0x7E>
                    var seqIdx = text.index(after: nextIdx)
                    var params = ""
                    var finalChar: Character?
                    while seqIdx < text.endIndex {
                        let c = text[seqIdx]
                        if let ascii = c.asciiValue, ascii >= 0x40 && ascii <= 0x7E {
                            finalChar = c
                            seqIdx = text.index(after: seqIdx)
                            break
                        }
                        params.append(c)
                        seqIdx = text.index(after: seqIdx)
                    }
                    if let finalChar {
                        handleCSI(params: params, finalChar: finalChar)
                    }
                    idx = seqIdx
                    continue
                }
            }
            putChar(ch)
            idx = text.index(after: idx)
        }
    }

    private func handleCSI(params: String, finalChar: Character) {
        if params.hasPrefix("?") {
            let privNum = Int(params.dropFirst()) ?? 0
            if privNum == 1049 || privNum == 47 || privNum == 1047 {
                if finalChar == "h" && !isAlternateScreen {
                    savedPrimaryCursor = (cursorRow, cursorCol)
                    isAlternateScreen = true
                    alternateGrid = Array(
                        repeating: Array(repeating: TerminalCell(), count: cols),
                        count: rows
                    )
                    cursorRow = 0
                    cursorCol = 0
                } else if finalChar == "l" && isAlternateScreen {
                    isAlternateScreen = false
                    cursorRow = min(savedPrimaryCursor.row, rows - 1)
                    cursorCol = min(savedPrimaryCursor.col, cols - 1)
                }
            }
            return
        }

        let nums = params.split(separator: ";", omittingEmptySubsequences: false).map { Int($0) ?? 0 }
        switch finalChar {
        case "m":
            applySGR(nums.isEmpty ? [0] : nums)
        case "H", "f":
            let r = max(1, nums.first ?? 1) - 1
            let c = max(1, nums.count > 1 ? nums[1] : 1) - 1
            cursorRow = min(rows - 1, max(0, r))
            cursorCol = min(cols - 1, max(0, c))
        case "A":
            cursorRow = max(0, cursorRow - max(1, nums.first ?? 1))
        case "B":
            cursorRow = min(rows - 1, cursorRow + max(1, nums.first ?? 1))
        case "C":
            cursorCol = min(cols - 1, cursorCol + max(1, nums.first ?? 1))
        case "D":
            cursorCol = max(0, cursorCol - max(1, nums.first ?? 1))
        case "J":
            let mode = nums.first ?? 0
            if mode == 2 || mode == 3 {
                activeGrid = Array(
                    repeating: Array(repeating: TerminalCell(), count: cols),
                    count: rows
                )
                cursorRow = 0
                cursorCol = 0
            }
        case "K":
            var grid = activeGrid
            for c in cursorCol..<cols {
                grid[cursorRow][c] = TerminalCell()
            }
            activeGrid = grid
        default:
            break
        }
    }

    private func applySGR(_ codes: [Int]) {
        var i = 0
        while i < codes.count {
            let code = codes[i]
            switch code {
            case 0:
                currentFg = nil
                currentBg = nil
                currentBold = false
                currentUnderline = false
            case 1:
                currentBold = true
            case 4:
                currentUnderline = true
            case 22:
                currentBold = false
            case 24:
                currentUnderline = false
            case 30...37:
                currentFg = code - 30
            case 39:
                currentFg = nil
            case 40...47:
                currentBg = code - 40
            case 49:
                currentBg = nil
            case 90...97:
                currentFg = (code - 90) + 8
            case 100...107:
                currentBg = (code - 100) + 8
            case 38:
                if i + 2 < codes.count && codes[i + 1] == 5 {
                    currentFg = min(255, max(0, codes[i + 2]))
                    i += 2
                }
            case 48:
                if i + 2 < codes.count && codes[i + 1] == 5 {
                    currentBg = min(255, max(0, codes[i + 2]))
                    i += 2
                }
            default:
                break
            }
            i += 1
        }
    }

    private func putChar(_ ch: Character) {
        if ch == "\r" {
            cursorCol = 0
            return
        }
        if ch == "\n" {
            advanceLine()
            return
        }
        if ch == "\u{08}" {
            cursorCol = max(0, cursorCol - 1)
            return
        }
        if cursorCol >= cols {
            cursorCol = 0
            advanceLine()
        }
        var grid = activeGrid
        grid[cursorRow][cursorCol] = TerminalCell(
            char: ch,
            fgColorIndex: currentFg,
            bgColorIndex: currentBg,
            bold: currentBold,
            underline: currentUnderline
        )
        activeGrid = grid
        cursorCol += 1
    }

    private func advanceLine() {
        if cursorRow + 1 < rows {
            cursorRow += 1
            return
        }
        var grid = activeGrid
        let topRow = grid.removeFirst()
        if !isAlternateScreen {
            let lineStr = String(topRow.map(\.char)).replacingOccurrences(
                of: #"\s+$"#,
                with: "",
                options: .regularExpression
            )
            scrollback.append(lineStr)
            if scrollback.count > maxScrollbackLines {
                scrollback.removeFirst(scrollback.count - maxScrollbackLines)
            }
        }
        grid.append(Array(repeating: TerminalCell(), count: cols))
        activeGrid = grid
    }

    /// Renders the scrollback + active screen lines into plain text for display / inspection.
    public func renderedLines(includeScrollback: Bool = true) -> [String] {
        var activeLines = activeGrid.map { row in
            String(row.map(\.char)).replacingOccurrences(
                of: #"\s+$"#,
                with: "",
                options: .regularExpression
            )
        }
        if !isAlternateScreen {
            // In standard streaming shell mode, trim unused trailing blank rows so the shell prompt
            // and content sit naturally right below each other rather than being padded with 20+ empty lines.
            while activeLines.count > (cursorRow + 1) && activeLines.last?.isEmpty == true {
                activeLines.removeLast()
            }
            while activeLines.last?.isEmpty == true && activeLines.count > 1 {
                activeLines.removeLast()
            }
            if includeScrollback {
                return scrollback + activeLines
            }
            return activeLines
        }
        if includeScrollback && !isAlternateScreen {
            return scrollback + activeLines
        }
        return activeLines
    }
}
