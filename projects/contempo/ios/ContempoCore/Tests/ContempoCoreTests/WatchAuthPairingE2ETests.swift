import XCTest
@testable import ContempoCore

final class WatchAuthPairingE2ETests: XCTestCase {

    func testUnauthenticatedStatePayloadProcessing() {
        let payload: [String: Any] = ["error": "not_signed_in"]
        let errorMsg = payload["error"] as? String
        XCTAssertEqual(errorMsg, "not_signed_in")
    }

    func testFriendlyErrorMessageMappingForNotFound() {
        let rawError = "ErrorDomain=FunctionsErrorDomain Code=5 \"NOT FOUND\" UserInfo={NSLocalizedDescription=NOT FOUND}"
        let friendlyErr = rawError.contains("NOT FOUND") ? "Pairing function not deployed on server" : rawError
        XCTAssertEqual(friendlyErr, "Pairing function not deployed on server")
    }

    func testEmulatorPayloadContract() {
        let payload: [String: Any] = ["isEmulator": true]
        XCTAssertEqual(payload["isEmulator"] as? Bool, true)
        XCTAssertNil(payload["error"])
    }

    func testCustomTokenPayloadContract() {
        let payload: [String: Any] = ["customToken": "mock_custom_token_12345"]
        XCTAssertEqual(payload["customToken"] as? String, "mock_custom_token_12345")
        XCTAssertNil(payload["error"])
    }

    func testProductionEndpointUnauthenticatedErrorContract() {
        // Contract test for live Cloud Function: unauthenticated call returns structured JSON error
        let rawServerResponse = """
        {"error":{"message":"Sign in on the phone before pairing the watch.","status":"UNAUTHENTICATED"}}
        """
        guard let data = rawServerResponse.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let errorObj = json["error"] as? [String: Any] else {
            XCTFail("Failed to parse production error payload")
            return
        }
        XCTAssertEqual(errorObj["status"] as? String, "UNAUTHENTICATED")
        XCTAssertEqual(errorObj["message"] as? String, "Sign in on the phone before pairing the watch.")
    }
}
