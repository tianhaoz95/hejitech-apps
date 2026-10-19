import Foundation
import Network
import AVFoundation
import AppKit

final class MacCameraBridge: NSObject, AVCaptureVideoDataOutputSampleBufferDelegate {
    private var frontJpeg: Data?
    private var rearJpeg: Data?
    private let lock = NSLock()
    private var ftSession: AVCaptureSession?
    private var rearSession: AVCaptureSession?
    private var ftOutput: AVCaptureVideoDataOutput?
    private var rearOutput: AVCaptureVideoDataOutput?
    private var listener: NWListener?
    private let queue = DispatchQueue(label: "com.hejitech.camerabridge.queue", qos: .userInteractive)
    private let ciContext = CIContext(options: [CIContextOption.useSoftwareRenderer: false])

    func start() {
        print("[MacCameraBridge] Initializing Mac Camera Bridge for ToddlerCam Simulator...")
        setupCameras()
        startHttpServer()
    }

    private func setupCameras() {
        let discovery = AVCaptureDevice.DiscoverySession(
            deviceTypes: [.builtInWideAngleCamera, .external],
            mediaType: .video,
            position: .unspecified
        )

        let devices = discovery.devices
        print("[MacCameraBridge] Detected \(devices.count) camera devices on Mac:")
        for (i, dev) in devices.enumerated() {
            print("  [\(i)] \(dev.localizedName) (ID: \(dev.uniqueID))")
        }

        let facetime = devices.first(where: { $0.localizedName.localizedCaseInsensitiveContains("facetime") })
        let external = devices.first(where: {
            $0.uniqueID != facetime?.uniqueID &&
            ($0.localizedName.localizedCaseInsensitiveContains("brio") ||
             $0.localizedName.localizedCaseInsensitiveContains("logitech") ||
             $0.localizedName.localizedCaseInsensitiveContains("external") ||
             $0.localizedName.localizedCaseInsensitiveContains("camera"))
        })

        // 1. Front (Selfie) Camera -> FaceTime HD Camera
        if let ft = facetime ?? devices.first {
            let session = AVCaptureSession()
            session.sessionPreset = .hd1280x720
            if let input = try? AVCaptureDeviceInput(device: ft), session.canAddInput(input) {
                session.addInput(input)
                let output = AVCaptureVideoDataOutput()
                output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)]
                output.alwaysDiscardsLateVideoFrames = true
                output.setSampleBufferDelegate(self, queue: queue)
                if session.canAddOutput(output) {
                    session.addOutput(output)
                    session.startRunning()
                    self.ftSession = session
                    self.ftOutput = output
                    print("[MacCameraBridge] Started Front/Selfie Camera: \(ft.localizedName)")
                }
            }
        }

        // 2. Rear Camera -> Logitech BRIO or secondary camera (or mirrored/offset feed if single)
        if let ext = external {
            let session = AVCaptureSession()
            session.sessionPreset = .hd1280x720
            if let input = try? AVCaptureDeviceInput(device: ext), session.canAddInput(input) {
                session.addInput(input)
                let output = AVCaptureVideoDataOutput()
                output.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)]
                output.alwaysDiscardsLateVideoFrames = true
                output.setSampleBufferDelegate(self, queue: queue)
                if session.canAddOutput(output) {
                    session.addOutput(output)
                    session.startRunning()
                    self.rearSession = session
                    self.rearOutput = output
                    print("[MacCameraBridge] Started Rear Camera: \(ext.localizedName)")
                }
            }
        }
    }

    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }
        let bitmapRep = NSBitmapImageRep(cgImage: cgImage)
        guard let jpeg = bitmapRep.representation(using: .jpeg, properties: [.compressionFactor: 0.65]) else { return }

        lock.lock()
        if output == ftOutput {
            self.frontJpeg = jpeg
        } else {
            self.rearJpeg = jpeg
        }
        lock.unlock()
    }

    private func startHttpServer() {
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            listener = try NWListener(using: params, on: 8089)
            listener?.newConnectionHandler = { [weak self] conn in
                self?.handleConnection(conn)
            }
            listener?.stateUpdateHandler = { state in
                switch state {
                case .ready:
                    print("[MacCameraBridge] HTTP Server READY at http://127.0.0.1:8089")
                    print("  - Front camera: http://127.0.0.1:8089/front")
                    print("  - Rear camera:  http://127.0.0.1:8089/rear")
                    fflush(stdout)
                case .failed(let err):
                    print("[MacCameraBridge] Server failed with error: \(err)")
                    fflush(stdout)
                default:
                    break
                }
            }
            listener?.start(queue: .global(qos: .userInteractive))
        } catch {
            print("[MacCameraBridge] Failed to create listener on port 8089: \(error)")
            fflush(stdout)
        }
    }

    private func handleConnection(_ connection: NWConnection) {
        connection.start(queue: .global(qos: .userInteractive))
        connection.receive(minimumIncompleteLength: 1, maximumLength: 2048) { [weak self] data, _, _, error in
            guard let self = self, let data = data, let req = String(data: data, encoding: .utf8) else {
                connection.cancel()
                return
            }

            var imageToSend: Data?
            self.lock.lock()
            if req.contains("GET /rear") {
                imageToSend = self.rearJpeg ?? self.frontJpeg
            } else {
                imageToSend = self.frontJpeg ?? self.rearJpeg
            }
            self.lock.unlock()

            if let img = imageToSend {
                let headers = "HTTP/1.1 200 OK\r\nContent-Type: image/jpeg\r\nContent-Length: \(img.count)\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n"
                var resp = Data(headers.utf8)
                resp.append(img)
                connection.send(content: resp, completion: .contentProcessed({ _ in
                    connection.cancel()
                }))
            } else {
                let body = "Waiting for Mac camera frames..."
                let headers = "HTTP/1.1 503 Service Unavailable\r\nContent-Type: text/plain\r\nContent-Length: \(body.utf8.count)\r\nConnection: close\r\n\r\n" + body
                connection.send(content: Data(headers.utf8), completion: .contentProcessed({ _ in
                    connection.cancel()
                }))
            }
        }
    }
}

setlinebuf(stdout)
let bridge = MacCameraBridge()
bridge.start()
dispatchMain()
