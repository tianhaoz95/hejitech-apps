import Foundation

// MARK: - AnyCodable helper for heterogeneous JSON dictionaries

public struct AnyCodable: Codable, Hashable, @unchecked Sendable {
    public let value: AnyHashable

    public init(_ value: AnyHashable) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self.value = ""
        } else if let bool = try? container.decode(Bool.self) {
            self.value = bool
        } else if let int = try? container.decode(Int.self) {
            self.value = int
        } else if let double = try? container.decode(Double.self) {
            self.value = double
        } else if let string = try? container.decode(String.self) {
            self.value = string
        } else if let array = try? container.decode([AnyCodable].self) {
            self.value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            self.value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode AnyCodable")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch value {
        case let bool as Bool:
            try container.encode(bool)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let string as String:
            try container.encode(string)
        case let array as [AnyHashable]:
            try container.encode(array.map { AnyCodable($0) })
        case let dict as [String: AnyHashable]:
            try container.encode(dict.mapValues { AnyCodable($0) })
        default:
            try container.encode(String(describing: value))
        }
    }
}

// MARK: - Actors and Identifiers

public struct ActorIdentity: Codable, Hashable, Sendable {
    public var type: String
    public var id: String

    public init(type: String, id: String) {
        self.type = type
        self.id = id
    }
}

// MARK: - Order Ticket

public struct OrderTicket: Codable, Hashable, Sendable {
    public var ticker: String
    public var side: String
    public var order_type: String
    public var quantity_shares: Double?
    public var quantity_dollars: Double?
    public var limit_price: Double?
    public var stop_price: Double?
    public var time_in_force: String?
    public var account_scope: String?

    public init(
        ticker: String,
        side: String = "buy",
        order_type: String = "limit",
        quantity_shares: Double? = nil,
        quantity_dollars: Double? = nil,
        limit_price: Double? = nil,
        stop_price: Double? = nil,
        time_in_force: String? = "day",
        account_scope: String? = "dedicated_mcp_account_only"
    ) {
        self.ticker = ticker
        self.side = side
        self.order_type = order_type
        self.quantity_shares = quantity_shares
        self.quantity_dollars = quantity_dollars
        self.limit_price = limit_price
        self.stop_price = stop_price
        self.time_in_force = time_in_force
        self.account_scope = account_scope
    }

    public var estimatedNotional: Double {
        if let dollars = quantity_dollars, dollars > 0 { return dollars }
        if let shares = quantity_shares, let price = limit_price { return shares * price }
        return 0
    }
}

// MARK: - Board Control & Gate State

public struct GateItem: Codable, Hashable, Sendable, Identifiable {
    public var id: String
    public var label: String
    public var done: Bool
    public var detail: String

    public init(id: String, label: String, done: Bool, detail: String) {
        self.id = id
        self.label = label
        self.done = done
        self.detail = detail
    }
}

public struct GateState: Codable, Hashable, Sendable {
    public var complete: Bool?
    public var items: [GateItem]?

    public init(complete: Bool? = nil, items: [GateItem]? = nil) {
        self.complete = complete
        self.items = items
    }
}

public struct BoardControl: Codable, Hashable, Sendable {
    public var paused: Bool
    public var killed: Bool
    public var dry_run: Bool
    public var live_gate_complete: Bool?
    public var live_trial_pending: Bool?
    public var approvals_mode: String?
    public var confirmed_account_mask: String?
    public var gate: GateState?

    public init(
        paused: Bool = false,
        killed: Bool = false,
        dry_run: Bool = true,
        live_gate_complete: Bool? = nil,
        live_trial_pending: Bool? = nil,
        approvals_mode: String? = nil,
        confirmed_account_mask: String? = nil,
        gate: GateState? = nil
    ) {
        self.paused = paused
        self.killed = killed
        self.dry_run = dry_run
        self.live_gate_complete = live_gate_complete
        self.live_trial_pending = live_trial_pending
        self.approvals_mode = approvals_mode
        self.confirmed_account_mask = confirmed_account_mask
        self.gate = gate
    }
}

// MARK: - Executor Status

public struct ExecutorItem: Codable, Hashable, Sendable, Identifiable {
    public var id: String { executor_id }
    public var executor_id: String
    public var last_heartbeat_at: String?
    public var online: Bool
    public var label: String?
    public var allow_live: Bool?
    public var robinhood_account: String?
    public var model_name: String?

    public init(
        executor_id: String,
        last_heartbeat_at: String? = nil,
        online: Bool = false,
        label: String? = nil,
        allow_live: Bool? = nil,
        robinhood_account: String? = nil,
        model_name: String? = nil
    ) {
        self.executor_id = executor_id
        self.last_heartbeat_at = last_heartbeat_at
        self.online = online
        self.label = label
        self.allow_live = allow_live
        self.robinhood_account = robinhood_account
        self.model_name = model_name
    }
}

// MARK: - Plan Summary (List item)

public struct PlanSummary: Codable, Hashable, Sendable, Identifiable {
    public var id: String { plan_id }
    public var plan_id: String
    public var title: String
    public var status: String
    public var ticker: String
    public var is_demo: Bool?
    public var author: ActorIdentity?
    public var current_version: Int
    public var created_at: String
    public var updated_at: String
    public var last_activity_at: String?
    public var valid_from: String?
    public var valid_until: String
    public var validity: String?
    public var expires_in_ms: Double?
    public var open_questions: Int?
    public var open_human_questions: Int?
    public var awaiting_agents: [String]?

    public init(
        plan_id: String,
        title: String,
        status: String,
        ticker: String,
        is_demo: Bool? = nil,
        author: ActorIdentity? = nil,
        current_version: Int = 1,
        created_at: String = "",
        updated_at: String = "",
        last_activity_at: String? = nil,
        valid_from: String? = nil,
        valid_until: String = "",
        validity: String? = nil,
        expires_in_ms: Double? = nil,
        open_questions: Int? = 0,
        open_human_questions: Int? = 0,
        awaiting_agents: [String]? = []
    ) {
        self.plan_id = plan_id
        self.title = title
        self.status = status
        self.ticker = ticker
        self.is_demo = is_demo
        self.author = author
        self.current_version = current_version
        self.created_at = created_at
        self.updated_at = updated_at
        self.last_activity_at = last_activity_at
        self.valid_from = valid_from
        self.valid_until = valid_until
        self.validity = validity
        self.expires_in_ms = expires_in_ms
        self.open_questions = open_questions
        self.open_human_questions = open_human_questions
        self.awaiting_agents = awaiting_agents
    }
}

// MARK: - Board Summary (GET /api/board)

public struct BoardSummary: Codable, Hashable, Sendable {
    public var now: String?
    public var plans: [PlanSummary]
    public var control: BoardControl
    public var executors: [ExecutorItem]

    public init(
        now: String? = nil,
        plans: [PlanSummary] = [],
        control: BoardControl = BoardControl(),
        executors: [ExecutorItem] = []
    ) {
        self.now = now
        self.plans = plans
        self.control = control
        self.executors = executors
    }
}

// MARK: - Plan Detail (GET /api/plans/:id)

public struct ApprovalItem: Codable, Hashable, Sendable {
    public var approval_id: String
    public var version: Int
    public var approved_at: String
    public var expires_at: String
    public var note: String?

    public init(approval_id: String, version: Int, approved_at: String, expires_at: String, note: String? = nil) {
        self.approval_id = approval_id
        self.version = version
        self.approved_at = approved_at
        self.expires_at = expires_at
        self.note = note
    }
}

public struct CommentItem: Codable, Hashable, Sendable, Identifiable {
    public var id: String { comment_id }
    public var comment_id: String
    /// Not in the plan view's comments (they're already under their plan).
    public var plan_id: String?
    public var version: Int?
    public var author_type: String
    public var author_id: String
    public var body: String
    public var anchor: String?
    public var is_question: Bool?
    public var question_status: String?
    public var parent_comment_id: String?
    public var created_at: String

    // The API calls a question's state `status` (open / resolved).
    enum CodingKeys: String, CodingKey {
        case comment_id, plan_id, version, author_type, author_id, body, anchor, is_question, parent_comment_id, created_at
        case question_status = "status"
    }

    public init(
        comment_id: String,
        plan_id: String? = nil,
        version: Int? = nil,
        author_type: String,
        author_id: String,
        body: String,
        anchor: String? = nil,
        is_question: Bool? = nil,
        question_status: String? = nil,
        parent_comment_id: String? = nil,
        created_at: String = ""
    ) {
        self.comment_id = comment_id
        self.plan_id = plan_id
        self.version = version
        self.author_type = author_type
        self.author_id = author_id
        self.body = body
        self.anchor = anchor
        self.is_question = is_question
        self.question_status = question_status
        self.parent_comment_id = parent_comment_id
        self.created_at = created_at
    }
}

public struct StrategyFit: Codable, Hashable, Sendable {
    public var fit: String
    public var note: String
    public var strategy_version: Int

    public init(fit: String, note: String, strategy_version: Int) {
        self.fit = fit
        self.note = note
        self.strategy_version = strategy_version
    }
}

public struct ReceiptItem: Codable, Hashable, Sendable, Identifiable {
    public var id: String { receipt_id }
    public var receipt_id: String
    public var version: Int
    public var executor_id: String?
    public var attempted_at: String
    public var mode: String
    public var outcome: String
    public var reason_code: String?
    public var reason_text: String?
    public var robinhood_order_id: String?
    public var filled_quantity: Double?
    public var filled_price: Double?
    public var strategy_fit: StrategyFit?

    public init(
        receipt_id: String,
        version: Int,
        executor_id: String? = nil,
        attempted_at: String = "",
        mode: String = "dry_run",
        outcome: String = "success",
        reason_code: String? = nil,
        reason_text: String? = nil,
        robinhood_order_id: String? = nil,
        filled_quantity: Double? = nil,
        filled_price: Double? = nil,
        strategy_fit: StrategyFit? = nil
    ) {
        self.receipt_id = receipt_id
        self.version = version
        self.executor_id = executor_id
        self.attempted_at = attempted_at
        self.mode = mode
        self.outcome = outcome
        self.reason_code = reason_code
        self.reason_text = reason_text
        self.robinhood_order_id = robinhood_order_id
        self.filled_quantity = filled_quantity
        self.filled_price = filled_price
        self.strategy_fit = strategy_fit
    }
}

public struct VersionItem: Codable, Hashable, Sendable, Identifiable {
    public var id: Int { version }
    public var version: Int
    public var edited_by_type: String
    public var edited_by_id: String
    public var edited_at: String
    public var diff_summary: String?

    public init(
        version: Int,
        edited_by_type: String,
        edited_by_id: String,
        edited_at: String,
        diff_summary: String? = nil
    ) {
        self.version = version
        self.edited_by_type = edited_by_type
        self.edited_by_id = edited_by_id
        self.edited_at = edited_at
        self.diff_summary = diff_summary
    }
}

public struct AuditItem: Codable, Hashable, Sendable, Identifiable {
    public var id: Int { event_id }
    public var event_id: Int
    public var actor_type: String
    public var actor_id: String
    public var action: String
    public var created_at: String

    public init(event_id: Int, actor_type: String, actor_id: String, action: String, created_at: String) {
        self.event_id = event_id
        self.actor_type = actor_type
        self.actor_id = actor_id
        self.action = action
        self.created_at = created_at
    }
}

public struct PlanPolicySnapshot: Codable, Hashable, Sendable {
    public var policy_version: Int?
    public var max_drift_pct: Double?
    public var approval_ttl: String?
    public var max_plan_age_hours: Double?

    public init(policy_version: Int? = nil, max_drift_pct: Double? = nil, approval_ttl: String? = nil, max_plan_age_hours: Double? = nil) {
        self.policy_version = policy_version
        self.max_drift_pct = max_drift_pct
        self.approval_ttl = approval_ttl
        self.max_plan_age_hours = max_plan_age_hours
    }
}

public struct PlanDetail: Codable, Hashable, Sendable, Identifiable {
    public var id: String { plan_id }
    public var plan_id: String
    public var title: String
    public var status: String
    public var is_demo: Bool?
    public var ticker: String
    public var side: String
    public var order: OrderTicket
    public var thesis: String?
    public var evidence: String?
    public var risks_and_dissent: String?
    public var invalidation: String?
    public var fit_with_strategy: String?
    public var strategy_version: Int?
    public var current_strategy_version: Int?
    public var created_at: String
    public var updated_at: String
    public var last_activity_at: String?
    public var created_by: ActorIdentity?
    public var valid_from: String?
    public var valid_until: String
    public var validity: String?
    public var quote_at: String?
    public var quote_price: Double?
    public var quote_source: String?
    public var current_version: Int
    public var reason_code: String?
    public var reason_text: String?
    public var awaiting_manual: Bool?
    public var approval: ApprovalItem?
    public var comments: [CommentItem]?
    public var receipts: [ReceiptItem]?
    public var versions: [VersionItem]?
    public var audit: [AuditItem]?
    public var policy: PlanPolicySnapshot?
}

// MARK: - Strategy

public struct StrategyItem: Codable, Hashable, Sendable {
    public var version: Int
    public var content: String
    public var updated_at: String?

    public init(version: Int, content: String, updated_at: String? = nil) {
        self.version = version
        self.content = content
        self.updated_at = updated_at
    }
}

public struct StrategyResponse: Codable, Hashable, Sendable {
    public var strategy: StrategyItem?
    public var interview_guide: String?

    public init(strategy: StrategyItem? = nil, interview_guide: String? = nil) {
        self.strategy = strategy
        self.interview_guide = interview_guide
    }
}

// MARK: - User Info

public struct MeResponse: Codable, Hashable, Sendable {
    public var signed_in: Bool
    public var email: String?
    public var now: String?
    public var suggested_valid_until: String?
}
