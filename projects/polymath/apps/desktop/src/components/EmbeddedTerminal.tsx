import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import { invokeTauri, listenTauri, isTauri } from "../tauriBridge";

export interface TestRunInfo {
  success: boolean;
  output: string;
  durationMs: number;
  testFile: string;
}

interface EmbeddedTerminalProps {
  courseDir: string;
  courseSlug: string;
  theme?: "dark" | "light";
  latestTestResult?: TestRunInfo | null;
  onClose?: () => void;
}

export const EmbeddedTerminal: React.FC<EmbeddedTerminalProps> = ({
  courseDir,
  courseSlug,
  theme = "dark",
  latestTestResult,
  onClose,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing shell...");
  const [activeTab, setActiveTab] = useState<"terminal" | "sandbox" | "agent">("terminal");

  const isLight = theme === "light";

  const getTerminalTheme = (light: boolean) => {
    return light
      ? {
          background: "#F8F9FA",
          foreground: "#1F2328",
          cursor: "#0969DA",
          selectionBackground: "#B6E3FF",
          black: "#24292F",
          red: "#CF222E",
          green: "#1A7F37",
          yellow: "#9A6700",
          blue: "#0969DA",
          magenta: "#8250DF",
          cyan: "#1B7C83",
          white: "#FFFFFF",
          brightBlack: "#6E7781",
          brightRed: "#FF8182",
          brightGreen: "#2DA44E",
          brightYellow: "#D4A72C",
          brightBlue: "#218BFF",
          brightMagenta: "#A371F7",
          brightCyan: "#3192AA",
          brightWhite: "#F6F8FA",
        }
      : {
          background: "#080A0E",
          foreground: "#CBD5E1",
          cursor: "#10B981",
          selectionBackground: "#334155",
          black: "#0F172A",
          red: "#F87171",
          green: "#34D399",
          yellow: "#FBBF24",
          blue: "#60A5FA",
          magenta: "#C084FC",
          cyan: "#38BDF8",
          white: "#F8FAFC",
          brightBlack: "#475569",
          brightRed: "#EF4444",
          brightGreen: "#10B981",
          brightYellow: "#F59E0B",
          brightBlue: "#3B82F6",
          brightMagenta: "#A855F7",
          brightCyan: "#06B6D4",
          brightWhite: "#FFFFFF",
        };
  };

  useEffect(() => {
    if (xtermInstance.current) {
      xtermInstance.current.options.theme = getTerminalTheme(isLight);
    }
  }, [isLight]);

  // If a new test run completes, switch to or badge the sandbox tab
  useEffect(() => {
    if (latestTestResult) {
      // Don't forcefully hijack focus if user is actively in terminal, but let them know
    }
  }, [latestTestResult]);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 12.5,
      lineHeight: 1.2,
      letterSpacing: 0,
      fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true,
      convertEol: false,
      scrollback: 10000,
      theme: getTerminalTheme(isLight),
    });

    try {
      const unicode11Addon = new Unicode11Addon();
      term.loadAddon(unicode11Addon);
      term.unicode.activeVersion = "11";
    } catch (e) {
      console.warn("Unicode 11 addon load skipped:", e);
    }

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    let unlistenOutput: (() => void) | null = null;
    const isTauriEnv = isTauri();

    const syncPtySize = () => {
      try {
        fitAddon.fit();
        if (isTauri() && term.rows > 0 && term.cols > 0) {
          invokeTauri("resize_pty_session", {
            rows: term.rows,
            cols: term.cols,
          }).catch(() => {});
        }
      } catch {}
    };

    if (isTauriEnv) {
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          try {
            fitAddon.fit();
            const cols = term.cols > 10 ? term.cols : 80;
            const rows = term.rows > 5 ? term.rows : 24;

            unlistenOutput = await listenTauri<string>("pty-output", (chunk) => {
              term.write(chunk);
            });

            await invokeTauri("init_pty_session", {
              cwd: courseDir || undefined,
              rows,
              cols,
            });

            setIsRunning(true);
            setStatusMessage("PTY active · zsh");

            term.onData((data) => {
              invokeTauri("write_pty_data", { data }).catch(console.error);
            });

            setTimeout(syncPtySize, 100);
          } catch (err: any) {
            setIsRunning(false);
            setStatusMessage("PTY init failed");
            term.writeln(`\r\n\x1b[31m[Error initializing native PTY: ${err?.message || err}]\x1b[0m\r\n`);
          }
        });
      });
    } else {
      setIsRunning(true);
      setStatusMessage("Web preview mode");
      fitAddon.fit();

      term.writeln("\x1b[1;36m╔══════════════════════════════════════════════════════════════════╗\x1b[0m");
      term.writeln("\x1b[1;36m║\x1b[0m  \x1b[1;32mPolymath Interactive Terminal (Web Sandbox Mode)\x1b[0m                \x1b[1;36m║\x1b[0m");
      term.writeln("\x1b[1;36m║\x1b[0m  Workspace: \x1b[33m~/heji-courses/" + (courseSlug || "sandbox") + "\x1b[0m");
      term.writeln("\x1b[1;36m║\x1b[0m  Type \x1b[1;35mhelp\x1b[0m, \x1b[1;35mls\x1b[0m, \x1b[1;35mcat course.yaml\x1b[0m, or \x1b[1;35mpytest\x1b[0m.                  \x1b[1;36m║\x1b[0m");
      term.writeln("\x1b[1;36m╚══════════════════════════════════════════════════════════════════╝\x1b[0m");
      term.write("\r\n\x1b[1;32muser@polymath\x1b[0m:\x1b[1;34m~/" + (courseSlug || "workspace") + "\x1b[0m$ ");

      let inputBuffer = "";
      term.onData((e) => {
        if (e === "\r") {
          term.write("\r\n");
          const cmd = inputBuffer.trim();
          inputBuffer = "";

          if (cmd === "clear") {
            term.clear();
          } else if (cmd === "help") {
            term.writeln("Available demo commands: ls, cat course.yaml, pytest, clear, agy");
          } else if (cmd === "ls" || cmd === "ls -la") {
            term.writeln("\x1b[1;34m.agents/\x1b[0m  \x1b[1;34m.venv/\x1b[0m  \x1b[1;34mchapters/\x1b[0m  \x1b[1;34mexercises/\x1b[0m  \x1b[1;34mtests/\x1b[0m  course.yaml  README.md");
          } else if (cmd.startsWith("cat course.yaml")) {
            term.writeln("\x1b[32mid:\x1b[0m " + courseSlug);
            term.writeln("\x1b[32mtitle:\x1b[0m Hardware-Accelerated LLM Inference");
          } else if (cmd === "pytest") {
            term.writeln("\x1b[32m==== 2 passed in 0.04s ====\x1b[0m");
          } else if (cmd === "agent" || cmd === "antigravity" || cmd === "agy") {
            term.writeln("\x1b[1;35m[agy]\x1b[0m Loaded skill: .agents/skills/course-author/SKILL.md");
            term.writeln("\x1b[1;32m[agy]\x1b[0m Ready! Edit exercises/starter.py or chapters/01-overview.md");
          } else if (cmd.length > 0) {
            term.writeln(`polymath: command not found: ${cmd}`);
          }
          term.write("\x1b[1;32muser@polymath\x1b[0m:\x1b[1;34m~/" + (courseSlug || "workspace") + "\x1b[0m$ ");
        } else if (e === "\u007F") {
          if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1);
            term.write("\b \b");
          }
        } else if (e >= " ") {
          inputBuffer += e;
          term.write(e);
        }
      });
    }

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => syncPtySize());
    }

    let resizeTimer: any = null;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncPtySize, 50);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      if (unlistenOutput) unlistenOutput();
      term.dispose();
    };
  }, [courseDir, courseSlug]);

  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  const handleRestart = async () => {
    if (!xtermInstance.current) return;
    xtermInstance.current.clear();
    if (isTauri()) {
      setStatusMessage("Restarting shell...");
      try {
        fitAddonRef.current?.fit();
        await invokeTauri("init_pty_session", {
          cwd: courseDir || undefined,
          rows: xtermInstance.current.rows,
          cols: xtermInstance.current.cols,
        });
        setStatusMessage("PTY active · zsh");
      } catch (e: any) {
        setStatusMessage("Failed to restart");
      }
    } else {
      xtermInstance.current.writeln("\x1b[33mShell reset.\x1b[0m");
      xtermInstance.current.write("\x1b[1;32muser@polymath\x1b[0m:\x1b[1;34m~/" + (courseSlug || "workspace") + "\x1b[0m$ ");
    }
  };

  const handleSendQuickCommand = (cmd: string) => {
    setActiveTab("terminal");
    if (isTauri()) {
      invokeTauri("write_pty_data", { data: cmd + "\n" }).catch(console.error);
    } else if (xtermInstance.current) {
      xtermInstance.current.writeln(cmd);
      xtermInstance.current.writeln(`Executing: ${cmd}...`);
      xtermInstance.current.write("\x1b[1;32muser@polymath\x1b[0m:\x1b[1;34m~/" + (courseSlug || "workspace") + "\x1b[0m$ ");
    }
  };

  const borderColor = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";
  const dockBg = isLight ? "#FFFFFF" : "#0D1117";
  const termViewportBg = isLight ? "#F8F9FA" : "#080A0E";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: termViewportBg,
        borderTop: `1px solid ${borderColor}`,
        fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
      }}
    >
      {/* Precision Linear-Style Tabs Strip */}
      <div
        style={{
          height: 36,
          backgroundColor: dockBg,
          borderBottom: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          userSelect: "none",
        }}
      >
        {/* Left Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* Tab: Terminal */}
          <button
            onClick={() => {
              setActiveTab("terminal");
              setTimeout(() => fitAddonRef.current?.fit(), 30);
            }}
            style={{
              background: activeTab === "terminal" ? (isLight ? "#F3F4F6" : "rgba(88, 166, 255, 0.12)") : "transparent",
              color: activeTab === "terminal" ? (isLight ? "#0969DA" : "#58A6FF") : (isLight ? "#656D76" : "#8B949E"),
              border: "none",
              borderBottom: activeTab === "terminal" ? `2px solid ${isLight ? "#0969DA" : "#58A6FF"}` : "2px solid transparent",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: activeTab === "terminal" ? 700 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.12s ease",
            }}
          >
            <span style={{ fontFamily: "JetBrains Mono", fontSize: 11 }}>&gt;_</span>
            <span>Terminal</span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: isRunning ? "#10B981" : "#F59E0B",
                display: "inline-block",
                boxShadow: isRunning ? "0 0 6px #10B981" : "none",
              }}
            />
          </button>

          {/* Tab: Pytest Sandbox */}
          <button
            onClick={() => setActiveTab("sandbox")}
            style={{
              background: activeTab === "sandbox" ? (isLight ? "#F3F4F6" : "rgba(88, 166, 255, 0.12)") : "transparent",
              color: activeTab === "sandbox" ? (isLight ? "#0969DA" : "#58A6FF") : (isLight ? "#656D76" : "#8B949E"),
              border: "none",
              borderBottom: activeTab === "sandbox" ? `2px solid ${isLight ? "#0969DA" : "#58A6FF"}` : "2px solid transparent",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: activeTab === "sandbox" ? 700 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.12s ease",
            }}
          >
            <span>⚡ Pytest Sandbox</span>
            {latestTestResult && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 10,
                  backgroundColor: latestTestResult.success
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                  color: latestTestResult.success ? "#10B981" : "#EF4444",
                }}
              >
                {latestTestResult.success ? `PASS (${latestTestResult.durationMs}ms)` : "FAIL"}
              </span>
            )}
          </button>

          {/* Tab: Agent Activity */}
          <button
            onClick={() => setActiveTab("agent")}
            style={{
              background: activeTab === "agent" ? (isLight ? "#F3F4F6" : "rgba(88, 166, 255, 0.12)") : "transparent",
              color: activeTab === "agent" ? (isLight ? "#0969DA" : "#58A6FF") : (isLight ? "#656D76" : "#8B949E"),
              border: "none",
              borderBottom: activeTab === "agent" ? `2px solid ${isLight ? "#0969DA" : "#58A6FF"}` : "2px solid transparent",
              padding: "7px 12px",
              fontSize: "12px",
              fontWeight: activeTab === "agent" ? 700 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.12s ease",
            }}
          >
            <span>🤖 Agent Log (agy)</span>
            <span
              style={{
                fontSize: 10,
                padding: "1px 5px",
                borderRadius: 4,
                backgroundColor: isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.08)",
                color: isLight ? "#4B5563" : "#94A3B8",
              }}
            >
              Skill active
            </span>
          </button>
        </div>

        {/* Right Tools & Quick Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: isLight ? "#F3F4F6" : "rgba(255, 255, 255, 0.06)",
              color: isLight ? "#0969DA" : "#58A6FF",
            }}
          >
            {courseDir || `~/heji-courses/${courseSlug}`}
          </span>
          <span style={{ fontSize: "11px", color: isLight ? "#656D76" : "#8B949E" }}>
            {statusMessage}
          </span>

          <button
            onClick={() => handleSendQuickCommand("agy")}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              background: isLight ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.15)",
              color: isLight ? "#059669" : "#34D399",
              border: `1px solid ${isLight ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 700,
            }}
            title="Launch Antigravity agent CLI"
          >
            ⚡ agy
          </button>
          <button
            onClick={() => handleSendQuickCommand("pytest")}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              background: isLight ? "#F3F4F6" : "rgba(255, 255, 255, 0.06)",
              color: isLight ? "#1F2328" : "#E2E8F0",
              border: `1px solid ${borderColor}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
            }}
            title="Run pytest on course tests"
          >
            pytest
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              background: "transparent",
              color: isLight ? "#656D76" : "#8B949E",
              border: `1px solid ${borderColor}`,
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
          <button
            onClick={handleRestart}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              background: "transparent",
              color: isLight ? "#656D76" : "#8B949E",
              border: `1px solid ${borderColor}`,
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Restart
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: "3px 8px",
                fontSize: "13px",
                background: "transparent",
                color: isLight ? "#656D76" : "#8B949E",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
              }}
              title="Close dock"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tab Viewport 1: Live Terminal */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          padding: 0,
          margin: 0,
          overflow: "hidden",
          backgroundColor: termViewportBg,
          display: activeTab === "terminal" ? "block" : "none",
        }}
      />

      {/* Tab Viewport 2: Pytest Sandbox */}
      {activeTab === "sandbox" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            backgroundColor: isLight ? "#FFFFFF" : "#0D1117",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
          }}
        >
          {latestTestResult ? (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  paddingBottom: 10,
                  borderBottom: `1px solid ${borderColor}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      backgroundColor: latestTestResult.success
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)",
                      color: latestTestResult.success ? "#10B981" : "#EF4444",
                    }}
                  >
                    {latestTestResult.success ? "✓ TEST SUITE PASSED" : "✗ TEST SUITE FAILED"}
                  </span>
                  <span style={{ color: isLight ? "#656D76" : "#8B949E" }}>
                    File: <b>{latestTestResult.testFile}</b>
                  </span>
                </div>
                <span style={{ color: isLight ? "#656D76" : "#8B949E", fontSize: 11 }}>
                  Duration: {latestTestResult.durationMs}ms
                </span>
              </div>
              <pre
                style={{
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  color: latestTestResult.success ? (isLight ? "#15803D" : "#86EFAC") : (isLight ? "#B91C1C" : "#FCA5A5"),
                }}
              >
                {latestTestResult.output}
              </pre>
            </div>
          ) : (
            <div style={{ color: isLight ? "#656D76" : "#8B949E", textAlign: "center", paddingTop: 30 }}>
              <p>No tests have been executed in this session yet.</p>
              <p style={{ fontSize: 11 }}>
                Click <b>▶ Run Pytest</b> in any exercise above or click <b>pytest</b> in the toolbar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Viewport 3: Agent Activity Log */}
      {activeTab === "agent" && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            backgroundColor: isLight ? "#FFFFFF" : "#0D1117",
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontWeight: 700, color: isLight ? "#0969DA" : "#58A6FF" }}>
              🤖 Autonomous Course Authoring Agent
            </span>
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#10B981",
                fontWeight: 700,
              }}
            >
              READY
            </span>
          </div>

          <div
            style={{
              background: isLight ? "#F6F8FA" : "#161B22",
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
              padding: "12px 14px",
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4, color: isLight ? "#24292F" : "#F0F6FC" }}>
              Managed Workspace Skill Pre-seeded:
            </div>
            <code style={{ fontSize: 11, color: isLight ? "#0969DA" : "#58A6FF", fontFamily: "JetBrains Mono" }}>
              .agents/skills/course-author/SKILL.md
            </code>
            <p style={{ margin: "8px 0 0", color: isLight ? "#57606A" : "#8B949E", fontSize: 11 }}>
              Any local coding agent (Claude Code, Google Antigravity, Cursor) launched in this directory
              can author, expand, and verify chapters using the declarative UI component registry.
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => handleSendQuickCommand("agy")}
              style={{
                background: isLight ? "#0969DA" : "#238636",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 6,
                padding: "6px 14px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Start Antigravity Agent (agy)
            </button>
            <button
              onClick={() => handleSendQuickCommand("git status")}
              style={{
                background: isLight ? "#F3F4F6" : "#21262D",
                color: isLight ? "#24292F" : "#C9D1D9",
                border: `1px solid ${borderColor}`,
                borderRadius: 6,
                padding: "6px 12px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Check Workspace Git Status
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
