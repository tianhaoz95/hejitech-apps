import Foundation
import UIKit
import Combine

public final class SimulatorCameraStreamer: ObservableObject {
    public static let shared = SimulatorCameraStreamer()

    @Published public var frontFrame: UIImage?
    @Published public var rearFrame: UIImage?
    @Published public var isConnected: Bool = false

    private var streamingTask: Task<Void, Never>?
    private let session: URLSession

    public init() {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 0.5
        config.timeoutIntervalForResource = 0.5
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        self.session = URLSession(configuration: config)
    }

    public func startStreaming() {
        guard streamingTask == nil else { return }

        streamingTask = Task { [weak self] in
            guard let self = self else { return }
            let frontURL = URL(string: "http://127.0.0.1:8089/front")!
            let rearURL = URL(string: "http://127.0.0.1:8089/rear")!

            while !Task.isCancelled {
                // Fetch front frame
                if let (frontData, _) = try? await self.session.data(from: frontURL),
                   let frontImg = UIImage(data: frontData) {
                    await MainActor.run {
                        self.frontFrame = frontImg
                        self.isConnected = true
                    }
                }

                // Fetch rear frame
                if let (rearData, _) = try? await self.session.data(from: rearURL),
                   let rearImg = UIImage(data: rearData) {
                    await MainActor.run {
                        self.rearFrame = rearImg
                    }
                }

                // Sleep ~33ms for ~30 fps live video
                try? await Task.sleep(nanoseconds: 33_000_000)
            }
        }
    }

    public func stopStreaming() {
        streamingTask?.cancel()
        streamingTask = nil
        isConnected = false
    }

    deinit {
        stopStreaming()
    }
}
