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
    private var pendingEscape: String = ""

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

    /// Feeds UTF-8 text (including ANSI CSI / OSC / DECSET escape sequences) into the terminal buffer.
    public func feed(_ text: String) {
        let input: String
        if pendingEscape.isEmpty {
            input = text
        } else {
            input = pendingEscape + text
            pendingEscape = ""
        }
        var idx = input.startIndex
        while idx < input.endIndex {
            let ch = input[idx]
            if ch == "\u{1B}" {
                let nextIdx = input.index(after: idx)
                if nextIdx == input.endIndex {
                    pendingEscape = String(input[idx...])
                    return
                }
                let indicator = input[nextIdx]
                if indicator == "[" {
                    // Parse CSI sequence: \x1b[ ... <final byte 0x40..0x7E>
                    var seqIdx = input.index(after: nextIdx)
                    var params = ""
                    var finalChar: Character?
                    while seqIdx < input.endIndex {
                        let c = input[seqIdx]
                        if let ascii = c.asciiValue, ascii >= 0x40 && ascii <= 0x7E {
                            finalChar = c
                            seqIdx = input.index(after: seqIdx)
                            break
                        }
                        params.append(c)
                        seqIdx = input.index(after: seqIdx)
                    }
                    if let finalChar {
                        handleCSI(params: params, finalChar: finalChar)
                        idx = seqIdx
                        continue
                    } else {
                        // Incomplete CSI sequence split across chunks
                        if input.distance(from: idx, to: input.endIndex) < 64 {
                            pendingEscape = String(input[idx...])
                        }
                        return
                    }
                } else if indicator == "]" {
                    // Parse OSC sequence: \x1b] ... (\x07 or \x1b\\)
                    var seqIdx = input.index(after: nextIdx)
                    var terminated = false
                    while seqIdx < input.endIndex {
                        let c = input[seqIdx]
                        if c == "\u{07}" {
                            seqIdx = input.index(after: seqIdx)
                            terminated = true
                            break
                        }
                        if c == "\u{1B}" {
                            let afterEsc = input.index(after: seqIdx)
                            if afterEsc == input.endIndex {
                                break
                            }
                            if input[afterEsc] == "\\" {
                                seqIdx = input.index(after: afterEsc)
                                terminated = true
                                break
                            }
                        }
                        seqIdx = input.index(after: seqIdx)
                    }
                    if terminated {
                        idx = seqIdx
                        continue
                    } else {
                        if input.distance(from: idx, to: input.endIndex) < 256 {
                            pendingEscape = String(input[idx...])
                        }
                        return
                    }
                } else if indicator == "(" || indicator == ")" || indicator == "*" || indicator == "+" {
                    // 3-byte charset selection sequence e.g. \x1b(B
                    let afterIndicator = input.index(after: nextIdx)
                    if afterIndicator == input.endIndex {
                        pendingEscape = String(input[idx...])
                        return
                    }
                    idx = input.index(after: afterIndicator)
                    continue
                } else {
                    // 2-byte ESC sequence (e.g. \x1b=, \x1b>, \x1bM, \x1b7, \x1b8)
                    idx = input.index(after: nextIdx)
                    continue
                }
            }
            putChar(ch)
            idx = input.index(after: idx)
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
        case "G":
            let c = max(1, nums.first ?? 1) - 1
            cursorCol = min(cols - 1, max(0, c))
        case "d":
            let r = max(1, nums.first ?? 1) - 1
            cursorRow = min(rows - 1, max(0, r))
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
                let blank = Array(repeating: Array(repeating: TerminalCell(), count: cols), count: rows)
                if isAlternateScreen { alternateGrid = blank } else { primaryGrid = blank }
                cursorRow = 0
                cursorCol = 0
            } else if mode == 0 {
                clearRange(fromRow: cursorRow, fromCol: cursorCol, toRow: rows - 1, toCol: cols - 1)
            } else if mode == 1 {
                clearRange(fromRow: 0, fromCol: 0, toRow: cursorRow, toCol: cursorCol)
            }
        case "K":
            let mode = nums.first ?? 0
            let startCol: Int
            let endCol: Int
            switch mode {
            case 1:
                startCol = 0
                endCol = min(cols - 1, cursorCol)
            case 2:
                startCol = 0
                endCol = cols - 1
            default:
                startCol = min(cols, cursorCol)
                endCol = cols - 1
            }
            if startCol <= endCol {
                if isAlternateScreen {
                    for c in startCol...endCol { alternateGrid[cursorRow][c] = TerminalCell() }
                } else {
                    for c in startCol...endCol { primaryGrid[cursorRow][c] = TerminalCell() }
                }
            }
        case "X":
            let count = max(1, nums.first ?? 1)
            let endCol = min(cols - 1, cursorCol + count - 1)
            if cursorCol <= endCol {
                if isAlternateScreen {
                    for c in cursorCol...endCol { alternateGrid[cursorRow][c] = TerminalCell() }
                } else {
                    for c in cursorCol...endCol { primaryGrid[cursorRow][c] = TerminalCell() }
                }
            }
        case "P":
            let count = max(1, nums.first ?? 1)
            if isAlternateScreen {
                for c in cursorCol..<cols {
                    let src = c + count
                    alternateGrid[cursorRow][c] = src < cols ? alternateGrid[cursorRow][src] : TerminalCell()
                }
            } else {
                for c in cursorCol..<cols {
                    let src = c + count
                    primaryGrid[cursorRow][c] = src < cols ? primaryGrid[cursorRow][src] : TerminalCell()
                }
            }
        default:
            break
        }
    }

    private func clearRange(fromRow: Int, fromCol: Int, toRow: Int, toCol: Int) {
        let r0 = max(0, min(rows - 1, fromRow))
        let r1 = max(0, min(rows - 1, toRow))
        guard r0 <= r1 else { return }
        for r in r0...r1 {
            let c0 = (r == r0) ? max(0, min(cols - 1, fromCol)) : 0
            let c1 = (r == r1) ? max(0, min(cols - 1, toCol)) : (cols - 1)
            if c0 <= c1 {
                if isAlternateScreen {
                    for c in c0...c1 { alternateGrid[r][c] = TerminalCell() }
                } else {
                    for c in c0...c1 { primaryGrid[r][c] = TerminalCell() }
                }
            }
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
        if ch == "\u{07}" {
            return
        }
        if ch == "\t" {
            let nextStop = ((cursorCol / 8) + 1) * 8
            cursorCol = min(cols - 1, nextStop)
            return
        }
        if cursorCol >= cols {
            cursorCol = 0
            advanceLine()
        }
        let cell = TerminalCell(
            char: ch,
            fgColorIndex: currentFg,
            bgColorIndex: currentBg,
            bold: currentBold,
            underline: currentUnderline
        )
        if isAlternateScreen {
            alternateGrid[cursorRow][cursorCol] = cell
        } else {
            primaryGrid[cursorRow][cursorCol] = cell
        }
        cursorCol += 1
    }

    private func advanceLine() {
        if cursorRow + 1 < rows {
            cursorRow += 1
            return
        }
        let topRow: [TerminalCell]
        if isAlternateScreen {
            topRow = alternateGrid.removeFirst()
            alternateGrid.append(Array(repeating: TerminalCell(), count: cols))
        } else {
            topRow = primaryGrid.removeFirst()
            let lineStr = String(topRow.map(\.char)).replacingOccurrences(
                of: #"\s+$"#,
                with: "",
                options: .regularExpression
            )
            scrollback.append(lineStr)
            if scrollback.count > maxScrollbackLines {
                scrollback.removeFirst(scrollback.count - maxScrollbackLines)
            }
            primaryGrid.append(Array(repeating: TerminalCell(), count: cols))
        }
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
