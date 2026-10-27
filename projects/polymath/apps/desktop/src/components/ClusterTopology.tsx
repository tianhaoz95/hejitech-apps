import React from "react";
import type { ClusterTopologyProps } from "@polymath/core";

export const ClusterTopology: React.FC<ClusterTopologyProps> = ({
  gpusPerNode = 8,
  interconnect = "nvlink",
  tensorParallelSize = 8,
}) => {
  const gpus = Array.from({ length: gpusPerNode }, (_, i) => i);

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
          <b style={{ fontSize: 13, color: "#F3F4F6" }}>Multi-GPU Cluster Interconnect Topology</b>
          <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>
            ({gpusPerNode}x H100 SXM5 · {interconnect.toUpperCase()} Mesh 900 GB/s)
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
          <span style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10B981", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
            TP = {tensorParallelSize}
          </span>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 10,
        marginBottom: 12
      }}>
        {gpus.map((gpu) => (
          <div
            key={gpu}
            style={{
              background: "#090B0F",
              border: "1px solid #76B900",
              borderRadius: 6,
              padding: 10,
              fontSize: 11
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: 4 }}>
              <span style={{ color: "#76B900" }}>GPU #{gpu}</span>
              <span style={{ color: "#9CA3AF", fontSize: 10 }}>Rank {gpu}</span>
            </div>
            <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 6 }}>
              Layer Slice: {gpu * 10}..{(gpu + 1) * 10}
            </div>
            <div style={{ height: 4, background: "#1F2937", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ width: `${50 + gpu * 5}%`, height: "100%", background: "#76B900" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, fontFamily: "JetBrains Mono", color: "#9CA3AF" }}>
              <span>Ring: Active</span>
              <span>{(68.2 + gpu * 0.8).toFixed(1)} GB/s</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: "#9CA3AF", background: "rgba(255,255,255,0.02)", padding: 8, borderRadius: 6, display: "flex", justifyContent: "space-between" }}>
        <span>Collective All-Reduce: <b>Ring Pattern</b> across all 8 ranks</span>
        <span style={{ fontFamily: "JetBrains Mono", color: "#10B981" }}>Latency: 1.42ms</span>
      </div>
    </div>
  );
};
