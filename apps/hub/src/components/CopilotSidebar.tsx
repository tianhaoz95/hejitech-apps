import { useState, useRef, useEffect, useCallback } from "react"
import { X, Sparkles, Send, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { getGenerativeModel } from "firebase/ai"
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore"
import { calcRentalMetrics, calcFlipMetrics } from "@icecap/math"
import { ai, db } from "../core/firebase"
import { useAuth } from "../hooks/useAuth"
import type { SavedProperty, CopilotMessage, CopilotActionProposal, AdjustableField, PropertyData } from "@icecap/types"

const ASSUMPTION_FIELDS = new Set<AdjustableField>([
  "interestRate", "downPaymentPercent", "vacancyRate", "managementFeeRate",
  "maintenanceRate", "closingCostsPercent", "loanTermYears",
])

const AI_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "proposePropertyAdjustment",
        description:
          "Propose a financial adjustment to a saved property. Creates an action card the user must confirm — never applies changes directly.",
        parameters: {
          type: "object",
          properties: {
            propertyId: { type: "string", description: "Firestore document ID of the property" },
            propertyAddress: { type: "string", description: "Human-readable address" },
            field: {
              type: "string",
              description:
                "Field to adjust. Assumption fields (%): interestRate, downPaymentPercent, vacancyRate, managementFeeRate, maintenanceRate. Property fields ($): estimatedRent, rehabCost, arv, price, holdingCosts",
            },
            newValue: {
              type: "number",
              description: "New value — percentages as decimals like 6.5, dollars as whole numbers like 25000",
            },
            displayText: {
              type: "string",
              description: "One-line card header, e.g. 'Set interest rate to 6.5% for 123 Main St'",
            },
            explanation: {
              type: "string",
              description: "Why this change is proposed and its expected impact on returns",
            },
          },
          required: ["propertyId", "propertyAddress", "field", "newValue", "displayText", "explanation"],
        },
      },
    ],
  },
]

function buildSystemPrompt(portfolio: SavedProperty[]): string {
  const summary = portfolio.map((p) => ({
    id: p.id,
    address: p.address,
    price: p.price,
    mode: p.mode,
    estimatedRent: p.estimatedRent,
    rehabCost: p.rehabCost,
    arv: p.arv,
    holdingCosts: p.holdingCosts,
    assumptions: p.assumptions,
    rentalMetrics: p.rentalMetrics,
    flipMetrics: p.flipMetrics,
  }))

  return `You are the Icecap AI Co-Pilot — a real estate investment analyst in the Icecap Hub dashboard.

RULES:
1. To propose ANY financial change, call proposePropertyAdjustment. Never say "I'll adjust" without calling it.
2. Be concise. Lead with the key insight.
3. Use **bold** for addresses, dollar figures, and key metrics.
4. Reference properties by their address.
5. If no deals are saved, tell the user to save deals from the Icecap Chrome extension first.

ADJUSTABLE FIELDS: interestRate (%), downPaymentPercent (%), vacancyRate (%), managementFeeRate (%), maintenanceRate (%), estimatedRent ($), rehabCost ($), arv ($), price ($), holdingCosts ($)

USER PORTFOLIO (${portfolio.length} deal${portfolio.length !== 1 ? "s" : ""}):
${JSON.stringify(summary, null, 2)}`
}

function MsgText({ text }: { text: string }) {
  return (
    <span className="whitespace-pre-line leading-relaxed">
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

const QUICK_PROMPTS = [
  "What's my best deal?",
  "Any red flags in my portfolio?",
  "Lower the interest rate on my top deal",
]

export function CopilotSidebar({ isOpen, onClose }: Props) {
  const { user, subscription, isSubscribed } = useAuth()
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [glowId, setGlowId] = useState<string | null>(null)
  const [properties, setProperties] = useState<SavedProperty[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, "users", user.uid, "properties"), orderBy("createdAt", "desc"))
    return onSnapshot(q, (snap) => {
      setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SavedProperty)))
    })
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 150)
  }, [isOpen])

  const quotaRemaining =
    subscription?.tier === "pro_max"
      ? null
      : subscription
        ? Math.max(0, (subscription.aiQuotaLimit ?? 50) - (subscription.aiUsageCurrentMonth ?? 0))
        : 0

  const canSend =
    !isLoading &&
    input.trim().length > 0 &&
    isSubscribed &&
    (quotaRemaining === null || quotaRemaining > 0)

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !text.trim() || isLoading) return

      const userMsg: CopilotMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg])
      setInput("")
      setIsLoading(true)

      try {
        console.log("[Icecap Hub] Initializing AI model with ONLY_ON_DEVICE mode...")
        const model = getGenerativeModel(ai, {
          model: "gemini-2.0-flash",
          // @ts-ignore
          mode: "only_on_device",
          inCloudParams: {
            model: "gemini-2.0-flash",
          }
        } as any)

        console.log("[Icecap Hub] AI Model instance successfully created:", model)

        // Build history from all prior messages
        const history = messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          parts: [{ text: m.content || "" }],
        }))

        const chat = model.startChat({
          history,
          generationConfig: { maxOutputTokens: 800 },
        })

        const portfolioContext = buildSystemPrompt(properties)
        const fullPrompt = `${portfolioContext}\n\nUSER QUESTION: ${text.trim()}`
        
        console.log("[Icecap Hub] Sending context-rich prompt to local model...")
        const result = await chat.sendMessage(fullPrompt)
        console.log("[Icecap Hub] AI Response received:", result)
        const response = result.response

        let content = ""
        let proposal: CopilotActionProposal | undefined

        // Try to get text content (may throw when response is function-call-only)
        try {
          content = response.text()
        } catch {
          // function-call-only response — no text part
        }

        const calls = response.functionCalls?.() ?? []
        if (calls.length > 0 && calls[0].name === "proposePropertyAdjustment") {
          const args = calls[0].args as Record<string, unknown>
          proposal = {
            toolName: "proposePropertyAdjustment",
            propertyId: String(args.propertyId),
            propertyAddress: String(args.propertyAddress),
            field: String(args.field) as AdjustableField,
            newValue: Number(args.newValue),
            displayText: String(args.displayText),
            explanation: String(args.explanation),
          }
          if (!content) content = "I'm proposing the following adjustment:"
        }

        if (!content && !proposal) {
          content = "I couldn't generate a response. Please try again."
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content,
            actionProposal: proposal,
            actionStatus: proposal ? "pending" : undefined,
            timestamp: Date.now(),
          },
        ])

        // Optimistically increment quota counter
        updateDoc(doc(db, "subscriptions", user.uid), {
          aiUsageCurrentMonth: (subscription?.aiUsageCurrentMonth ?? 0) + 1,
          updatedAt: Date.now(),
        }).catch(console.error)
      } catch (e: any) {
        const msg =
          e?.message?.includes("quota") || e?.message?.includes("limit")
            ? "Monthly AI quota reached. Upgrade to Pro Max for unlimited access."
            : "Something went wrong. Check your connection and try again."
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: msg, timestamp: Date.now() },
        ])
      } finally {
        setIsLoading(false)
      }
    },
    [user, messages, properties, isLoading, subscription]
  )

  const handleConfirm = useCallback(
    async (msgId: string, proposal: CopilotActionProposal) => {
      if (!user || confirmingId) return
      setConfirmingId(msgId)

      try {
        const property = properties.find((p) => p.id === proposal.propertyId)
        if (!property) throw new Error("Property not found")

        const isAssumption = ASSUMPTION_FIELDS.has(proposal.field)
        const patch: Record<string, unknown> = isAssumption
          ? { [`assumptions.${proposal.field}`]: proposal.newValue }
          : { [proposal.field]: proposal.newValue }

        const updated: PropertyData = {
          mode: property.mode,
          price: proposal.field === "price" ? proposal.newValue : property.price,
          address: property.address,
          url: property.url,
          taxes: property.taxes,
          hoa: property.hoa,
          estimatedRent: proposal.field === "estimatedRent" ? proposal.newValue : property.estimatedRent,
          rehabCost: proposal.field === "rehabCost" ? proposal.newValue : property.rehabCost,
          arv: proposal.field === "arv" ? proposal.newValue : property.arv,
          holdingCosts: proposal.field === "holdingCosts" ? proposal.newValue : property.holdingCosts,
          assumptions: isAssumption
            ? { ...property.assumptions, [proposal.field]: proposal.newValue }
            : property.assumptions,
        }

        patch.rentalMetrics = calcRentalMetrics(updated)
        patch.flipMetrics = calcFlipMetrics(updated)
        patch.updatedAt = Date.now()

        await updateDoc(doc(db, "users", user.uid, "properties", proposal.propertyId), patch)

        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, actionStatus: "confirmed" as const } : m))
        )
        setGlowId(msgId)
        setTimeout(() => setGlowId(null), 2000)
      } catch (e) {
        console.error("Confirm failed:", e)
      } finally {
        setConfirmingId(null)
      }
    },
    [user, properties, confirmingId]
  )

  const handleCancel = useCallback((msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, actionStatus: "cancelled" as const } : m))
    )
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl border-l border-purple-100 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="bg-white/20 p-1.5 rounded-lg">
          <Sparkles size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">AI Co-Pilot</p>
          <p className="text-purple-200 text-[10px]">
            {quotaRemaining === null
              ? "Unlimited · Pro Max"
              : `${quotaRemaining} AI use${quotaRemaining !== 1 ? "s" : ""} remaining this month`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-purple-50/30">
        {messages.length === 0 && (
          <div className="text-center pt-8 pb-4">
            <div className="bg-purple-100 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Sparkles className="text-purple-600" size={22} />
            </div>
            <p className="text-sm font-semibold text-gray-700">How can I help?</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[240px] mx-auto">
              Ask about your portfolio, compare deals, or adjust financial assumptions.
            </p>
            <div className="mt-4 space-y-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={!isSubscribed}
                  className="block w-full text-left text-xs bg-white border border-purple-100 hover:border-purple-300 text-gray-600 hover:text-purple-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "user" ? (
              <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%] shadow-sm">
                <MsgText text={m.content} />
              </div>
            ) : (
              <div className="max-w-[90%] space-y-2">
                {m.content && (
                  <div className="bg-white border border-purple-100 text-gray-800 text-sm rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                    <MsgText text={m.content} />
                  </div>
                )}

                {m.actionProposal && (
                  <div
                    className={`bg-purple-50 border-2 rounded-2xl p-3 transition-all duration-300 ${
                      glowId === m.id
                        ? "border-purple-500 ring-2 ring-purple-300 ring-offset-1"
                        : "border-purple-200"
                    }`}
                  >
                    <p className="text-xs font-bold text-purple-900 mb-1">
                      {m.actionProposal.displayText}
                    </p>
                    <p className="text-[11px] text-purple-600 mb-2.5 leading-snug">
                      {m.actionProposal.explanation}
                    </p>

                    {m.actionStatus === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCancel(m.id)}
                          disabled={!!confirmingId}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                        >
                          <XCircle size={13} />
                          Cancel
                        </button>
                        <button
                          onClick={() => handleConfirm(m.id, m.actionProposal!)}
                          disabled={!!confirmingId}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 rounded-xl bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
                        >
                          {confirmingId === m.id ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <CheckCircle size={13} />
                          )}
                          {confirmingId === m.id ? "Applying…" : "Confirm"}
                        </button>
                      </div>
                    )}

                    {m.actionStatus === "confirmed" && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-600">
                        <CheckCircle size={13} />
                        Applied to portfolio
                      </div>
                    )}

                    {m.actionStatus === "cancelled" && (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400">
                        <XCircle size={13} />
                        Cancelled
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-purple-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-purple-100 bg-white p-3 shrink-0">
        {!isSubscribed ? (
          <p className="text-center text-xs text-gray-400 py-2">Subscribe to use AI Co-Pilot</p>
        ) : quotaRemaining === 0 ? (
          <p className="text-center text-xs text-orange-500 py-2">
            Monthly AI quota reached. Upgrade to Pro Max for unlimited.
          </p>
        ) : (
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (canSend) sendMessage(input)
                }
              }}
              placeholder="Ask about your portfolio…"
              rows={2}
              className="flex-1 resize-none text-sm bg-purple-50 border border-purple-100 rounded-xl px-3 py-2 outline-none focus:border-purple-400 placeholder-gray-400 transition-colors"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!canSend}
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors"
            >
              <Send size={15} />
            </button>
          </div>
        )}
        <p className="text-[10px] text-gray-300 text-center mt-1.5">
          AI may be wrong · Always verify before investing
        </p>
      </div>
    </div>
  )
}
