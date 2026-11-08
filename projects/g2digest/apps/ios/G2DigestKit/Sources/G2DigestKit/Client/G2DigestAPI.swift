import Foundation

public enum APIError: LocalizedError, Sendable {
    case invalidURL
    case networkError(String)
    case serverError(statusCode: Int, message: String)
    case decodingError(String)
    case unauthenticated

    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL."
        case .networkError(let msg):
            return "Network connection issue: \(msg)"
        case .serverError(let code, let msg):
            return "Server returned error (\(code)): \(msg)"
        case .decodingError(let msg):
            return "Failed to parse data: \(msg)"
        case .unauthenticated:
            return "Not authenticated or pairing code invalid."
        }
    }
}

public actor G2DigestAPI {
    public static let defaultBaseURL = URL(string: "https://g2digest.hejitech.workers.dev")!

    private let baseURL: URL
    private var token: String?
    private let session: URLSession

    public init(baseURL: URL = defaultBaseURL, token: String? = nil, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.token = token
        self.session = session
    }

    public func setToken(_ newToken: String?) {
        self.token = newToken
    }

    public func getToken() -> String? {
        return self.token
    }

    private func makeRequest(path: String, method: String = "GET", body: Data? = nil) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = token, !token.isEmpty {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body
        return req
    }

    public func redeemPairingCode(code: String, label: String = "iPhone App") async throws -> PairResult {
        let cleanCode = code.filter { $0.isNumber }
        let payload: [String: String] = ["code": cleanCode, "label": label]
        let body = try JSONSerialization.data(withJSONObject: payload)

        let req = try makeRequest(path: "/api/pair", method: "POST", body: body)
        let (data, response) = try await session.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }

        if http.statusCode != 200 {
            let errorMsg = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                ?? "Failed to redeem code"
            throw APIError.serverError(statusCode: http.statusCode, message: errorMsg)
        }

        let decoder = JSONDecoder()
        let result = try decoder.decode(PairResult.self, from: data)
        self.token = result.deviceToken
        return result
    }

    public func fetchDeviceStatus() async throws -> DeviceStatus {
        let req = try makeRequest(path: "/api/device")
        let (data, response) = try await session.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }
        if http.statusCode == 401 {
            throw APIError.unauthenticated
        }
        guard http.statusCode == 200 else {
            throw APIError.serverError(statusCode: http.statusCode, message: "Status check failed")
        }

        return try JSONDecoder().decode(DeviceStatus.self, from: data)
    }

    public func fetchEditions() async throws -> [EditionSummary] {
        let req = try makeRequest(path: "/api/editions")
        let (data, response) = try await session.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }
        if http.statusCode == 401 {
            throw APIError.unauthenticated
        }
        guard http.statusCode == 200 else {
            throw APIError.serverError(statusCode: http.statusCode, message: "Failed to list editions")
        }

        return try JSONDecoder().decode([EditionSummary].self, from: data)
    }

    public func fetchEdition(date: String = "latest") async throws -> EditionResponse {
        let req = try makeRequest(path: "/api/editions/\(date)")
        let (data, response) = try await session.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }
        if http.statusCode == 401 {
            throw APIError.unauthenticated
        }
        if http.statusCode == 404 {
            throw APIError.serverError(statusCode: 404, message: "No edition available for \(date)")
        }
        guard http.statusCode == 200 else {
            throw APIError.serverError(statusCode: http.statusCode, message: "Failed to fetch edition")
        }

        return try JSONDecoder().decode(EditionResponse.self, from: data)
    }

    public func fetchBrief() async throws -> Brief {
        let req = try makeRequest(path: "/api/brief")
        let (data, response) = try await session.data(for: req)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.networkError("Invalid HTTP response")
        }
        if http.statusCode == 401 {
            throw APIError.unauthenticated
        }
        guard http.statusCode == 200 else {
            throw APIError.serverError(statusCode: http.statusCode, message: "Failed to fetch brief")
        }

        return try JSONDecoder().decode(Brief.self, from: data)
    }
}
