import XCTest
/// Tells the record script's feed server what the cameras see next (it runs on 127.0.0.1:8089).
func cue(_ query: String) {
    let done = XCTestExpectation(description: "cue")
    URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:8089/cue?\(query)")!) { _, _, _ in done.fulfill() }.resume()
    _ = XCTWaiter.wait(for: [done], timeout: 2)
}
func pause(_ s: Double) { Thread.sleep(forTimeInterval: s) }
