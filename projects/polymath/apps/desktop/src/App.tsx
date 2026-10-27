import React, { useState, useEffect } from "react";
import { STARTER_VLLM_COURSE } from "./starter-course/vllmCourse.js";
import { MemoryBlockGrid } from "./components/MemoryBlockGrid.js";
import { CodeExercise } from "./components/CodeExercise.js";
import { RooflinePlot } from "./components/RooflinePlot.js";
import { ClusterTopology } from "./components/ClusterTopology.js";
import { SocraticQuiz } from "./components/SocraticQuiz.js";
import { EmbeddedTerminal, type TestRunInfo } from "./components/EmbeddedTerminal.js";
import { invokeTauri, isTauri } from "./tauriBridge.js";
import type { Course, Chapter } from "@polymath/core";

export const App: React.FC = () => {
  const [course] = useState<Course>(STARTER_VLLM_COURSE);
  const [activeChapterIndex, setActiveChapterIndex] = useState(1); // Default to Chapter 2 (PagedAttention & Block Manager)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newTopic, setNewTopic] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Theme State: "dark" or "light" (defaults to dark, persisted in localStorage)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("polymath-theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("polymath-theme", next);
  };

  // Completed chapters tracking (for progress telemetry)
  const [completedChapters, setCompletedChapters] = useState<Set<number>>(() => new Set([0]));

  // In-app Embedded Terminal State
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(240);
  const [activeCourseSlug, setActiveCourseSlug] = useState(course.id);
  const [activeCourseDir, setActiveCourseDir] = useState("~/heji-courses/vllm-sglang-trtllm");
  const [latestTestResult, setLatestTestResult] = useState<TestRunInfo | null>(null);

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

  const isLight = theme === "light";
  const bg = isLight ? "#F8F9FA" : "#0A0C10";
  const topbarBg = isLight ? "rgba(255, 255, 255, 0.95)" : "rgba(13, 16, 23, 0.85)";
  const sidebarBg = isLight ? "#FFFFFF" : "#0D1117";
  const borderColor = isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)";
  const textColor = isLight ? "#1F2328" : "#E6EDF3";
  const mutColor = isLight ? "#656D76" : "#8B949E";
  const accentColor = isLight ? "#0969DA" : "#58A6FF";

  const progressPercent = Math.round((completedChapters.size / course.chapters.length) * 100);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        maxHeight: "100vh",
        maxWidth: "100vw",
        background: bg,
        color: textColor,
        fontFamily: '"Plus Jakarta Sans", Inter, system-ui, sans-serif',
        overflow: "hidden",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      {/* Precision Top Application Bar (Linear IDE Breadcrumbs) */}
      <header
        style={{
          height: 44,
          background: topbarBg,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          flexShrink: 0,
          boxShadow: isLight ? "0 1px 2px rgba(0,0,0,0.03)" : "0 1px 0 rgba(0,0,0,0.4)",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: accentColor, fontSize: 14 }}>
            <span>▲</span>
            <span style={{ color: textColor }}>Polymath</span>
          </div>

          <span style={{ color: mutColor, fontSize: 13 }}>/</span>
          <span style={{ fontSize: 12, color: mutColor }}>{course.title}</span>
          <span style={{ color: mutColor, fontSize: 13 }}>/</span>
          <b style={{ fontSize: 12, color: textColor }}>
            Ch 0{activeChapterIndex + 1}: {activeChapter.title.replace(/^\d+\.\s*/, "")}
          </b>

          {/* Live PTY Status Pill */}
          <div
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 12,
              background: isLight ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.12)",
              color: isLight ? "#059669" : "#34D399",
              border: `1px solid ${isLight ? "rgba(16, 185, 129, 0.25)" : "rgba(16, 185, 129, 0.25)"}`,
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontWeight: 600,
              marginLeft: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#10B981",
                boxShadow: "0 0 6px #10B981",
              }}
            />
            <span>PTY Active · zsh</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {statusMessage && (
            <span
              style={{
                fontSize: 11,
                color: "#10B981",
                background: "rgba(16, 185, 129, 0.15)",
                padding: "3px 8px",
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              {statusMessage}
            </span>
          )}

          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              background: isLight ? "#FFFFFF" : "rgba(255, 255, 255, 0.06)",
              border: `1px solid ${borderColor}`,
              color: textColor,
              padding: "4px 9px",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            title="Toggle Light / Dark mode"
          >
            <span>{isLight ? "🌙 Dark" : "☀️ Light"}</span>
          </button>

          {/* Toggle Terminal Button */}
          <button
            onClick={() => setIsTerminalOpen((prev) => !prev)}
            style={{
              background: isTerminalOpen
                ? isLight ? "rgba(9, 105, 218, 0.1)" : "rgba(88, 166, 255, 0.12)"
                : isLight ? "#FFFFFF" : "rgba(255, 255, 255, 0.06)",
              color: isTerminalOpen ? accentColor : mutColor,
              border: `1px solid ${isTerminalOpen ? (isLight ? "rgba(9, 105, 218, 0.3)" : "rgba(88, 166, 255, 0.3)") : borderColor}`,
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            title="Toggle terminal dock (Cmd+` or Ctrl+`)"
          >
            <span style={{ fontFamily: "JetBrains Mono" }}>&gt;_</span>
            <span>{isTerminalOpen ? "Hide Dock" : "Terminal Dock"}</span>
            <kbd
              style={{
                fontSize: 9,
                background: isLight ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.4)",
                padding: "1px 4px",
                borderRadius: 3,
                color: mutColor,
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
              color: mutColor,
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: 11,
              cursor: "pointer",
            }}
            title="Open native Terminal.app window"
          >
            ↗ External
          </button>

          {/* Create Course Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            style={{
              background: "linear-gradient(180deg, #2563EB, #1D4ED8)",
              color: "#FFFFFF",
              border: "1px solid #3B82F6",
              borderRadius: 6,
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
            }}
          >
            + Create Course
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Left Sidebar: Progress Telemetry & Chapter Navigation */}
        <aside
          style={{
            width: 260,
            background: sidebarBg,
            borderRight: `1px solid ${borderColor}`,
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}
        >
          {/* Course Header & Progress Box */}
          <div style={{ padding: "14px", borderBottom: `1px solid ${borderColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span
                style={{
                  display: "inline-block",
                  background: isLight ? "rgba(9, 105, 218, 0.08)" : "rgba(88, 166, 255, 0.12)",
                  color: accentColor,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 4,
                  textTransform: "uppercase",
                }}
              >
                {course.domain}
              </span>
              <span style={{ fontSize: 10, color: mutColor }}>6 Chapters</span>
            </div>

            {/* Progress Telemetry Card */}
            <div
              style={{
                background: isLight ? "#F8F9FA" : "rgba(255, 255, 255, 0.03)",
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
                padding: "8px 10px",
                marginTop: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: mutColor }}>
                <span>
                  <b>{completedChapters.size}</b> of {course.chapters.length} Completed
                </span>
                <b style={{ color: accentColor }}>{progressPercent}%</b>
              </div>
              <div
                style={{
                  height: 4,
                  background: isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.1)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginTop: 6,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "linear-gradient(90deg, #3B82F6, #10B981)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "10px 14px 4px",
              fontSize: 10,
              fontWeight: 700,
              color: mutColor,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Syllabus
          </div>

          {/* Chapter Items List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
            {course.chapters.map((ch, idx) => {
              const isActive = idx === activeChapterIndex;
              const isCompleted = completedChapters.has(idx);

              return (
                <div
                  key={ch.id}
                  onClick={() => setActiveChapterIndex(idx)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 6,
                    marginBottom: 3,
                    cursor: "pointer",
                    background: isActive
                      ? isLight ? "rgba(9, 105, 218, 0.08)" : "rgba(88, 166, 255, 0.12)"
                      : "transparent",
                    borderLeft: `2px solid ${isActive ? accentColor : "transparent"}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    transition: "all 0.1s ease",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 10,
                      color: isActive ? accentColor : mutColor,
                      fontWeight: 600,
                      width: 16,
                    }}
                  >
                    0{idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? textColor : isCompleted ? mutColor : textColor,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {ch.title.replace(/^\d+\.\s*/, "")}
                    </div>
                    <div style={{ fontSize: 10, color: mutColor, marginTop: 1 }}>
                      {ch.estimatedMinutes}m · {ch.components.length} elements
                    </div>
                  </div>
                  {isCompleted && (
                    <span style={{ color: "#10B981", fontSize: 12, fontWeight: 700 }} title="Chapter completed">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center: Chapter Content & Interactive Instruments */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "32px 56px",
            background: bg,
          }}
        >
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            {/* Module Eyebrow & Read Time */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: mutColor, marginBottom: 8 }}>
              <span
                style={{
                  background: isLight ? "rgba(9, 105, 218, 0.1)" : "rgba(88, 166, 255, 0.15)",
                  color: accentColor,
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontWeight: 700,
                  fontSize: 10,
                }}
              >
                MODULE 0{activeChapterIndex + 1}
              </span>
              <span>Estimated duration: ~{activeChapter.estimatedMinutes} mins</span>
            </div>

            <h1
              style={{
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: -0.5,
                color: textColor,
                margin: "0 0 16px",
              }}
            >
              {activeChapter.title}
            </h1>

            {/* Markdown Prose Rendering */}
            <div style={{ fontSize: 14, lineHeight: 1.7, color: isLight ? "#374151" : "#D1D5DB" }}>
              {activeChapter.markdownContent.split("\n\n").map((para, i) => {
                if (para.startsWith("# ")) return null;
                if (para.startsWith("### ")) {
                  return (
                    <h3
                      key={i}
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: textColor,
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

            {/* Interactive Components */}
            <div style={{ margin: "24px 0" }}>
              {activeChapter.components.map((comp, i) => {
                if (comp.kind === "MemoryBlockGrid") {
                  return <MemoryBlockGrid key={i} {...comp.props} theme={theme} />;
                }
                if (comp.kind === "CodeExercise") {
                  return (
                    <CodeExercise
                      key={i}
                      {...comp.props}
                      courseDir={activeCourseDir || `~/heji-courses/${activeCourseSlug}`}
                      theme={theme}
                      onTestRun={(result) => {
                        setLatestTestResult(result);
                        if (result.success) {
                          setCompletedChapters((prev) => new Set([...prev, activeChapterIndex]));
                        }
                      }}
                    />
                  );
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
                alignItems: "center",
                borderTop: `1px solid ${borderColor}`,
                paddingTop: 24,
                marginTop: 40,
                marginBottom: 40,
              }}
            >
              <button
                disabled={activeChapterIndex === 0}
                onClick={() => setActiveChapterIndex((prev) => Math.max(0, prev - 1))}
                style={{
                  background: isLight ? "#FFFFFF" : "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${borderColor}`,
                  color: activeChapterIndex === 0 ? (isLight ? "#9CA3AF" : "#4B5563") : textColor,
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 12,
                  fontWeight: 600,
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
                      ? isLight ? "#E5E7EB" : "rgba(255, 255, 255, 0.05)"
                      : "linear-gradient(180deg, #2563EB, #1D4ED8)",
                  border: activeChapterIndex >= course.chapters.length - 1 ? "none" : "1px solid #3B82F6",
                  color: activeChapterIndex >= course.chapters.length - 1 ? mutColor : "#FFFFFF",
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

      {/* Integrated Tabbed Terminal Dock (Linear IDE Style) */}
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
          {/* Resize Handle */}
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
            theme={theme}
            latestTestResult={latestTestResult}
            onClose={() => setIsTerminalOpen(false)}
          />
        </div>
      )}

      {/* "Create Course Workspace" Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 520,
              background: isLight ? "#FFFFFF" : "#161B22",
              border: `1px solid ${borderColor}`,
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.5)",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: textColor }}>
              Create Course Workspace
            </h2>
            <p style={{ fontSize: 12, color: mutColor, marginBottom: 16 }}>
              Polymath will provision a managed local directory under{" "}
              <code>~/heji-courses/&lt;slug&gt;/</code> pre-seeded with Agent Skills and
              launch the terminal dock for your coding agent.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: mutColor,
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
                    background: isLight ? "#F8F9FA" : "#0D1117",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: textColor,
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: mutColor,
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
                    background: isLight ? "#F8F9FA" : "#0D1117",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: accentColor,
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 12,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    color: mutColor,
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
                    background: isLight ? "#F8F9FA" : "#0D1117",
                    border: `1px solid ${borderColor}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    color: textColor,
                    fontSize: 12,
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "transparent",
                  border: `1px solid ${borderColor}`,
                  color: mutColor,
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
                  background: "linear-gradient(180deg, #2563EB, #1D4ED8)",
                  color: "#FFFFFF",
                  border: "1px solid #3B82F6",
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
