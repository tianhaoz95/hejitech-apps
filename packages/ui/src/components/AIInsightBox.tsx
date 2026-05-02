import React from "react"
import { Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"

interface AIInsightBoxProps {
  summary?: string
  loading?: boolean
  quotaRemaining?: number | null
  onAnalyze: () => void
  disabled?: boolean
}

export function AIInsightBox({ summary, loading, quotaRemaining, onAnalyze, disabled }: AIInsightBoxProps) {
  return (
    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-600" size={16} />
          <h3 className="text-sm font-semibold text-purple-900">AI Deal Summary</h3>
        </div>
        <div className="flex items-center gap-2">
          {quotaRemaining !== null && quotaRemaining !== undefined && (
            <span className="text-[10px] text-purple-400 font-medium">{quotaRemaining} left</span>
          )}
          <button
            onClick={onAnalyze}
            disabled={disabled || loading}
            className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg hover:bg-purple-700 disabled:opacity-40 transition-colors"
          >
            {loading ? "Analyzing…" : summary ? "Regenerate" : "Analyze"}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-3 bg-purple-200 rounded animate-pulse w-full" />
          <div className="h-3 bg-purple-200 rounded animate-pulse w-4/5" />
          <div className="h-3 bg-purple-200 rounded animate-pulse w-3/5" />
        </div>
      ) : summary ? (
        <div className="text-xs text-purple-800 bg-white/50 p-2 rounded-lg">
          <ReactMarkdown
            components={{
              p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
              ul: ({ ...props }) => <ul className="mb-2 list-disc pl-4" {...props} />,
              ol: ({ ...props }) => <ol className="mb-2 list-decimal pl-4" {...props} />,
              li: ({ ...props }) => <li className="mb-1" {...props} />,
              strong: ({ ...props }) => <strong className="font-bold" {...props} />,
              h1: ({ ...props }) => <h1 className="font-black uppercase text-[10px] mt-3 mb-1 tracking-wider" {...props} />,
              h2: ({ ...props }) => <h2 className="font-black uppercase text-[10px] mt-3 mb-1 tracking-wider" {...props} />,
              h3: ({ ...props }) => <h3 className="font-black uppercase text-[10px] mt-3 mb-1 tracking-wider" {...props} />,
            }}
          >
            {summary}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-xs text-purple-400 italic">
          Click Analyze for AI-powered red flag detection and rehab estimate.
        </p>
      )}
    </div>
  )
}
