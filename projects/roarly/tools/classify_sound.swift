// Scores audio files with Apple's built-in sound classifier (SoundAnalysis, version1) so sounds can
// be picked and trimmed without listening: for each file, prints the best windows for the labels.
// Usage: swift tools/classify_sound.swift --labels lion_roar,roar <file>...   (or --list)
import Foundation
import SoundAnalysis

let args = CommandLine.arguments.dropFirst()
let request = try SNClassifySoundRequest(classifierIdentifier: .version1)
if args.contains("--list") {
    print(request.knownClassifications.joined(separator: "\n"))
    exit(0)
}
var labels: [String] = []
var files: [String] = []
var window = 1.0
var it = args.makeIterator()
while let a = it.next() {
    if a == "--labels" { labels = (it.next() ?? "").split(separator: ",").map(String.init) }
    else if a == "--window" { window = Double(it.next() ?? "1") ?? 1 }
    else { files.append(a) }
}
request.windowDuration = CMTime(seconds: window, preferredTimescale: 1000)
request.overlapFactor = 0.5

final class Collector: NSObject, SNResultsObserving {
    var rows: [(Double, Double, [String: Double], String)] = []
    func request(_ request: SNRequest, didProduce result: SNResult) {
        guard let r = result as? SNClassificationResult else { return }
        var m: [String: Double] = [:]
        for c in r.classifications { m[c.identifier] = c.confidence }
        rows.append((r.timeRange.start.seconds, r.timeRange.duration.seconds, m, r.classifications.first?.identifier ?? ""))
    }
}

for f in files {
    do {
        let analyzer = try SNAudioFileAnalyzer(url: URL(fileURLWithPath: f))
        let c = Collector()
        try analyzer.add(request, withObserver: c)
        analyzer.analyze()
        let scored = c.rows.map { row -> (Double, Double, String) in
            let s = labels.map { row.2[$0] ?? 0 }.max() ?? 0
            return (row.0, s, row.3)
        }
        let best = scored.max { $0.1 < $1.1 }
        let mean = scored.isEmpty ? 0 : scored.map(\.1).reduce(0, +) / Double(scored.count)
        let tops = Dictionary(grouping: c.rows.map(\.3), by: { $0 }).mapValues(\.count).sorted { $0.value > $1.value }.prefix(3).map { "\($0.key)×\($0.value)" }.joined(separator: " ")
        print(String(format: "%@\tbest=%.2f@%.1fs\tmean=%.2f\ttop: %@", (f as NSString).lastPathComponent, best?.1 ?? 0, best?.0 ?? 0, mean, tops))
    } catch {
        print("\(f)\tERROR \(error)")
    }
}
