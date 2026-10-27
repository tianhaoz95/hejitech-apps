import UIKit

/// Action item for Desktop-native dialogs on the external monitor.
public struct DesktopAlertAction {
    public enum Style {
        case `default`
        case cancel
        case destructive
    }

    public let title: String
    public let style: Style
    public let handler: ((String?) -> Void)?

    public init(title: String, style: Style = .default, handler: ((String?) -> Void)? = nil) {
        self.title = title
        self.style = style
        self.handler = handler
    }
}

/// Native Desktop Modal Dialog for External Monitors (PRD §4, §12).
/// Renders directly inside the workspace view on the external monitor so that:
/// 1. Its UI matches the desktop workspace styling and resolution.
/// 2. The virtual mouse cursor can freely reach, hover, and click every button and field.
/// 3. Physical dock keyboard and phone controller can confirm via Enter or cancel via Escape.
@MainActor
public final class DesktopDialogView: UIView, UITextFieldDelegate {
    private let backdrop = UIView()
    private let card = UIView()
    private let titleLabel = UILabel()
    private let closeButton = UIButton(type: .system)
    private let messageLabel = UILabel()
    private let inputField = UITextField()
    private let buttonStack = UIStackView()

    public var onDismiss: (() -> Void)?
    private var actions: [DesktopAlertAction] = []
    private var hasInputField: Bool = false

    public init(
        title: String,
        message: String?,
        actions: [DesktopAlertAction],
        textFieldPlaceholder: String? = nil,
        textFieldDefaultText: String? = nil
    ) {
        self.actions = actions
        super.init(frame: .zero)
        setupUI(
            title: title,
            message: message,
            placeholder: textFieldPlaceholder,
            defaultText: textFieldDefaultText
        )
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupUI(title: String, message: String?, placeholder: String?, defaultText: String?) {
        backgroundColor = .clear

        backdrop.translatesAutoresizingMaskIntoConstraints = false
        backdrop.backgroundColor = UIColor(white: 0.0, alpha: 0.65)
        addSubview(backdrop)

        let dismissTap = UITapGestureRecognizer(target: self, action: #selector(handleBackdropTap))
        backdrop.addGestureRecognizer(dismissTap)

        card.translatesAutoresizingMaskIntoConstraints = false
        card.backgroundColor = UIColor(red: 0.08, green: 0.11, blue: 0.17, alpha: 0.98)
        card.layer.cornerRadius = 12
        card.layer.borderWidth = 1.5
        card.layer.borderColor = UIColor(white: 1.0, alpha: 0.18).cgColor
        card.layer.shadowColor = UIColor.black.cgColor
        card.layer.shadowOpacity = 0.7
        card.layer.shadowRadius = 20
        card.layer.shadowOffset = CGSize(width: 0, height: 10)
        addSubview(card)

        // Title Bar
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .monospacedSystemFont(ofSize: 14, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.text = title

        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setTitle("×", for: .normal)
        closeButton.titleLabel?.font = .systemFont(ofSize: 20, weight: .bold)
        closeButton.setTitleColor(UIColor(white: 0.7, alpha: 1.0), for: .normal)
        closeButton.addTarget(self, action: #selector(dismissDialog), for: .touchUpInside)

        // Message
        messageLabel.translatesAutoresizingMaskIntoConstraints = false
        messageLabel.font = .systemFont(ofSize: 13, weight: .regular)
        messageLabel.textColor = UIColor(white: 0.85, alpha: 1.0)
        messageLabel.numberOfLines = 0
        messageLabel.text = message

        // Optional Input Field
        inputField.translatesAutoresizingMaskIntoConstraints = false
        inputField.delegate = self
        inputField.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        inputField.textColor = .white
        inputField.backgroundColor = UIColor(red: 0.04, green: 0.06, blue: 0.10, alpha: 1.0)
        inputField.layer.cornerRadius = 6
        inputField.layer.borderWidth = 1
        inputField.layer.borderColor = UIColor(white: 1.0, alpha: 0.15).cgColor
        inputField.placeholder = placeholder
        inputField.text = defaultText
        inputField.leftView = UIView(frame: CGRect(x: 0, y: 0, width: 8, height: 1))
        inputField.leftViewMode = .always

        hasInputField = (placeholder != nil || defaultText != nil)
        inputField.isHidden = !hasInputField

        // Action Buttons
        buttonStack.translatesAutoresizingMaskIntoConstraints = false
        buttonStack.axis = .horizontal
        buttonStack.spacing = 10
        buttonStack.distribution = .fillEqually

        for (idx, action) in actions.enumerated() {
            let btn = UIButton(type: .system)
            btn.setTitle(action.title, for: .normal)
            btn.titleLabel?.font = .systemFont(ofSize: 13, weight: .semibold)
            btn.layer.cornerRadius = 6
            btn.heightAnchor.constraint(equalToConstant: 38).isActive = true
            btn.tag = idx

            switch action.style {
            case .default:
                btn.backgroundColor = UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0)
                btn.setTitleColor(.black, for: .normal)
            case .cancel:
                btn.backgroundColor = UIColor(white: 1.0, alpha: 0.10)
                btn.setTitleColor(.white, for: .normal)
                btn.layer.borderWidth = 1
                btn.layer.borderColor = UIColor(white: 1.0, alpha: 0.15).cgColor
            case .destructive:
                btn.backgroundColor = UIColor(red: 0.88, green: 0.25, blue: 0.25, alpha: 1.0)
                btn.setTitleColor(.white, for: .normal)
            }

            btn.addTarget(self, action: #selector(handleActionButtonTapped(_:)), for: .touchUpInside)
            buttonStack.addArrangedSubview(btn)
        }

        card.addSubview(titleLabel)
        card.addSubview(closeButton)
        card.addSubview(messageLabel)
        if hasInputField {
            card.addSubview(inputField)
        }
        card.addSubview(buttonStack)

        NSLayoutConstraint.activate([
            backdrop.topAnchor.constraint(equalTo: topAnchor),
            backdrop.leadingAnchor.constraint(equalTo: leadingAnchor),
            backdrop.trailingAnchor.constraint(equalTo: trailingAnchor),
            backdrop.bottomAnchor.constraint(equalTo: bottomAnchor),

            card.centerXAnchor.constraint(equalTo: centerXAnchor),
            card.centerYAnchor.constraint(equalTo: centerYAnchor),
            card.widthAnchor.constraint(equalToConstant: 480),

            titleLabel.topAnchor.constraint(equalTo: card.topAnchor, constant: 14),
            titleLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: closeButton.leadingAnchor, constant: -10),

            closeButton.topAnchor.constraint(equalTo: card.topAnchor, constant: 10),
            closeButton.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -14),
            closeButton.widthAnchor.constraint(equalToConstant: 24),
            closeButton.heightAnchor.constraint(equalToConstant: 24),

            messageLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 12),
            messageLabel.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
            messageLabel.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
        ])

        if hasInputField {
            NSLayoutConstraint.activate([
                inputField.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 12),
                inputField.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
                inputField.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
                inputField.heightAnchor.constraint(equalToConstant: 36),

                buttonStack.topAnchor.constraint(equalTo: inputField.bottomAnchor, constant: 16),
                buttonStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
                buttonStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
                buttonStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
            ])
        } else {
            NSLayoutConstraint.activate([
                buttonStack.topAnchor.constraint(equalTo: messageLabel.bottomAnchor, constant: 16),
                buttonStack.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
                buttonStack.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
                buttonStack.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -16),
            ])
        }
    }

    @objc private func handleBackdropTap() {
        dismissDialog()
    }

    @objc public func dismissDialog() {
        UIView.animate(withDuration: 0.15, animations: {
            self.alpha = 0
            self.card.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
        }) { _ in
            self.removeFromSuperview()
            self.onDismiss?()
        }
    }

    @objc private func handleActionButtonTapped(_ sender: UIButton) {
        let action = actions[sender.tag]
        let inputText = hasInputField ? inputField.text : nil
        dismissDialog()
        action.handler?(inputText)
    }

    public func triggerPrimaryAction() {
        if let primaryIdx = actions.firstIndex(where: { $0.style == .default || $0.style == .destructive }) {
            let action = actions[primaryIdx]
            let inputText = hasInputField ? inputField.text : nil
            dismissDialog()
            action.handler?(inputText)
        } else {
            dismissDialog()
        }
    }

    public func triggerCancelAction() {
        if let cancelIdx = actions.firstIndex(where: { $0.style == .cancel }) {
            let action = actions[cancelIdx]
            dismissDialog()
            action.handler?(nil)
        } else {
            dismissDialog()
        }
    }
}
