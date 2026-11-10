// Waits for App Store Connect to finish processing an uploaded build and exits with its verdict.
// An upload that "succeeded" can still be rejected minutes later (e.g. ITMS-90626, an App Intent
// description containing "Apple"), and then the build never reaches TestFlight while CI shows
// green. release_testflight.sh runs this after the upload so a rejection fails the run with Apple's
// reason. No dependencies: the API token is signed with CryptoKit.
//
//   swift asc_build_status.swift <key.p8> <key id> <issuer id> <bundle id> <build number> [timeout s]
//
// Exit 0: processed (COMPLETE). 1: rejected (Apple's errors printed). 2: still processing at the timeout.
import CryptoKit
import Foundation

let args = CommandLine.arguments
guard args.count >= 6 else {
    FileHandle.standardError.write(Data("usage: asc_build_status.swift <key.p8> <key id> <issuer id> <bundle id> <build number> [timeout s]\n".utf8))
    exit(64)
}
let (keyPath, keyID, issuer, bundleID, build) = (args[1], args[2], args[3], args[4], args[5])
let timeout = args.count > 6 ? Double(args[6]) ?? 1200 : 1200

func base64url(_ d: Data) -> String {
    d.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
}

func token() throws -> String {
    let key = try P256.Signing.PrivateKey(pemRepresentation: String(contentsOfFile: keyPath, encoding: .utf8))
    let now = Int(Date().timeIntervalSince1970)
    let header = base64url(try JSONSerialization.data(withJSONObject: ["alg": "ES256", "kid": keyID, "typ": "JWT"]))
    let claims = base64url(try JSONSerialization.data(withJSONObject: ["iss": issuer, "iat": now, "exp": now + 1000, "aud": "appstoreconnect-v1"]))
    let signature = try key.signature(for: Data("\(header).\(claims)".utf8))
    return "\(header).\(claims).\(base64url(signature.rawRepresentation))"
}

func get(_ path: String) async throws -> [String: Any] {
    var req = URLRequest(url: URL(string: "https://api.appstoreconnect.apple.com\(path)")!)
    req.setValue("Bearer \(try token())", forHTTPHeaderField: "Authorization")
    let (data, resp) = try await URLSession.shared.data(for: req)
    let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
    guard code == 200 else { throw NSError(domain: "asc", code: code, userInfo: [NSLocalizedDescriptionKey: String(decoding: data.prefix(400), as: UTF8.self)]) }
    return try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
}

let apps = try await get("/v1/apps?filter[bundleId]=\(bundleID)")
guard let app = (apps["data"] as? [[String: Any]])?.first?["id"] as? String else {
    print("error: no App Store Connect app for \(bundleID)")
    exit(1)
}

let deadline = Date().addingTimeInterval(timeout)
var last = ""
while Date() < deadline {
    // a transient API error is retried like an unfinished build
    if let uploads = try? await get("/v1/apps/\(app)/buildUploads?limit=20"),
       let upload = (uploads["data"] as? [[String: Any]])?.first(where: { (($0["attributes"] as? [String: Any])?["cfBundleVersion"] as? String) == build }),
       let state = (upload["attributes"] as? [String: Any])?["state"] as? [String: Any] {
        let name = state["state"] as? String ?? "?"
        if name != last { print("   App Store Connect: build \(build) is \(name)"); last = name }
        let notes = { (key: String) in (state[key] as? [[String: Any]] ?? []).map { "ITMS-\($0["code"] ?? "?"): \($0["description"] ?? "")" } }
        switch name {
        case "COMPLETE":
            for w in notes("warnings") { print("   warning: \(w)") }
            exit(0)
        case "FAILED":
            print("error: App Store Connect rejected build \(build); it won't reach TestFlight:")
            for e in notes("errors") { print("   \(e)") }
            exit(1)
        default: break
        }
    }
    try await Task.sleep(for: .seconds(20))
}
print("warning: build \(build) was still processing after \(Int(timeout)) s (last state: \(last.isEmpty ? "not listed yet" : last))")
exit(2)
