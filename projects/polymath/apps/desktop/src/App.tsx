import React, { useState, useEffect } from "react";
import { STARTER_VLLM_COURSE } from "./starter-course/vllmCourse.js";
import { MemoryBlockGrid } from "./components/MemoryBlockGrid.js";
import { CodeExercise } from "./components/CodeExercise.js";
import { RooflinePlot } from "./components/RooflinePlot.js";
import { ClusterTopology } from "./components/ClusterTopology.js";
import { SocraticQuiz } from "./components/SocraticQuiz.js";
import { EmbeddedTerminal } from "./components/EmbeddedTerminal.js";
import { invokeTauri, isTauri } from "./tauriBridge.js";
import type { Course, Chapter } from "@polymath/core";

export const App: React.FC = () => {
  const [course] = useState<Course>(STARTER_VLLM_COURSE);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // In-app Embedded Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(340);
  const [activeCourseSlug, setActiveCourseSlug] = useState(course.id);
  const [activeCourseDir, setActiveCourseDir] = useState("");

  const activeChapter: Chapter = course.chapters[activeChapterIndex] || course.chapters[0];

  // Global hotkey: Cmd+` or Ctrl+` to toggle embedded terminal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "`") {
        e.preventDefault();
        setIsTerminalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleOpenExternalTerminal = async () => {
    try {
      if (isTauri()) {
        await invokeTauri("open_course_terminal", {
          courseDir: activeCourseDir || `~/heji-courses/${activeCourseSlug}`,
        });
        setStatusMessage("External terminal launched");
      } else {
        setStatusMessage("Terminal launcher active in desktop mode");
      }
    } catch (err: any) {
      setStatusMessage(`Terminal error: ${err?.message || err}`);
    }
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleCreateCourse = async () => {
    if (!newSlug || !newTitle) return;

    try {
      if (isTauri()) {
        const res = await invokeTauri<any>("provision_course_workspace", {
          slug: newSlug,
          title: newTitle,
          topic: newTopic || newTitle,
        });
        setActiveCourseSlug(newSlug);
        setActiveCourseDir(res.path);
        setIsTerminalOpen(true);
        setStatusMessage(`Workspace created at ${res.path}!`);
      } else {
        setActiveCourseSlug(newSlug);
        setActiveCourseDir(`~/heji-courses/${newSlug}`);
        setIsTerminalOpen(true);
        setStatusMessage(`Simulated workspace ~/heji-courses/${newSlug} provisioned!`);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setStatusMessage(`Provisioning error: ${err?.message || err}`);
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0D0F14",
        color: "#F3F4F6",
        fontFamily: "Inter, system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Top Application Bar */}
      <header
        style={{
          height: 50,
          background: "#12151D",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, color: "#06B6D4", fontWeight: 800 }}>▲ Polymath</span>
          <span style={{ height: 16, width: 1, background: "rgba(255, 255, 255, 0.15)" }} />
          <b style={{ fontSize: 13, color: "#E2E8F0" }}>{course.title}</b>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {statusMessage && (
            <span
              style={{
                fontSize: 11,
                color: "#10B981",
                background: "rgba(16, 185, 129, 0.15)",
                padding: "3px 8px",
                borderRadius: 4,
              }}
            >
              {statusMessage}
            </span>
          )}

          {/* Toggle In-App Embedded Terminal */}
          <button
            onClick={() => setIsTerminalOpen((prev) => !prev)}
            style={{
              background: isTerminalOpen ? "rgba(6, 182, 212, 0.15)" : "#1E2433",
              color: isTerminalOpen ? "#38BDF8" : "#94A3B8",
              border: `1px solid ${isTerminalOpen ? "rgba(56, 189, 248, 0.5)" : "rgba(255, 255, 255, 0.1)"}`,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
            title="Toggle embedded xterm.js terminal (Ctrl+` or Cmd+`)"
          >
            <span style={{ color: isTerminalOpen ? "#10B981" : "#64748B" }}>●</span>
            <span>&gt;_ {isTerminalOpen ? "Hide Terminal" : "Embedded Terminal"}</span>
            <kbd
              style={{
                fontSize: 10,
                background: "rgba(0,0,0,0.3)",
                padding: "1px 4px",
                borderRadius: 3,
                color: "#94A3B8",
              }}
            >
              ⌘`
            </kbd>
          </button>

          {/* External Terminal Launcher */}
          <button
            onClick={handleOpenExternalTerminal}
            style={{
              background: "transparent",
              color: "#64748B",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 11,
              cursor: "pointer",
            }}
            title="Open native Terminal.app window"
          >
            ↗ External
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: "#06B6D4",
              color: "#090B10",
              border: 0,
              borderRadius: 6,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            + Create New Course
          </button>
        </div>
      </header>

      {/* Main Workspace: Left Sidebar + Center Player */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Sidebar: Chapters & Overview */}
        <aside
          style={{
            width: 300,
            background: "#10131A",
            borderRight: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
            <span
              style={{
                display: "inline-block",
                background: "rgba(6, 182, 212, 0.15)",
                color: "#06B6D4",
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: 4,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {course.domain}
            </span>
            <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.4 }}>
              {course.description}
            </div>
          </div>

          <div
            style={{
              padding: "12px 18px 6px",
              fontSize: 11,
              fontWeight: 700,
              color: "#6B7280",
              textTransform: "uppercase",
            }}
          >
            Course Chapters ({course.chapters.length})
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
            {course.chapters.map((ch, idx) => {
              const isActive = idx === activeChapterIndex;
              return (
                <div
                  key={ch.id}
                  onClick={() => setActiveChapterIndex(idx)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 6,
                    marginBottom: 4,
                    cursor: "pointer",
                    background: isActive ? "rgba(6, 182, 212, 0.12)" : "transparent",
                    borderLeft: `2px solid ${isActive ? "#06B6D4" : "transparent"}`,
                    transition: "all 0.1s ease",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "#F3F4F6" : "#9CA3AF",
                    }}
                  >
                    {ch.title}
                  </div>
                  <div style={{ fontSize: 10, color: "#6B7280", marginTop: 2 }}>
                    {ch.estimatedMinutes} mins · {ch.components.length} interactive elements
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center: Chapter Content & Interactive Components */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "36px 60px",
            background: "#0D0F14",
          }}
        >
          <div style={{ maxWidth: 840, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 20,
              }}
            >
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
                {activeChapter.title}
              </h1>
              <span style={{ fontSize: 12, color: "#6B7280" }}>
                ~{activeChapter.estimatedMinutes} min read
              </span>
            </div>

            {/* Markdown Narrative Rendering */}
            <div style={{ fontSize: 14, lineHeight: 1.7, color: "#D1D5DB" }}>
              {activeChapter.markdownContent.split("\n\n").map((para, i) => {
                if (para.startsWith("# ")) return null;
                if (para.startsWith("### ")) {
                  return (
                    <h3
                      key={i}
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#F3F4F6",
                        margin: "24px 0 10px",
                      }}
                    >
                      {para.replace("### ", "")}
                    </h3>
                  );
                }
                return (
                  <p key={i} style={{ marginBottom: 16 }}>
                    {para}
                  </p>
                );
              })}
            </div>

            {/* Interactive Component Registry Render */}
            <div style={{ margin: "24px 0" }}>
              {activeChapter.components.map((comp, i) => {
                if (comp.kind === "MemoryBlockGrid") {
                  return <MemoryBlockGrid key={i} {...comp.props} />;
                }
                if (comp.kind === "CodeExercise") {
                  return <CodeExercise key={i} {...comp.props} courseDir={activeCourseDir || `~/heji-courses/${activeCourseSlug}`} />;
                }
                if (comp.kind === "RooflinePlot") {
                  return <RooflinePlot key={i} {...comp.props} />;
                }
                if (comp.kind === "ClusterTopology") {
                  return <ClusterTopology key={i} {...comp.props} />;
                }
                if (comp.kind === "SocraticQuiz") {
                  return <SocraticQuiz key={i} {...comp.props} />;
                }
                return null;
              })}
            </div>

            {/* Chapter Navigation Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                paddingTop: 24,
                marginTop: 40,
                marginBottom: 40,
              }}
            >
              <button
                disabled={activeChapterIndex === 0}
                onClick={() => setActiveChapterIndex((prev) => Math.max(0, prev - 1))}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: activeChapterIndex === 0 ? "#4B5563" : "#D1D5DB",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 12,
                  cursor: activeChapterIndex === 0 ? "default" : "pointer",
                }}
              >
                ← Previous Chapter
              </button>
              <button
                disabled={activeChapterIndex >= course.chapters.length - 1}
                onClick={() =>
                  setActiveChapterIndex((prev) =>
                    Math.min(course.chapters.length - 1, prev + 1)
                  )
                }
                style={{
                  background:
                    activeChapterIndex >= course.chapters.length - 1
                      ? "rgba(255, 255, 255, 0.05)"
                      : "#06B6D4",
                  border: 0,
                  color:
                    activeChapterIndex >= course.chapters.length - 1
                      ? "#4B5563"
                      : "#090B10",
                  borderRadius: 6,
                  padding: "8px 18px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor:
                    activeChapterIndex >= course.chapters.length - 1
                      ? "default"
                      : "pointer",
                }}
              >
                Next Chapter →
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Embedded In-App Terminal Drawer (xterm.js + PTY) */}
      {isTerminalOpen && (
        <div
          style={{
            height: terminalHeight,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          {/* Resize handle bar */}
          <div
            style={{
              position: "absolute",
              top: -3,
              left: 0,
              right: 0,
              height: 6,
              cursor: "row-resize",
              zIndex: 10,
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const startY = e.clientY;
              const startHeight = terminalHeight;
              const onMouseMove = (moveEvent: MouseEvent) => {
                const delta = startY - moveEvent.clientY;
                setTerminalHeight(Math.max(140, Math.min(600, startHeight + delta)));
              };
              const onMouseUp = () => {
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
              };
              window.addEventListener("mousemove", onMouseMove);
              window.addEventListener("mouseup", onMouseUp);
            }}
          />

          <EmbeddedTerminal
            courseDir={activeCourseDir}
            courseSlug={activeCourseSlug}
            onClose={() => setIsTerminalOpen(false)}
          />
        </div>
      )}

      {/* "Create New Course with Agent" Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 520,
              background: "#161A23",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.6)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
              Create Course Workspace
            </h2>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>
              Polymath will provision a managed local directory under{" "}
              <code>~/heji-courses/&lt;slug&gt;/</code> pre-seeded with Agent Skills and
              launch the embedded terminal for your coding agent.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9CA3AF",
                    marginBottom: 4,
                  }}
                >
                  Course Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. LLM Post-Training Infra: Zero to Hero"
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    if (!newSlug) {
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                    }
                  }}
                  style={{
                    width: "100%",
                    background: "#0D0F14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9CA3AF",
                    marginBottom: 4,
                  }}
                >
                  Directory Slug
                </label>
                <input
                  type="text"
                  placeholder="e.g. post-training-infra"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#0D0F14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#06B6D4",
                    fontFamily: "JetBrains Mono",
                    fontSize: 12,
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#9CA3AF",
                    marginBottom: 4,
                  }}
                >
                  Topic Focus & Goals
                </label>
                <textarea
                  placeholder="e.g. SFT, DPO, PPO and GRPO (DeepSeek-R1 style), 3D parallelism with Megatron-LM and Ray actor rollout pools"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%",
                    background: "#0D0F14",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: "#fff",
                    fontSize: 12,
                    resize: "none",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#9CA3AF",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCourse}
                disabled={!newTitle || !newSlug}
                style={{
                  background: "#06B6D4",
                  color: "#090B10",
                  border: 0,
                  borderRadius: 6,
                  padding: "8px 18px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: !newTitle || !newSlug ? "default" : "pointer",
                }}
              >
                Launch Workspace & Agent Terminal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
