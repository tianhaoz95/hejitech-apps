import TetherKit
import UIKit
import WebKit

/// Interactive Virtual Mouse Cursor Overlay for External Monitors (PRD §4, §12).
/// Displays a high-contrast cursor on the external display that is driven by:
/// 1. The phone's Touchpad mode.
/// 2. Physical mouse connected to the dock/phone via USB-C or Bluetooth.
@MainActor
public final class VirtualCursorOverlayView: UIView {
    public private(set) var cursorPosition: CGPoint = .zero
    private let cursorContainer = UIView()
    private let cursorImageView = UIImageView()
    public weak var targetCanvas: UIView?

    public init(targetCanvas: UIView) {
        self.targetCanvas = targetCanvas
        super.init(frame: .zero)
        isUserInteractionEnabled = false // Let underlying touches pass through if direct touch exists
        setupCursor()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        if cursorPosition == .zero && bounds.width > 0 && bounds.height > 0 {
            cursorPosition = CGPoint(x: bounds.midX, y: bounds.midY)
            updateCursorFrame()
        }
    }

    private func setupCursor() {
        cursorContainer.frame = CGRect(x: 0, y: 0, width: 24, height: 24)
        cursorContainer.backgroundColor = .clear

        resetDefaultCursor()

        cursorImageView.frame = cursorContainer.bounds
        cursorImageView.contentMode = .scaleAspectFit
        cursorImageView.layer.shadowColor = UIColor.black.cgColor
        cursorImageView.layer.shadowOpacity = 0.85
        cursorImageView.layer.shadowOffset = CGSize(width: 1, height: 2)
        cursorImageView.layer.shadowRadius = 4

        cursorContainer.addSubview(cursorImageView)
        addSubview(cursorContainer)
    }

    public func resetDefaultCursor() {
        let config = UIImage.SymbolConfiguration(pointSize: 22, weight: .semibold)
        cursorImageView.image = UIImage(systemName: "cursorarrow", withConfiguration: config)?
            .withTintColor(.white, renderingMode: .alwaysOriginal)
    }

    public func setResizeCursor(direction: SplitDirection) {
        let systemName = (direction == .horizontal) ? "arrow.left.and.right" : "arrow.up.and.down"
        let config = UIImage.SymbolConfiguration(pointSize: 20, weight: .bold)
        cursorImageView.image = UIImage(systemName: systemName, withConfiguration: config)?
            .withTintColor(UIColor(red: 0.22, green: 0.74, blue: 0.97, alpha: 1.0), renderingMode: .alwaysOriginal)
    }

    private func updateCursorFrame() {
        cursorContainer.center = CGPoint(
            x: cursorPosition.x + 8,
            y: cursorPosition.y + 8
        )
    }

    public func setCursorPosition(_ point: CGPoint) {
        cursorPosition = CGPoint(
            x: min(max(0, point.x), bounds.width),
            y: min(max(0, point.y), bounds.height)
        )
        updateCursorFrame()
    }

    public func move(by delta: CGVector) {
        let newX = min(max(0, cursorPosition.x + delta.dx), bounds.width)
        let newY = min(max(0, cursorPosition.y + delta.dy), bounds.height)
        cursorPosition = CGPoint(x: newX, y: newY)
        updateCursorFrame()
    }

    public func performClick() {
        // Visual click bounce animation on external display
        UIView.animate(withDuration: 0.08, animations: {
            self.cursorContainer.transform = CGAffineTransform(scaleX: 0.80, y: 0.80)
        }) { _ in
            UIView.animate(withDuration: 0.12) {
                self.cursorContainer.transform = .identity
            }
        }

        guard let canvas = self.window ?? targetCanvas ?? superview else { return }
        let hitPoint = canvas.convert(cursorPosition, from: self)

        if let hitView = canvas.hitTest(hitPoint, with: nil) {
            // 1. Text Field: focus, select all, send editing begin event without stealing focus
            if let textField = findAncestor(of: hitView, matching: { $0 is UITextField }) as? UITextField {
                textField.becomeFirstResponder()
                textField.sendActions(for: .editingDidBegin)
                DispatchQueue.main.async {
                    textField.selectAll(nil)
                    if let start = textField.beginningOfDocument as UITextPosition?,
                       let end = textField.endOfDocument as UITextPosition? {
                        textField.selectedTextRange = textField.textRange(from: start, to: end)
                    }
                }
                return
            }

            // 1b. Text View (e.g. Terminal): do not trigger UIKit text selection or auto-scrolling
            if let _ = findAncestor(of: hitView, matching: { $0 is UITextView }) as? UITextView {
                return
            }

            // 2. Buttons
            if let button = findAncestor(of: hitView, matching: { $0 is UIButton }) as? UIButton {
                button.sendActions(for: .touchUpInside)
                button.sendActions(for: .primaryActionTriggered)
                return
            }

            // 3. Segmented Controls, Steppers, Switches, & other UIControls
            if let control = findAncestor(of: hitView, matching: { $0 is UIControl }) as? UIControl {
                if let seg = control as? UISegmentedControl {
                    let segWidth = seg.bounds.width / CGFloat(max(1, seg.numberOfSegments))
                    let ptInSeg = seg.convert(hitPoint, from: canvas)
                    let selectedIdx = min(max(0, Int(ptInSeg.x / segWidth)), seg.numberOfSegments - 1)
                    seg.selectedSegmentIndex = selectedIdx
                    seg.sendActions(for: .valueChanged)
                    return
                }
                if let sw = control as? UISwitch {
                    sw.setOn(!sw.isOn, animated: true)
                    sw.sendActions(for: .valueChanged)
                    return
                }
                if let stepper = control as? UIStepper {
                    let ptInStepper = stepper.convert(hitPoint, from: canvas)
                    if ptInStepper.x < stepper.bounds.width / 2 {
                        stepper.value = max(stepper.minimumValue, stepper.value - stepper.stepValue)
                    } else {
                        stepper.value = min(stepper.maximumValue, stepper.value + stepper.stepValue)
                    }
                    stepper.sendActions(for: .valueChanged)
                    return
                }
                control.sendActions(for: .primaryActionTriggered)
                control.sendActions(for: .touchUpInside)
                return
            }

            // 4. Web View: DOM element click
            if let webView = findAncestor(of: hitView, matching: { $0 is WKWebView }) as? WKWebView {
                let ptInWeb = webView.convert(hitPoint, from: canvas)
                webView.becomeFirstResponder()
                simulateWebClick(in: webView, at: ptInWeb)
                return
            }

            // 5. Table View Selection
            if let tableView = findAncestor(of: hitView, matching: { $0 is UITableView }) as? UITableView {
                let ptInTable = tableView.convert(hitPoint, from: canvas)
                if let indexPath = tableView.indexPathForRow(at: ptInTable) {
                    tableView.selectRow(at: indexPath, animated: true, scrollPosition: .none)
                    tableView.delegate?.tableView?(tableView, didSelectRowAt: indexPath)
                    return
                }
            }

            // 6. Generic tap gesture recognizers (pane headers, tab pills, etc.)
            var current: UIView? = hitView
            while let v = current {
                if let gestures = v.gestureRecognizers {
                    for g in gestures where g is UITapGestureRecognizer && g.isEnabled {
                        (g as? UITapGestureRecognizer)?.state = .ended
                        return
                    }
                }
                current = v.superview
            }
        }
    }

    public func performScroll(deltaX: CGFloat, deltaY: CGFloat) {
        guard let canvas = targetCanvas ?? superview else { return }
        let hitPoint = canvas.convert(cursorPosition, from: self)

        if let hitView = canvas.hitTest(hitPoint, with: nil),
           let scrollView = findAncestor(of: hitView, matching: { $0 is UIScrollView }) as? UIScrollView {
            var offset = scrollView.contentOffset
            offset.x = min(max(0, offset.x + deltaX), max(0, scrollView.contentSize.width - scrollView.bounds.width))
            offset.y = min(max(0, offset.y + deltaY), max(0, scrollView.contentSize.height - scrollView.bounds.height))
            scrollView.setContentOffset(offset, animated: false)
        }
    }

    private func simulateWebClick(in webView: WKWebView, at point: CGPoint) {
        let js = """
        (function() {
            var x = \(point.x);
            var y = \(point.y);
            var el = document.elementFromPoint(x, y);
            if (!el) return;

            var a = el.closest('a');
            if (a && a.href && !a.href.startsWith('javascript:')) {
                if (a.target === '_blank') {
                    window.open(a.href, '_blank');
                } else {
                    window.location.href = a.href;
                }
                return;
            }

            var btn = el.closest('button, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], select');
            if (btn) {
                btn.focus();
                btn.click();
            } else {
                el.focus();
                el.click();
            }

            var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));

            var input = el.closest('input, textarea, [contenteditable="true"]');
            if (input) {
                input.focus();
            }
        })();
        """
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    private func findAncestor(of view: UIView, matching predicate: (UIView) -> Bool) -> UIView? {
        var current: UIView? = view
        while let v = current {
            if predicate(v) { return v }
            current = v.superview
        }
        return nil
    }
}
