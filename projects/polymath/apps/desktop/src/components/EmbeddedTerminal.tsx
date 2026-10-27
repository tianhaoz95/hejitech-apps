import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import { invokeTauri, listenTauri, isTauri } from "../tauriBridge";

interface EmbeddedTerminalProps {
  courseDir: string;
  courseSlug: string;
  onClose?: () => void;
}

export const EmbeddedTerminal: React.FC<EmbeddedTerminalProps> = ({
  courseDir,
  courseSlug,
  onClose,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("Initializing shell...");

  useEffect(() => {
    if (!terminalRef.current) return;

    // 1. Initialize Xterm instance with full TUI & Unicode compatibility
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: "bar",
      fontSize: 13,
      lineHeight: 1.2,
      letterSpacing: 0,
      fontFamily: '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true,
      // CRITICAL: convertEol MUST be false for raw PTYs.
      // Setting convertEol: true forces \n to also do \r, which destroys
      // cursor positioning in curses / Ink / Bubbletea TUIs (Antigravity, Claude Code, htop).
      convertEol: false,
      scrollback: 10000,
      theme: {
        background: "#080c14",
        foreground: "#cbd5e1",
        cursor: "#10b981",
        selectionBackground: "#334155",
        black: "#0f172a",
        red: "#f87171",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#38bdf8",
        white: "#f8fafc",
        brightBlack: "#475569",
        brightRed: "#ef4444",
        brightGreen: "#10b981",
        brightYellow: "#f59e0b",
        brightBlue: "#3b82f6",
        brightMagenta: "#a855f7",
        brightCyan: "#06b6d4",
        brightWhite: "#ffffff",
      },
    });

    // 2. Load Unicode 11 addon for wide glyphs and box-drawing borders
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
      // 3. Native PTY session initialization with double-rAF to ensure layout is complete
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
            setStatusMessage("PTY active");

            term.onData((data) => {
              invokeTauri("write_pty_data", { data }).catch((err) => {
                console.error("write_pty_data error:", err);
              });
            });

            // Re-sync size once shell has fully spawned
            setTimeout(syncPtySize, 100);
          } catch (err: any) {
            setIsRunning(false);
            setStatusMessage("PTY init failed");
            term.writeln(`\r\n\x1b[31m[Error initializing native PTY: ${err?.message || err}]\x1b[0m\r\n`);
          }
        });
      });
    } else {
      // 4. Web preview fallback mode
      setIsRunning(true);
      setStatusMessage("Web preview mode");
      fitAddon.fit();

      term.writeln("\x1b[1;36m╔══════════════════════════════════════════════════════════════════╗\x1b[0m");
      term.writeln("\x1b[1;36m║\x1b[0m  \x1b[1;32mPolymath Interactive Terminal (Web Sandbox Mode)\x1b[0m                \x1b[1;36m║\x1b[0m");
      term.writeln("\x1b[1;36m║\x1b[0m  Workspace: \x1b[33m~/heji-courses/" + (courseSlug || "sandbox") + "\x1b[0m");
      term.writeln("\x1b[1;36m║\x1b[0m  Type \x1b[1;35mhelp\x1b[0m, \x1b[1;35mls\x1b[0m, \x1b[1;35mcat course.yaml\x1b[0m, or \x1b[1;35mpytest\x1b[0m to test the sandbox. \x1b[1;36m║\x1b[0m");
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
            term.writeln("Available demo commands: ls, cat course.yaml, pytest, clear, agent");
          } else if (cmd === "ls" || cmd === "ls -la") {
            term.writeln("\x1b[1;34m.agents/\x1b[0m  \x1b[1;34mchapters/\x1b[0m  \x1b[1;34mexercises/\x1b[0m  \x1b[1;34mtests/\x1b[0m  course.yaml  README.md");
          } else if (cmd.startsWith("cat course.yaml")) {
            term.writeln("\x1b[32mid:\x1b[0m " + courseSlug);
            term.writeln("\x1b[32mtitle:\x1b[0m Hardware Accelerated LLM Inference");
          } else if (cmd === "pytest") {
            term.writeln("\x1b[32m==== 2 passed in 0.08s ====\x1b[0m");
          } else if (cmd === "agent" || cmd === "antigravity" || cmd === "agy") {
            term.writeln("\x1b[1;35m[AI Agent]\x1b[0m Loaded skill: .agents/skills/course-author/SKILL.md");
            term.writeln("\x1b[1;32m[AI Agent]\x1b[0m Ready! Edit exercises/starter.py or chapters/01-overview.md");
          } else if (cmd.length > 0) {
            term.writeln(`polymath: command not found: ${cmd}. (Launch in desktop app for full live shell)`);
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

    // 5. Ensure resize happens after web fonts load
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        syncPtySize();
      });
    }

    // 6. Handle container layout changes cleanly
    let resizeTimer: any = null;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(syncPtySize, 50);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
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
        setStatusMessage("PTY active");
      } catch (e: any) {
        setStatusMessage("Failed to restart");
      }
    } else {
      xtermInstance.current.writeln("\x1b[33mShell reset.\x1b[0m");
      xtermInstance.current.write("\x1b[1;32muser@polymath\x1b[0m:\x1b[1;34m~/" + (courseSlug || "workspace") + "\x1b[0m$ ");
    }
  };

  const handleSendQuickCommand = (cmd: string) => {
    if (isTauri()) {
      invokeTauri("write_pty_data", { data: cmd + "\n" }).catch(console.error);
    } else if (xtermInstance.current) {
      xtermInstance.current.writeln(cmd);
      xtermInstance.current.writeln(`Executing: ${cmd}...`);
      xtermInstance.current.write("\x1b[1;32muser@polymath\x1b[0m:\x1b[1;34m~/" + (courseSlug || "workspace") + "\x1b[0m$ ");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        backgroundColor: "#080c14",
        borderTop: "1px solid #1e293b",
        fontFamily: "JetBrains Mono, Menlo, monospace",
      }}
    >
      {/* Terminal Title Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 14px",
          backgroundColor: "#0d131f",
          borderBottom: "1px solid #1e293b",
          fontSize: "12px",
          color: "#94a3b8",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: isRunning ? "#10b981" : "#f59e0b",
                display: "inline-block",
                boxShadow: isRunning ? "0 0 6px #10b981" : "none",
              }}
            />
          </div>
          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>Terminal (xterm.js + PTY)</span>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "4px",
              backgroundColor: "#1e293b",
              color: "#38bdf8",
            }}
          >
            {courseDir || `~/heji-courses/${courseSlug}`}
          </span>
          <span style={{ fontSize: "11px", color: "#64748b" }}>{statusMessage}</span>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => handleSendQuickCommand("agy")}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              background: "rgba(16, 185, 129, 0.15)",
              color: "#34d399",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
            }}
            title="Launch Antigravity agent CLI"
          >
            ⚡ agy
          </button>
          <button
            onClick={() => handleSendQuickCommand("ls -la")}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              background: "#1e293b",
              color: "#cbd5e1",
              border: "1px solid #334155",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            title="List workspace files"
          >
            ls
          </button>
          <button
            onClick={() => handleSendQuickCommand("pytest")}
            style={{
              padding: "3px 8px",
              fontSize: "11px",
              background: "#1e293b",
              color: "#38bdf8",
              border: "1px solid #334155",
              borderRadius: "4px",
              cursor: "pointer",
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
              background: "#1e293b",
              color: "#94a3b8",
              border: "1px solid #334155",
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
              background: "#1e293b",
              color: "#94a3b8",
              border: "1px solid #334155",
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
                fontSize: "12px",
                background: "transparent",
                color: "#94a3b8",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
              }}
              title="Close terminal drawer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Terminal Viewport (no padding to keep canvas rows perfectly aligned with character grid) */}
      <div
        ref={terminalRef}
        style={{
          flex: 1,
          width: "100%",
          height: "100%",
          padding: 0,
          margin: 0,
          overflow: "hidden",
          backgroundColor: "#080c14",
        }}
      />
    </div>
  );
};
