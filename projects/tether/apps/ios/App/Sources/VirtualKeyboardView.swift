import TetherKit
import UIKit

/// High-performance, tactile on-screen developer and touch keyboard for Tether (PRD §4, §12).
/// Renders directly in the view hierarchy, guaranteeing it is ALWAYS visible and interactive
/// whether or not a physical hardware keyboard is attached to the phone or dock.
@MainActor
public final class VirtualKeyboardView: UIView {
    public var onTextInput: ((String) -> Void)?
    public var onSpecialKey: ((SpecialKey) -> Void)?

    private enum KeyMode {
        case letters
        case numbers
        case symbols
    }

    private var currentMode: KeyMode = .letters
    private var isShiftActive: Bool = false
    private var isCtrlLatched: Bool = false
    private var isAltLatched: Bool = false

    private let mainStack = UIStackView()
    private let devRowStack = UIStackView()
    private let keyRowsStack = UIStackView()

    private var backspaceTimer: Timer?

    public init() {
        super.init(frame: .zero)
        setupViews()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupViews() {
        backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.11, alpha: 0.95)
        layer.cornerRadius = 10
        layer.borderWidth = 1
        layer.borderColor = UIColor(white: 1.0, alpha: 0.08).cgColor
        clipsToBounds = true

        mainStack.translatesAutoresizingMaskIntoConstraints = false
        mainStack.axis = .vertical
        mainStack.spacing = 4
        mainStack.distribution = .fillProportionally
        addSubview(mainStack)

        NSLayoutConstraint.activate([
            mainStack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            mainStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            mainStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            mainStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
        ])

        setupDevRow()
        mainStack.addArrangedSubview(devRowStack)

        keyRowsStack.axis = .vertical
        keyRowsStack.spacing = 4
        keyRowsStack.distribution = .fillEqually
        mainStack.addArrangedSubview(keyRowsStack)

        rebuildKeyRows()
    }

    // MARK: - Developer Row

    private func setupDevRow() {
        devRowStack.axis = .horizontal
        devRowStack.spacing = 4
        devRowStack.distribution = .fillEqually

        let devKeys: [(String, () -> Void)] = [
            ("Esc", { [weak self] in self?.onSpecialKey?(.escape) }),
            ("Tab", { [weak self] in self?.onSpecialKey?(.tab) }),
            ("^C", { [weak self] in self?.onSpecialKey?(.ctrlC) }),
            ("^D", { [weak self] in self?.onSpecialKey?(.ctrlD) }),
            ("^L", { [weak self] in self?.onSpecialKey?(.ctrlL) }),
            ("~", { [weak self] in self?.emitText("~") }),
            ("/", { [weak self] in self?.emitText("/") }),
            ("|", { [weak self] in self?.emitText("|") }),
            ("↑", { [weak self] in self?.onSpecialKey?(.up) }),
            ("↓", { [weak self] in self?.onSpecialKey?(.down) }),
            ("←", { [weak self] in self?.onSpecialKey?(.left) }),
            ("→", { [weak self] in self?.onSpecialKey?(.right) }),
        ]

        for (title, action) in devKeys {
            let btn = UIButton(type: .system)
            btn.setTitle(title, for: .normal)
            btn.titleLabel?.font = .monospacedSystemFont(ofSize: 11, weight: .bold)
            btn.setTitleColor(UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0), for: .normal)
            btn.backgroundColor = UIColor(red: 0.08, green: 0.12, blue: 0.20, alpha: 1.0)
            btn.layer.cornerRadius = 5
            btn.layer.borderWidth = 1
            btn.layer.borderColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.20).cgColor
            btn.addAction(UIAction { _ in
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                action()
            }, for: .touchUpInside)
            devRowStack.addArrangedSubview(btn)
        }
    }

    // MARK: - Key Rows Construction

    private func rebuildKeyRows() {
        keyRowsStack.arrangedSubviews.forEach {
            keyRowsStack.removeArrangedSubview($0)
            $0.removeFromSuperview()
        }

        switch currentMode {
        case .letters:
            buildLettersMode()
        case .numbers:
            buildNumbersMode()
        case .symbols:
            buildSymbolsMode()
        }
    }

    private func buildLettersMode() {
        let r1 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"]
        let r2 = ["a", "s", "d", "f", "g", "h", "j", "k", "l"]
        let r3 = ["z", "x", "c", "v", "b", "n", "m"]

        keyRowsStack.addArrangedSubview(makeKeyRow(keys: r1.map { isShiftActive ? $0.uppercased() : $0 }))

        // Row 2 centered with slight margin
        let row2Stack = makeKeyRow(keys: r2.map { isShiftActive ? $0.uppercased() : $0 })
        keyRowsStack.addArrangedSubview(row2Stack)

        // Row 3: Shift + letters + Backspace
        let row3Stack = UIStackView()
        row3Stack.axis = .horizontal
        row3Stack.spacing = 4
        row3Stack.distribution = .fillProportionally

        let shiftBtn = makeActionButton(title: "⇧", isHighlighted: isShiftActive) { [weak self] in
            guard let self else { return }
            self.isShiftActive.toggle()
            self.rebuildKeyRows()
        }
        shiftBtn.widthAnchor.constraint(equalToConstant: 42).isActive = true
        row3Stack.addArrangedSubview(shiftBtn)

        let lettersStack = makeKeyRow(keys: r3.map { isShiftActive ? $0.uppercased() : $0 })
        row3Stack.addArrangedSubview(lettersStack)

        let backspaceBtn = makeBackspaceButton()
        backspaceBtn.widthAnchor.constraint(equalToConstant: 42).isActive = true
        row3Stack.addArrangedSubview(backspaceBtn)

        keyRowsStack.addArrangedSubview(row3Stack)

        // Row 4: 123 + Ctrl + Alt + Space + Return
        keyRowsStack.addArrangedSubview(makeBottomRow(modeSwitchTitle: "123", modeSwitchAction: { [weak self] in
            self?.currentMode = .numbers
            self?.rebuildKeyRows()
        }))
    }

    private func buildNumbersMode() {
        let r1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]
        let r2 = ["-", "/", ":", ";", "(", ")", "$", "&", "@", "\""]
        let r3 = [".", ",", "?", "!", "'"]

        keyRowsStack.addArrangedSubview(makeKeyRow(keys: r1))
        keyRowsStack.addArrangedSubview(makeKeyRow(keys: r2))

        let row3Stack = UIStackView()
        row3Stack.axis = .horizontal
        row3Stack.spacing = 4
        row3Stack.distribution = .fillProportionally

        let symbolsBtn = makeActionButton(title: "#+=", isHighlighted: false) { [weak self] in
            self?.currentMode = .symbols
            self?.rebuildKeyRows()
        }
        symbolsBtn.widthAnchor.constraint(equalToConstant: 46).isActive = true
        row3Stack.addArrangedSubview(symbolsBtn)

        let symbolsStack = makeKeyRow(keys: r3)
        row3Stack.addArrangedSubview(symbolsStack)

        let backspaceBtn = makeBackspaceButton()
        backspaceBtn.widthAnchor.constraint(equalToConstant: 42).isActive = true
        row3Stack.addArrangedSubview(backspaceBtn)

        keyRowsStack.addArrangedSubview(row3Stack)

        keyRowsStack.addArrangedSubview(makeBottomRow(modeSwitchTitle: "ABC", modeSwitchAction: { [weak self] in
            self?.currentMode = .letters
            self?.rebuildKeyRows()
        }))
    }

    private func buildSymbolsMode() {
        let r1 = ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="]
        let r2 = ["_", "\\", "|", "~", "<", ">", "€", "£", "¥", "•"]
        let r3 = [".", ",", "?", "!", "'"]

        keyRowsStack.addArrangedSubview(makeKeyRow(keys: r1))
        keyRowsStack.addArrangedSubview(makeKeyRow(keys: r2))

        let row3Stack = UIStackView()
        row3Stack.axis = .horizontal
        row3Stack.spacing = 4
        row3Stack.distribution = .fillProportionally

        let numBtn = makeActionButton(title: "123", isHighlighted: false) { [weak self] in
            self?.currentMode = .numbers
            self?.rebuildKeyRows()
        }
        numBtn.widthAnchor.constraint(equalToConstant: 46).isActive = true
        row3Stack.addArrangedSubview(numBtn)

        let symbolsStack = makeKeyRow(keys: r3)
        row3Stack.addArrangedSubview(symbolsStack)

        let backspaceBtn = makeBackspaceButton()
        backspaceBtn.widthAnchor.constraint(equalToConstant: 42).isActive = true
        row3Stack.addArrangedSubview(backspaceBtn)

        keyRowsStack.addArrangedSubview(row3Stack)

        keyRowsStack.addArrangedSubview(makeBottomRow(modeSwitchTitle: "ABC", modeSwitchAction: { [weak self] in
            self?.currentMode = .letters
            self?.rebuildKeyRows()
        }))
    }

    private func makeBottomRow(modeSwitchTitle: String, modeSwitchAction: @escaping () -> Void) -> UIStackView {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 4
        stack.distribution = .fillProportionally

        let switchBtn = makeActionButton(title: modeSwitchTitle, isHighlighted: false, action: modeSwitchAction)
        switchBtn.widthAnchor.constraint(equalToConstant: 48).isActive = true
        stack.addArrangedSubview(switchBtn)

        let ctrlBtn = makeActionButton(title: "Ctrl", isHighlighted: isCtrlLatched) { [weak self] in
            guard let self else { return }
            self.isCtrlLatched.toggle()
            self.rebuildKeyRows()
        }
        ctrlBtn.widthAnchor.constraint(equalToConstant: 44).isActive = true
        stack.addArrangedSubview(ctrlBtn)

        let altBtn = makeActionButton(title: "Alt", isHighlighted: isAltLatched) { [weak self] in
            guard let self else { return }
            self.isAltLatched.toggle()
            self.rebuildKeyRows()
        }
        altBtn.widthAnchor.constraint(equalToConstant: 44).isActive = true
        stack.addArrangedSubview(altBtn)

        let spaceBtn = UIButton(type: .system)
        spaceBtn.setTitle("Space", for: .normal)
        spaceBtn.titleLabel?.font = .systemFont(ofSize: 13, weight: .medium)
        spaceBtn.setTitleColor(.white, for: .normal)
        spaceBtn.backgroundColor = UIColor(red: 0.16, green: 0.20, blue: 0.30, alpha: 1.0)
        spaceBtn.layer.cornerRadius = 6
        spaceBtn.layer.borderWidth = 1
        spaceBtn.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
        spaceBtn.addAction(UIAction { [weak self] _ in
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            self?.emitText(" ")
        }, for: .touchUpInside)
        stack.addArrangedSubview(spaceBtn)

        let returnBtn = UIButton(type: .system)
        returnBtn.setTitle("Return", for: .normal)
        returnBtn.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
        returnBtn.setTitleColor(.black, for: .normal)
        returnBtn.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 0.95)
        returnBtn.layer.cornerRadius = 6
        returnBtn.widthAnchor.constraint(equalToConstant: 64).isActive = true
        returnBtn.addAction(UIAction { [weak self] _ in
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            self?.onSpecialKey?(.enter)
        }, for: .touchUpInside)
        stack.addArrangedSubview(returnBtn)

        return stack
    }

    private func makeKeyRow(keys: [String]) -> UIStackView {
        let stack = UIStackView()
        stack.axis = .horizontal
        stack.spacing = 4
        stack.distribution = .fillEqually

        for key in keys {
            let btn = UIButton(type: .system)
            btn.setTitle(key, for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 15, weight: .medium)
            btn.setTitleColor(.white, for: .normal)
            btn.backgroundColor = UIColor(red: 0.13, green: 0.17, blue: 0.26, alpha: 1.0)
            btn.layer.cornerRadius = 6
            btn.layer.borderWidth = 1
            btn.layer.borderColor = UIColor(white: 1.0, alpha: 0.10).cgColor
            btn.addAction(UIAction { [weak self] _ in
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                self?.handleCharacterKey(key)
            }, for: .touchUpInside)
            stack.addArrangedSubview(btn)
        }
        return stack
    }

    private func makeActionButton(title: String, isHighlighted: Bool, action: @escaping () -> Void) -> UIButton {
        let btn = UIButton(type: .system)
        btn.setTitle(title, for: .normal)
        btn.titleLabel?.font = .systemFont(ofSize: 12, weight: .bold)
        if isHighlighted {
            btn.setTitleColor(.black, for: .normal)
            btn.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
        } else {
            btn.setTitleColor(UIColor(white: 0.9, alpha: 1.0), for: .normal)
            btn.backgroundColor = UIColor(red: 0.09, green: 0.12, blue: 0.20, alpha: 1.0)
        }
        btn.layer.cornerRadius = 6
        btn.layer.borderWidth = 1
        btn.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor
        btn.addAction(UIAction { _ in
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        }, for: .touchUpInside)
        return btn
    }

    private func makeBackspaceButton() -> UIButton {
        let btn = UIButton(type: .system)
        let config = UIImage.SymbolConfiguration(pointSize: 13, weight: .bold)
        btn.setImage(UIImage(systemName: "delete.left.fill", withConfiguration: config), for: .normal)
        btn.tintColor = .white
        btn.backgroundColor = UIColor(red: 0.09, green: 0.12, blue: 0.20, alpha: 1.0)
        btn.layer.cornerRadius = 6
        btn.layer.borderWidth = 1
        btn.layer.borderColor = UIColor(white: 1.0, alpha: 0.12).cgColor

        btn.addAction(UIAction { [weak self] _ in
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            self?.onSpecialKey?(.backspace)
        }, for: .touchUpInside)

        let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleBackspaceLongPress(_:)))
        longPress.minimumPressDuration = 0.35
        btn.addGestureRecognizer(longPress)

        return btn
    }

    @objc private func handleBackspaceLongPress(_ gesture: UILongPressGestureRecognizer) {
        switch gesture.state {
        case .began:
            backspaceTimer?.invalidate()
            backspaceTimer = Timer.scheduledTimer(withTimeInterval: 0.08, repeats: true) { [weak self] _ in
                Task { @MainActor in
                    UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
                    self?.onSpecialKey?(.backspace)
                }
            }
        case .ended, .cancelled, .failed:
            backspaceTimer?.invalidate()
            backspaceTimer = nil
        default:
            break
        }
    }

    private func handleCharacterKey(_ key: String) {
        if isCtrlLatched {
            isCtrlLatched = false
            rebuildKeyRows()
            if let firstChar = key.lowercased().first,
               let ascii = firstChar.asciiValue,
               ascii >= 97 && ascii <= 122 {
                let ctrlCode = ascii - 96
                emitText(String(UnicodeScalar(ctrlCode)))
                return
            }
        }

        emitText(key)

        if isShiftActive {
            isShiftActive = false
            rebuildKeyRows()
        }
    }

    private func emitText(_ text: String) {
        onTextInput?(text)
    }
}
