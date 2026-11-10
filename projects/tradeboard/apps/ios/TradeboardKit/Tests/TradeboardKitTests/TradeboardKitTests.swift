import XCTest
@testable import TradeboardKit

final class TradeboardKitTests: XCTestCase {
    func testTOTPBase32Decode() {
        // "JBSWY3DPEHPK3PXP" is the standard RFC 4226 / Google Authenticator test vector ("Hello!\xde\xad\xbe\xef")
        let secret = "JBSWY3DPEHPK3PXP"
        let data = TOTP.base32Decode(secret)
        XCTAssertNotNil(data)
        XCTAssertEqual(data?.count, 10)

        // Invalid base32 characters
        XCTAssertNil(TOTP.base32Decode("1890!@#"))
    }

    func testTOTPGenerationAndVerification() {
        let secret = "JBSWY3DPEHPK3PXP"
        let date = Date(timeIntervalSince1970: 1700000000)
        let code = TOTP.generateCode(secret: secret, date: date)
        XCTAssertNotNil(code)
        XCTAssertEqual(code?.count, 6)

        // Code verification at exact time
        XCTAssertTrue(TOTP.verify(code: code!, secret: secret, date: date))

        // Code verification within 1 step drift (30 seconds)
        let datePlus25 = date.addingTimeInterval(25)
        XCTAssertTrue(TOTP.verify(code: code!, secret: secret, date: datePlus25))

        // Code verification outside tolerance (> 60 seconds)
        let datePlus120 = date.addingTimeInterval(120)
        XCTAssertFalse(TOTP.verify(code: code!, secret: secret, date: datePlus120))
    }

    func testOrderTicketEstimatedNotional() {
        let ticketShares = OrderTicket(
            ticker: "NVDA",
            side: "buy",
            order_type: "limit",
            quantity_shares: 10,
            limit_price: 135.50
        )
        XCTAssertEqual(ticketShares.estimatedNotional, 1355.0)

        let ticketDollars = OrderTicket(
            ticker: "AAPL",
            side: "buy",
            order_type: "market",
            quantity_dollars: 500.0
        )
        XCTAssertEqual(ticketDollars.estimatedNotional, 500.0)
    }

    func testBoardSummaryJSONDecoding() throws {
        let json = """
        {
            "now": "2026-11-08T16:00:00.000Z",
            "control": {
                "dry_run": true,
                "paused": false,
                "killed": false,
                "live_gate_complete": true
            },
            "executors": [
                {
                    "executor_id": "spark-dgx",
                    "online": true,
                    "label": "DGX Spark",
                    "model_name": "gemma4:26b",
                    "robinhood_account": "••••5678"
                }
            ],
            "plans": [
                {
                    "plan_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
                    "title": "NVDA pull-back long",
                    "status": "ready",
                    "ticker": "NVDA",
                    "current_version": 2,
                    "created_at": "2026-11-08T14:00:00.000Z",
                    "updated_at": "2026-11-08T15:30:00.000Z",
                    "valid_until": "2026-11-08T20:00:00.000Z",
                    "open_questions": 0,
                    "awaiting_agents": []
                }
            ]
        }
        """

        let summary = try JSONDecoder().decode(BoardSummary.self, from: Data(json.utf8))
        XCTAssertEqual(summary.control.dry_run, true)
        XCTAssertEqual(summary.control.killed, false)
        XCTAssertEqual(summary.executors.count, 1)
        XCTAssertEqual(summary.executors[0].model_name, "gemma4:26b")
        XCTAssertEqual(summary.plans.count, 1)
        XCTAssertEqual(summary.plans[0].ticker, "NVDA")
        XCTAssertEqual(summary.plans[0].status, "ready")
    }

    func testPlanDetailJSONDecoding() throws {
        let json = """
        {
            "plan_id": "a0000000-0000-0000-0000-000000000001",
            "title": "AAPL Momentum Long",
            "status": "approved",
            "ticker": "AAPL",
            "side": "buy",
            "current_version": 1,
            "created_at": "2026-11-08T12:00:00.000Z",
            "updated_at": "2026-11-08T13:00:00.000Z",
            "valid_until": "2026-11-08T21:00:00.000Z",
            "validity": "valid",
            "thesis": "Solid earnings and strong catalyst",
            "order": {
                "ticker": "AAPL",
                "side": "buy",
                "order_type": "limit",
                "quantity_shares": 5,
                "limit_price": 220.0,
                "time_in_force": "day",
                "account_scope": "dedicated_mcp_account_only"
            },
            "approval": {
                "approval_id": "app-001",
                "version": 1,
                "approved_at": "2026-11-08T13:00:00.000Z",
                "expires_at": "2026-11-08T20:00:00.000Z",
                "note": "Approved for market open"
            },
            "comments": [
                {
                    "comment_id": "c-001",
                    "plan_id": "a0000000-0000-0000-0000-000000000001",
                    "author_type": "agent",
                    "author_id": "claude",
                    "body": "Risk/reward ratio looks very favorable.",
                    "created_at": "2026-11-08T12:30:00.000Z"
                }
            ],
            "receipts": [
                {
                    "receipt_id": "rcpt-001",
                    "version": 1,
                    "attempted_at": "2026-11-08T13:30:00.000Z",
                    "mode": "dry_run",
                    "outcome": "success",
                    "filled_quantity": 5,
                    "filled_price": 219.85
                }
            ]
        }
        """

        let plan = try JSONDecoder().decode(PlanDetail.self, from: Data(json.utf8))
        XCTAssertEqual(plan.ticker, "AAPL")
        XCTAssertEqual(plan.status, "approved")
        XCTAssertEqual(plan.order.limit_price, 220.0)
        XCTAssertEqual(plan.order.estimatedNotional, 1100.0)
        XCTAssertEqual(plan.approval?.approval_id, "app-001")
        XCTAssertEqual(plan.comments?.count, 1)
        XCTAssertEqual(plan.comments?[0].author_id, "claude")
        XCTAssertEqual(plan.receipts?.count, 1)
        XCTAssertEqual(plan.receipts?[0].filled_price, 219.85)
    }

    func testAnyCodableRoundTrip() throws {
        let dict: [String: AnyCodable] = [
            "name": AnyCodable("Tradeboard"),
            "count": AnyCodable(42),
            "ratio": AnyCodable(1.25),
            "enabled": AnyCodable(true)
        ]

        let encoded = try JSONEncoder().encode(dict)
        let decoded = try JSONDecoder().decode([String: AnyCodable].self, from: encoded)

        XCTAssertEqual(decoded["name"]?.value as? String, "Tradeboard")
        XCTAssertEqual(decoded["count"]?.value as? Int, 42)
        XCTAssertEqual(decoded["enabled"]?.value as? Bool, true)
    }
}
