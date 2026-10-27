import React from "react";
import type { RooflinePlotProps } from "@polymath/core";

export const RooflinePlot: React.FC<RooflinePlotProps> = ({
  arithmeticIntensity = 1.8,
  achievedTflops = 620,
  memoryCeilingTbs = 3.35,
  computeCeilingTflops = 989,
  kernelLabel = "Attention Decode Kernel",
}) => {
  return (
    <div style={{
      background: "#12151D",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: 10,
      padding: 16,
      margin: "18px 0",
      fontFamily: "Inter, sans-serif"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <b style={{ fontSize: 13, color: "#F3F4F6" }}>Arithmetic Intensity Roofline Model</b>
          <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: 8 }}>NVIDIA H100 SXM5 (3.35 TB/s HBM3)</span>
        </div>
        <div style={{ fontSize: 11, color: "#F59E0B", fontFamily: "JetBrains Mono" }}>
          Peak: {computeCeilingTflops} TFLOP/s
        </div>
      </div>

      <div style={{
        height: 180,
        background: "#090B0F",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        borderRadius: 6,
        position: "relative",
        overflow: "hidden",
        padding: "20px 30px"
      }}>
        {/* Sloped Memory Bandwidth Ceiling Line */}
        <div style={{
          position: "absolute",
          bottom: 25,
          left: 30,
          width: "55%",
          height: "75%",
          borderTop: "3px solid #38BDF8",
          transform: "skewY(28deg)",
          transformOrigin: "bottom left"
        }} />

        {/* Flat Compute Ceiling Line */}
        <div style={{
          position: "absolute",
          top: 35,
          left: "48%",
          right: 30,
          borderTop: "3px dashed #EF4444"
        }}>
          <span style={{ position: "absolute", top: -16, right: 0, fontSize: 10, color: "#EF4444", fontFamily: "JetBrains Mono" }}>
            Peak Tensor Compute Ceiling ({computeCeilingTflops} TFLOP/s)
          </span>
        </div>

        {/* Sloped Memory Bandwidth Label */}
        <span style={{ position: "absolute", bottom: 50, left: 60, fontSize: 10, color: "#38BDF8", fontFamily: "JetBrains Mono" }}>
          HBM3 Bandwidth Ceiling ({memoryCeilingTbs} TB/s)
        </span>

        {/* Current Kernel Plot Marker */}
        <div style={{
          position: "absolute",
          bottom: "45%",
          left: "32%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 10
        }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "#10B981",
            boxShadow: "0 0 10px #10B981"
          }} />
          <span style={{
            marginTop: 4,
            fontSize: 10,
            fontWeight: 700,
            color: "#10B981",
            whiteSpace: "nowrap",
            background: "rgba(0,0,0,0.8)",
            padding: "2px 6px",
            borderRadius: 3
          }}>
            {kernelLabel} ({achievedTflops} TFLOP/s, {arithmeticIntensity} FLOPs/byte)
          </span>
        </div>

        {/* X-axis labels */}
        <div style={{
          position: "absolute",
          bottom: 4,
          left: 30,
          right: 30,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "#6B7280",
          fontFamily: "JetBrains Mono"
        }}>
          <span>0.1 (Strictly Memory Bound)</span>
          <span>1.0 (Decode Transition)</span>
          <span>10.0 (Knee Point)</span>
          <span>100.0 (Compute Bound)</span>
        </div>
      </div>
    </div>
  );
};
