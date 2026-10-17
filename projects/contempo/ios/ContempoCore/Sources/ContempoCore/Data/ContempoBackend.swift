import Foundation
@preconcurrency import Supabase

/// Contempo's backend: the shared HEJI Supabase project, schema `contempo`
/// (projects/contempo/backend.env lists this file), plus the Contempo Worker's API for what needs a
/// server (cloud AI, account deletion, watch pairing). Replaces Firebase Auth/Firestore/Storage/
/// Functions on the phone, the widgets and the watch alike.
public enum ContempoBackend {
    public static let supabaseURL = URL(string: "https://jitdzllkxfhlrxxvljhp.supabase.co")!
    public static let publishableKey = "sb_publishable_lZSe_L4Wd0Sw01h25eixzQ_vLU7FPP8"
    public static let workerURL = URL(string: "https://contempo.hejitech.workers.dev")!
    public static let schema = "contempo"
    public static let bucket = "contempo"
    /// Google sign-in (Supabase, PKCE in ASWebAuthenticationSession) comes back here.
    public static let redirectURL = URL(string: "com.hejitech.contempoapp://login-callback")!

    public static let client = SupabaseClient(
        supabaseURL: supabaseURL,
        supabaseKey: publishableKey,
        options: SupabaseClientOptions(
            db: .init(schema: schema),
            auth: .init(redirectToURL: redirectURL, flowType: .pkce)
        )
    )

    public static var uid: String? { client.auth.currentUser?.id.uuidString.lowercased() }

    public static func requireUid() throws -> String {
        guard let uid else { throw ContempoBackendError.notSignedIn }
        return uid
    }

    public static var email: String? { client.auth.currentUser?.email }

    public static func newId() -> String { UUID().uuidString.lowercased() }

    /// The signed-in user's rows of `table`, kept live: an initial select, then a reload on every
    /// Realtime change to that table (RLS scopes both to the user). Replaces snapshot listeners.
    public static func liveRows<T: Decodable & Sendable>(
        _ table: String,
        orderBy column: String,
        ascending: Bool,
        as type: T.Type = T.self
    ) -> AsyncThrowingStream<[T], Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let uid = try requireUid()
                    func load() async throws {
                        let rows: [T] = try await client.from(table).select().order(column, ascending: ascending).execute().value
                        continuation.yield(rows)
                    }
                    let channel = client.channel("contempo-\(table)-\(UUID().uuidString)")
                    let changes = channel.postgresChange(AnyAction.self, schema: schema, table: table, filter: "user_id=eq.\(uid)")
                    try await load()
                    await channel.subscribe()
                    defer { Task { await client.removeChannel(channel) } }
                    for await _ in changes {
                        try await load()
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// Uploads to the private bucket at `path` (must start with the user's id); returns a long-lived signed URL.
    public static func uploadFile(path: String, data: Data, contentType: String) async throws -> String {
        let bucket = client.storage.from(Self.bucket)
        _ = try await bucket.upload(path, data: data, options: FileOptions(contentType: contentType, upsert: true))
        return try await bucket.createSignedURL(path: path, expiresIn: 10 * 365 * 24 * 3600).absoluteString
    }

    public static func downloadFile(path: String) async throws -> Data {
        try await client.storage.from(bucket).download(path: path)
    }

    public static func signedURL(path: String) async throws -> String {
        try await client.storage.from(bucket).createSignedURL(path: path, expiresIn: 10 * 365 * 24 * 3600).absoluteString
    }

    public static func removeFile(path: String) async throws {
        _ = try await client.storage.from(bucket).remove(paths: [path])
    }

    /// POST to the Contempo Worker's API as the signed-in user (services/web/src/worker/index.ts).
    public static func api(_ path: String, body: [String: Any] = [:]) async throws -> [String: Any] {
        let session = try await client.auth.session
        var request = URLRequest(url: workerURL.appendingPathComponent("api/\(path)"))
        request.httpMethod = "POST"
        request.timeoutInterval = 90
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw ContempoBackendError.api((json["error"] as? String) ?? "Request failed")
        }
        return json
    }
}

public enum ContempoBackendError: LocalizedError, Sendable {
    case notSignedIn
    case api(String)

    public var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Sign in first."
        case .api(let message): return message
        }
    }
}
