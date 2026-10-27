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
    private weak var targetCanvas: UIView?

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

        let config = UIImage.SymbolConfiguration(pointSize: 22, weight: .semibold)
        cursorImageView.image = UIImage(systemName: "cursorarrow", withConfiguration: config)?
            .withTintColor(.white, renderingMode: .alwaysOriginal)
        cursorImageView.frame = cursorContainer.bounds
        cursorImageView.contentMode = .scaleAspectFit
        cursorImageView.layer.shadowColor = UIColor.black.cgColor
        cursorImageView.layer.shadowOpacity = 0.8
        cursorImageView.layer.shadowOffset = CGSize(width: 1, height: 2)
        cursorImageView.layer.shadowRadius = 3

        cursorContainer.addSubview(cursorImageView)
        addSubview(cursorContainer)
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
            self.cursorContainer.transform = CGAffineTransform(scaleX: 0.82, y: 0.82)
        }) { _ in
            UIView.animate(withDuration: 0.12) {
                self.cursorContainer.transform = .identity
            }
        }

        guard let canvas = targetCanvas else { return }
        let hitPoint = canvas.convert(cursorPosition, from: self)

        if let hitView = canvas.hitTest(hitPoint, with: nil) {
            // Traverse up to check for controls or custom tab views
            if let button = findAncestor(of: hitView, matching: { $0 is UIButton }) as? UIButton {
                button.sendActions(for: .touchUpInside)
                return
            }
            if let control = findAncestor(of: hitView, matching: { $0 is UIControl }) as? UIControl {
                control.sendActions(for: .primaryActionTriggered)
                return
            }
            if let webView = findAncestor(of: hitView, matching: { $0 is WKWebView }) as? WKWebView {
                let ptInWeb = webView.convert(hitPoint, from: canvas)
                simulateWebClick(in: webView, at: ptInWeb)
                return
            }
            // Check for tap gestures on headers or tabs
            if let gestures = hitView.gestureRecognizers {
                for g in gestures where g is UITapGestureRecognizer && g.isEnabled {
                    if let target = (g as? UITapGestureRecognizer) {
                        // Trigger focus or tab select
                        target.state = .ended
                    }
                }
            }
        }
    }

    public func performScroll(deltaX: CGFloat, deltaY: CGFloat) {
        guard let canvas = targetCanvas else { return }
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
            var el = document.elementFromPoint(\(point.x), \(point.y));
            if (el) {
                el.focus();
                el.click();
                var evt = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: \(point.x),
                    clientY: \(point.y)
                });
                el.dispatchEvent(evt);
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
