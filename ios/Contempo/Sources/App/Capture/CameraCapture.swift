import AVFoundation
import SwiftUI
import UIKit

/// Camera-permission + system-camera launch state for one capture action —
/// mirrors Android's `rememberCameraCapture` (see
/// android/app/.../ui/CameraCapture.kt). CaptureScreen holds one instance
/// per capture action (photo-entry vs. odometer) since each needs its own
/// independent sheet-presentation state. No photo-library fallback — the
/// whole point of these actions is a fresh, contemporaneous shot, not
/// picking an old photo out of the library.
@MainActor
@Observable
final class CameraCaptureState {
    var isPresented = false
    var permissionDenied = false

    func launch() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return }
        Task {
            let granted = await Self.requestAccess()
            permissionDenied = !granted
            if granted { isPresented = true }
        }
    }

    private static func requestAccess() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return true
        case .notDetermined: return await AVCaptureDevice.requestAccess(for: .video)
        default: return false
        }
    }
}

/// Thin `UIViewControllerRepresentable` wrapper around `UIImagePickerController`
/// for taking a photo with the system camera. [onCapture] receives JPEG data
/// for the taken photo; dismisses itself (via the sheet's own `isPresented`
/// binding, through `\.dismiss`) on both a successful capture and a cancel.
struct CameraPicker: UIViewControllerRepresentable {
    let onCapture: (Data) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(parent: CameraPicker) { self.parent = parent }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.85) {
                parent.onCapture(data)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}
