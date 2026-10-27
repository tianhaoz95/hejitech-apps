import React from "react";
import type { MemoryBlockGridProps } from "@polymath/core";

export const MemoryBlockGrid: React.FC<MemoryBlockGridProps> = ({
  totalBlocks = 32,
  allocatedBlocks = 18,
  sharedPrefixBlocks = 8,
  blockSizeTokens = 16,
  title = "GPU HBM3 Memory Map (PagedAttention)",
}) => {
  const freeBlocks = Math.max(0, totalBlocks - allocatedBlocks - sharedPrefixBlocks);

  const blocks: Array<"alloc" | "shared" | "free"> = [];
  for (let i = 0; i < allocatedBlocks; i++) blocks.push("alloc");
  for (let i = 0; i < sharedPrefixBlocks; i++) blocks.push("shared");
  for (let i = 0; i < freeBlocks; i++) blocks.push("free");

  const utilPercent = Math.round(((allocatedBlocks + sharedPrefixBlocks) / totalBlocks) * 100);

  return (
    <div style={{
      background: "#12151D",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: 10,
      padding: 16,
      margin: "18px 0",
      fontFamily: "Inter, sans-serif"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <b style={{ fontSize: 13, color: "#F3F4F6" }}>{title}</b>
          <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>(Block Size: {blockSizeTokens} tokens)</span>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
          <span style={{ color: "#06B6D4", fontFamily: "JetBrains Mono" }}>{utilPercent}% Utilized</span>
          <span style={{ color: "#A855F7", fontFamily: "JetBrains Mono" }}>{sharedPrefixBlocks} Shared Blocks</span>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(16, 1fr)",
        gap: 5,
        marginBottom: 12
      }}>
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
                  ? "rgba(6, 182, 212, 0.3)"
                  : type === "shared"
                  ? "rgba(168, 85, 247, 0.35)"
                  : "rgba(255, 255, 255, 0.04)",
              color:
                type === "alloc"
                  ? "#67E8F9"
                  : type === "shared"
                  ? "#D8B4FE"
                  : "#4B5563",
              border:
                type === "alloc"
                  ? "1px solid #06B6D4"
                  : type === "shared"
                  ? "1px solid #A855F7"
                  : "1px dashed rgba(255, 255, 255, 0.1)",
              cursor: "pointer",
              transition: "transform 0.1s ease",
            }}
          >
            {idx}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 10, color: "#9CA3AF" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: "#06B6D4", display: "inline-block" }} /> Active Allocations
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: "#A855F7", display: "inline-block" }} /> Radix Prefix Reused (0x Overhead)
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <i style={{ width: 8, height: 8, borderRadius: 2, background: "rgba(255,255,255,0.1)", display: "inline-block" }} /> Free Blocks
        </span>
      </div>
    </div>
  );
};
