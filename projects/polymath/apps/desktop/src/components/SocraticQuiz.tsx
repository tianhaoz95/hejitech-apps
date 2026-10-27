import React, { useState } from "react";
import type { SocraticQuizProps } from "@polymath/core";

export const SocraticQuiz: React.FC<SocraticQuizProps> = ({
  question,
  options = [],
  correctAnswerIndex = 0,
  explanation = "",
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const isSubmitted = selectedIdx !== null;
  const isCorrect = selectedIdx === correctAnswerIndex;

  return (
    <div style={{
      background: "#12151D",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: 10,
      padding: 16,
      margin: "18px 0",
      fontFamily: "Inter, sans-serif"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, color: "#A855F7", textTransform: "uppercase" }}>
        <span>💡 Check for Understanding</span>
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: "#F3F4F6", marginBottom: 12 }}>
        {question}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {options.map((opt, i) => {
          let btnBg = "rgba(255, 255, 255, 0.03)";
          let btnBorder = "rgba(255, 255, 255, 0.08)";
          let btnColor = "#D1D5DB";

          if (isSubmitted) {
            if (i === correctAnswerIndex) {
              btnBg = "rgba(16, 185, 129, 0.15)";
              btnBorder = "#10B981";
              btnColor = "#6EE7B7";
            } else if (i === selectedIdx) {
              btnBg = "rgba(239, 68, 68, 0.15)";
              btnBorder = "#EF4444";
              btnColor = "#FCA5A5";
            }
          }

          return (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              disabled={isSubmitted}
              style={{
                background: btnBg,
                border: `1px solid ${btnBorder}`,
                color: btnColor,
                borderRadius: 6,
                padding: "8px 14px",
                textAlign: "left",
                fontSize: 12,
                cursor: isSubmitted ? "default" : "pointer",
                transition: "all 0.1s ease"
              }}
            >
              <b style={{ marginRight: 8, color: "#9CA3AF" }}>{String.fromCharCode(65 + i)}.</b>
              {opt}
            </button>
          );
        })}
      </div>

      {isSubmitted && (
        <div style={{
          background: isCorrect ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
          border: `1px solid ${isCorrect ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)"}`,
          borderRadius: 6,
          padding: 10,
          fontSize: 12
        }}>
          <div style={{ fontWeight: 700, color: isCorrect ? "#10B981" : "#F59E0B", marginBottom: 4 }}>
            {isCorrect ? "✓ Correct!" : "Review Intuition:"}
          </div>
          <div style={{ color: "#D1D5DB", lineHeight: 1.5 }}>{explanation}</div>
          <button
            onClick={() => setSelectedIdx(null)}
            style={{
              marginTop: 8,
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#9CA3AF",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: 10,
              cursor: "pointer"
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
