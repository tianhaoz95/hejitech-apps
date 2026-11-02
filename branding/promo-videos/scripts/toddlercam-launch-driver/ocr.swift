// Prints the text macOS Vision reads in an image, one line per observation (the record script reads
// the parental gate's "a × b = ?" from a simulator screenshot with it).
import Foundation
import Vision
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let req = VNRecognizeTextRequest()
req.recognitionLevel = .fast
req.usesLanguageCorrection = false
try VNImageRequestHandler(url: url).perform([req])
for o in req.results ?? [] { print(o.topCandidates(1).first?.string ?? "") }
