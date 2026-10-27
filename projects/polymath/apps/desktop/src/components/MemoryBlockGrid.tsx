import React from "react";
import type { MemoryBlockGridProps } from "@polymath/core";

interface ExtendedMemoryBlockGridProps extends MemoryBlockGridProps {
  theme?: "dark" | "light";
}

export const MemoryBlockGrid: React.FC<ExtendedMemoryBlockGridProps> = ({
  totalBlocks = 32,
  allocatedBlocks = 18,
  sharedPrefixBlocks = 8,
  blockSizeTokens = 16,
  title = "GPU HBM3 Memory Map (PagedAttention)",
  theme = "dark",
}) => {
  const freeBlocks = Math.max(0, totalBlocks - allocatedBlocks - sharedPrefixBlocks);

  const blocks: Array<"alloc" | "shared" | "free"> = [];
  for (let i = 0; i < allocatedBlocks; i++) blocks.push("alloc");
  for (let i = 0; i < sharedPrefixBlocks; i++) blocks.push("shared");
  for (let i = 0; i < freeBlocks; i++) blocks.push("free");

  const utilPercent = Math.round(((allocatedBlocks + sharedPrefixBlocks) / totalBlocks) * 100);
  const isLight = theme === "light";

  const cardBg = isLight ? "#FFFFFF" : "#0D1117";
  const borderColor = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";
  const textColor = isLight ? "#1F2328" : "#F0F6FC";
  const mutColor = isLight ? "#656D76" : "#8B949E";

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: 16,
        margin: "18px 0",
        fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
        boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "0 4px 12px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <b style={{ fontSize: 13, color: textColor }}>{title}</b>
          <span style={{ fontSize: 11, color: mutColor, marginLeft: 8 }}>
            (Block Size: {blockSizeTokens} tokens)
          </span>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, fontFamily: "JetBrains Mono, monospace" }}>
          <span style={{ color: isLight ? "#0284C7" : "#38BDF8", fontWeight: 600 }}>{utilPercent}% Utilized</span>
          <span style={{ color: isLight ? "#7C3AED" : "#C084FC", fontWeight: 600 }}>
            {sharedPrefixBlocks} Shared Blocks
          </span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(16, 1fr)",
          gap: 5,
          marginBottom: 12,
        }}
      >
        {blocks.map((type, idx) => (
          <div
            key={idx}
            title={`Block #${idx} (${type.toUpperCase()})`}
            style={{
              height: 24,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 600,
              background:
                type === "alloc"
                  ? isLight ? "#0284C7" : "#0891B2"
                  : type === "shared"
                  ? "#7C3AED"
                  : isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.05)",
              color: type === "free" ? (isLight ? "#6B7280" : "#6B7280") : "#FFFFFF",
              border: type === "free" ? `1px solid ${borderColor}` : "none",
              boxShadow: type !== "free" ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
            }}
          >
            {idx}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          fontSize: 10,
          color: mutColor,
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: isLight ? "#0284C7" : "#0891B2" }} />
          Active Tokens
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: "#7C3AED" }} />
          Radix Prefix Reused (0x Overhead)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${borderColor}`,
            }}
          />
          Free Pool
        </span>
      </div>
    </div>
  );
};
