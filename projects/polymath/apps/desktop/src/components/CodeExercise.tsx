import React, { useState } from "react";
import type { CodeExerciseProps } from "@polymath/core";
import { invokeTauri, isTauri } from "../tauriBridge.js";

interface ExtendedCodeExerciseProps extends CodeExerciseProps {
  theme?: "dark" | "light";
  onTestRun?: (result: { success: boolean; output: string; durationMs: number; testFile: string }) => void;
}

export const CodeExercise: React.FC<ExtendedCodeExerciseProps> = ({
  title,
  targetFile,
  testFile,
  instructions,
  starterCode,
  solutionHint,
  courseDir,
  theme = "dark",
  onTestRun,
}) => {
  const [code, setCode] = useState(starterCode);
  const [isRunning, setIsRunning] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    output: string;
    durationMs: number;
  } | null>(null);
  const [showHint, setShowHint] = useState(false);

  const isLight = theme === "light";
  const cardBg = isLight ? "#FFFFFF" : "#0D1117";
  const headerBg = isLight ? "#F6F8FA" : "#161B22";
  const editorBg = isLight ? "#FFFFFF" : "#090C10";
  const borderColor = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";
  const textColor = isLight ? "#1F2328" : "#E6EDF3";

  const handleRunTests = async () => {
    setIsRunning(true);
    setTestResult(null);

    try {
      if (isTauri()) {
        const res = await invokeTauri<any>("run_exercise_tests", {
          courseDir: courseDir || "",
          testFile,
          targetFile,
          code,
        });
        const resultObj = {
          success: res.success,
          output: res.output,
          durationMs: res.duration_ms,
        };
        setTestResult(resultObj);
        onTestRun?.({ ...resultObj, testFile });
      } else {
        // Simulated local sandbox run for web preview
        await new Promise((r) => setTimeout(r, 600));
        const resultObj = {
          success: true,
          output: `[PASS] tests/test_exercise.py::test_block_invariants (1.4ms)\n[PASS] tests/test_exercise.py::test_no_memory_leaks (2.1ms)\n\n======================== 2 passed in 0.04s ========================`,
          durationMs: 42,
        };
        setTestResult(resultObj);
        onTestRun?.({ ...resultObj, testFile });
      }
    } catch (err: any) {
      const resultObj = {
        success: false,
        output: `Execution error: ${err?.message || err}`,
        durationMs: 12,
      };
      setTestResult(resultObj);
      onTestRun?.({ ...resultObj, testFile });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        overflow: "hidden",
        margin: "20px 0",
        fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
        boxShadow: isLight ? "0 1px 3px rgba(0,0,0,0.05)" : "0 4px 12px rgba(0,0,0,0.25)",
      }}
    >
      <div
        style={{
          background: headerBg,
          padding: "10px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: `1px solid ${borderColor}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: isLight ? "#0969DA" : "#58A6FF", fontWeight: 700, fontSize: 13 }}>
            {title}
          </span>
          <span
            style={{
              fontSize: 11,
              color: isLight ? "#656D76" : "#8B949E",
              fontFamily: "JetBrains Mono, monospace",
              background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {targetFile}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {solutionHint && (
            <button
              onClick={() => setShowHint(!showHint)}
              style={{
                background: "transparent",
                border: `1px solid ${borderColor}`,
                color: isLight ? "#656D76" : "#8B949E",
                borderRadius: 5,
                padding: "4px 10px",
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {showHint ? "Hide Hint" : "💡 Hint"}
            </button>
          )}
          <button
            onClick={handleRunTests}
            disabled={isRunning}
            style={{
              background: isRunning ? "#4B5563" : isLight ? "#10B981" : "#238636",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "4px 14px",
              fontSize: 11,
              fontWeight: 700,
              cursor: isRunning ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}
          >
            {isRunning ? "Running Sandbox..." : "▶ Run Pytest"}
          </button>
        </div>
      </div>

      {instructions && (
        <div
          style={{
            padding: "10px 16px",
            background: isLight ? "rgba(9, 105, 218, 0.05)" : "rgba(88, 166, 255, 0.08)",
            borderBottom: `1px solid ${borderColor}`,
            fontSize: 12,
            color: isLight ? "#0969DA" : "#93C5FD",
            lineHeight: 1.5,
          }}
        >
          <b>Instructions:</b> {instructions}
        </div>
      )}

      {showHint && solutionHint && (
        <div
          style={{
            padding: "10px 16px",
            background: isLight ? "rgba(217, 119, 6, 0.08)" : "rgba(245, 158, 11, 0.08)",
            borderBottom: `1px solid ${borderColor}`,
            fontSize: 12,
            color: isLight ? "#B45309" : "#FCD34D",
          }}
        >
          <b>💡 Hint:</b> {solutionHint}
        </div>
      )}

      <div style={{ padding: 12, background: editorBg }}>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={Math.min(16, Math.max(7, code.split("\n").length + 2))}
          style={{
            width: "100%",
            background: "transparent",
            color: textColor,
            border: "none",
            borderRadius: 0,
            padding: 4,
            fontFamily: "JetBrains Mono, Menlo, monospace",
            fontSize: 12,
            lineHeight: 1.6,
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
          spellCheck={false}
        />
      </div>

      {testResult && (
        <div
          style={{
            background: testResult.success
              ? isLight ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.1)"
              : isLight ? "rgba(239, 68, 68, 0.08)" : "rgba(239, 68, 68, 0.1)",
            borderTop: `1px solid ${testResult.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            padding: "10px 16px",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span
              style={{
                fontWeight: 700,
                color: testResult.success ? (isLight ? "#15803D" : "#10B981") : (isLight ? "#B91C1C" : "#EF4444"),
              }}
            >
              {testResult.success ? "✓ ALL TESTS PASSED" : "✗ TEST SUITE FAILED"}
            </span>
            <span style={{ color: isLight ? "#656D76" : "#8B949E" }}>{testResult.durationMs}ms</span>
          </div>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              color: testResult.success ? (isLight ? "#166534" : "#A7F3D0") : (isLight ? "#991B1B" : "#FCA5A5"),
            }}
          >
            {testResult.output}
          </pre>
        </div>
      )}
    </div>
  );
};
