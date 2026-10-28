import React, { useState, useEffect } from "react";
import { STARTER_VLLM_COURSE } from "./starter-course/vllmCourse.js";
import { MemoryBlockGrid } from "./components/MemoryBlockGrid.js";
import { CodeExercise } from "./components/CodeExercise.js";
import { RooflinePlot } from "./components/RooflinePlot.js";
import { ClusterTopology } from "./components/ClusterTopology.js";
import { SocraticQuiz } from "./components/SocraticQuiz.js";
import { EmbeddedTerminal, type TestRunInfo } from "./components/EmbeddedTerminal.js";
import { invokeTauri, isTauri } from "./tauriBridge.js";
import { checkForUpdate, downloadAndInstallUpdate } from "./updater.js";
import type { Update } from "@tauri-apps/plugin-updater";
import type { Course, Chapter } from "@polymath/core";

export interface LocalCourseInfo {
  slug: string;
  title: string;
  description: string;
  path: string;
  chapter_count: number;
  has_agent_skill: boolean;
  is_active: boolean;
}

export const App: React.FC = () => {
  const [course, setCourse] = useState<Course>(STARTER_VLLM_COURSE);
  const [activeChapterIndex, setActiveChapterIndex] = useState(1); // Default to Chapter 2 (PagedAttention & Block Manager)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCourseListOpen, setIsCourseListOpen] = useState(false);
  const [localCourses, setLocalCourses] = useState<LocalCourseInfo[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
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

  // In-app Auto-updater state
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      checkForUpdate()
        .then((up) => {
          if (up) setAvailableUpdate(up);
        })
        .catch(() => {
          // Silent failure on startup background check
        });
    }
  }, []);

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatus("Checking…");
    try {
      const up = await checkForUpdate();
      if (up) {
        setAvailableUpdate(up);
        setUpdateStatus(`v${up.version} available`);
      } else {
        setAvailableUpdate(null);
        setUpdateStatus("Up to date");
        setTimeout(() => setUpdateStatus(null), 3000);
      }
    } catch (err: any) {
      setUpdateStatus("Check failed");
      setTimeout(() => setUpdateStatus(null), 4000);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!availableUpdate) return;
    setIsUpdating(true);
    try {
      await downloadAndInstallUpdate(availableUpdate, (status) => {
        setUpdateStatus(status);
      });
    } catch (err: any) {
      setIsUpdating(false);
      setUpdateStatus("Update failed");
      setTimeout(() => setUpdateStatus(null), 4000);
    }
  };

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

  const fetchLocalCourses = async () => {
    setIsLoadingCourses(true);
    try {
      if (isTauri()) {
        const list = await invokeTauri<LocalCourseInfo[]>("list_local_courses", {
          activeDir: activeCourseDir || `~/heji-courses/${activeCourseSlug}`,
        });
        setLocalCourses(list);
      } else {
        setLocalCourses([
          {
            slug: "vllm-sglang-trtllm",
            title: "PyTorch Deep Systems: Building vLLM, SGLang & TensorRT-LLM",
            description:
              "Master modern inference engine internals from scratch: non-contiguous KV-cache paging, Radix tree prefix caching, continuous batching, and arithmetic intensity rooflines.",
            path: "~/heji-courses/vllm-sglang-trtllm",
            chapter_count: 6,
            has_agent_skill: true,
            is_active: true,
          },
        ]);
      }
    } catch (err: any) {
      console.error("Failed to list local courses:", err);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  useEffect(() => {
    fetchLocalCourses();
  }, []);

  const handleSelectCourse = (c: LocalCourseInfo) => {
    setActiveCourseSlug(c.slug);
    setActiveCourseDir(c.path);
    if (c.slug === "vllm-sglang-trtllm" || c.slug === STARTER_VLLM_COURSE.id) {
      setCourse(STARTER_VLLM_COURSE);
      setActiveChapterIndex(1);
    } else {
      setCourse({
        id: c.slug,
        title: c.title,
        description: c.description,
        domain: "ai-inference",
        author: "Polymath Learner",
        version: "1.0.0",
        tags: [c.slug],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        chapters: [
          {
            id: `${c.slug}-ch-01`,
            slug: "01-overview",
            title: "1. Overview & Core Foundations",
            order: 1,
            summary: `Interactive foundations for ${c.title}`,
            markdownContent: `# 1. ${c.title}\n\nWelcome to your course workspace at \`${c.path}\`!\n\nUse the embedded terminal dock below to run your AI agent (with \`course-author\` skill) to author additional chapters, exercises, and tests.\n\n### Environment Verification`,
            components: [
              {
                kind: "MemoryBlockGrid",
                props: {
                  totalBlocks: 32,
                  allocatedBlocks: 8,
                  sharedPrefixBlocks: 4,
                  title: `${c.title} - Initial Memory Layout`,
                },
              },
              {
                kind: "CodeExercise",
                props: {
                  id: "starter-verification",
                  title: "1.1 Environment Verification",
                  targetFile: "exercises/starter.py",
                  testFile: "tests/test_starter.py",
                  instructions: "Return True in check_env() to verify the pytest execution pipeline.",
                  starterCode: "def check_env():\n    return True\n",
                },
              },
              {
                kind: "SocraticQuiz",
                props: {
                  question: "Where are your interactive course exercises and chapters stored?",
                  options: [
                    `Locally in ${c.path}`,
                    "On a remote server",
                    "In browser cookies",
                  ],
                  correctAnswerIndex: 0,
                  explanation: "Polymath is local-first: every course and test suite lives on your local filesystem under ~/heji-courses/.",
                },
              },
            ],
            estimatedMinutes: 15,
          },
        ],
      });
      setActiveChapterIndex(0);
    }
    setIsCourseListOpen(false);
    setStatusMessage(`Switched to course: ${c.title}`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleRevealFinder = async (path: string) => {
    try {
      if (isTauri()) {
        await invokeTauri("reveal_in_finder", { path });
      }
    } catch (err: any) {
      console.error("Failed to reveal in Finder:", err);
    }
  };

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
        await fetchLocalCourses();
      } else {
        setActiveCourseSlug(newSlug);
        setActiveCourseDir(`~/heji-courses/${newSlug}`);
        setIsTerminalOpen(true);
        setStatusMessage(`Simulated workspace ~/heji-courses/${newSlug} provisioned!`);
        await fetchLocalCourses();
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, color: accentColor, fontSize: 14 }}>
            <svg width="20" height="20" viewBox="0 0 1024 1024" fill="none" style={{ display: "block", borderRadius: 4, flexShrink: 0 }}>
              <rect width="1024" height="1024" rx="224" fill="#0D1117"/>
              <polygon points="512,180 820,358 820,714 512,892 204,714 204,358" fill="#0F172A" stroke="#38BDF8" strokeWidth="28" strokeLinejoin="round"/>
              <line x1="512" y1="180" x2="512" y2="536" stroke="#38BDF8" strokeWidth="24"/>
              <line x1="820" y1="358" x2="512" y2="536" stroke="#38BDF8" strokeWidth="24"/>
              <line x1="204" y1="358" x2="512" y2="536" stroke="#38BDF8" strokeWidth="24"/>
              <polygon points="512,358 666,447 666,625 512,714 358,625 358,447" fill="#1E293B" stroke="#10B981" strokeWidth="22" strokeLinejoin="round"/>
              <line x1="512" y1="358" x2="512" y2="536" stroke="#10B981" strokeWidth="20"/>
              <line x1="666" y1="447" x2="512" y2="536" stroke="#10B981" strokeWidth="20"/>
              <line x1="358" y1="447" x2="512" y2="536" stroke="#10B981" strokeWidth="20"/>
              <line x1="512" y1="180" x2="512" y2="358" stroke="#F59E0B" strokeWidth="16" strokeDasharray="14 10"/>
              <line x1="820" y1="358" x2="666" y2="447" stroke="#F59E0B" strokeWidth="16" strokeDasharray="14 10"/>
              <line x1="820" y1="714" x2="666" y2="625" stroke="#F59E0B" strokeWidth="16" strokeDasharray="14 10"/>
              <line x1="512" y1="892" x2="512" y2="714" stroke="#F59E0B" strokeWidth="16" strokeDasharray="14 10"/>
              <line x1="204" y1="714" x2="358" y2="625" stroke="#F59E0B" strokeWidth="16" strokeDasharray="14 10"/>
              <line x1="204" y1="358" x2="358" y2="447" stroke="#F59E0B" strokeWidth="16" strokeDasharray="14 10"/>
            </svg>
            <span style={{ color: textColor }}>Polymath</span>
          </div>

          <span style={{ color: mutColor, fontSize: 13 }}>/</span>

          {/* Interactive Course Selector */}
          <button
            onClick={() => {
              setIsCourseListOpen(true);
              fetchLocalCourses();
            }}
            style={{
              background: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
              padding: "2px 8px",
              fontSize: 12,
              color: textColor,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontWeight: 600,
            }}
            title="Switch or view all courses in ~/heji-courses/"
          >
            <span>📚</span>
            <span>{course.title.length > 26 ? course.title.slice(0, 24) + "…" : course.title}</span>
            <span style={{ fontSize: 9, color: mutColor }}>▾</span>
          </button>

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

          {/* In-app Auto Updater Button */}
          {availableUpdate ? (
            <button
              onClick={handleInstallUpdate}
              disabled={isUpdating}
              style={{
                background: "linear-gradient(180deg, #10B981, #059669)",
                color: "#FFFFFF",
                border: "1px solid #34D399",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: isUpdating ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                boxShadow: "0 1px 3px rgba(16, 185, 129, 0.4)",
              }}
              title={`Install Polymath v${availableUpdate.version} and restart`}
            >
              <span>🚀</span>
              <span>{isUpdating ? (updateStatus || "Updating…") : `Update to v${availableUpdate.version}`}</span>
            </button>
          ) : (
            <button
              onClick={handleManualCheckUpdate}
              disabled={isCheckingUpdate}
              style={{
                background: isLight ? "#FFFFFF" : "rgba(255, 255, 255, 0.06)",
                border: `1px solid ${borderColor}`,
                color: mutColor,
                padding: "4px 8px",
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                cursor: isCheckingUpdate ? "wait" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Check for software updates"
            >
              <span style={{ fontSize: 10 }}>🔄</span>
              <span>{isCheckingUpdate ? "Checking…" : (updateStatus || "Updates")}</span>
            </button>
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

          {/* View All Courses Button */}
          <button
            onClick={() => {
              setIsCourseListOpen(true);
              fetchLocalCourses();
            }}
            style={{
              background: isLight ? "#FFFFFF" : "rgba(255, 255, 255, 0.06)",
              color: textColor,
              border: `1px solid ${borderColor}`,
              borderRadius: 6,
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            title="Browse all courses in ~/heji-courses/"
          >
            <span>📚</span>
            <span>Courses</span>
            {localCourses.length > 0 && (
              <span
                style={{
                  background: isLight ? "rgba(9, 105, 218, 0.12)" : "rgba(88, 166, 255, 0.2)",
                  color: accentColor,
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {localCourses.length}
              </span>
            )}
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

      {/* "My Courses / Course Library" Modal */}
      {isCourseListOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              width: 700,
              maxHeight: "85vh",
              background: isLight ? "#FFFFFF" : "#161B22",
              border: `1px solid ${borderColor}`,
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.6)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: `1px solid ${borderColor}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: textColor }}>
                    Course Library
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: isLight ? "rgba(9, 105, 218, 0.1)" : "rgba(88, 166, 255, 0.15)",
                      color: accentColor,
                    }}
                  >
                    {localCourses.length} {localCourses.length === 1 ? "Course" : "Courses"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: mutColor }}>
                    Stored locally in
                  </span>
                  <code
                    style={{
                      fontSize: 11,
                      color: accentColor,
                      background: isLight ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)",
                      padding: "1px 6px",
                      borderRadius: 4,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    ~/heji-courses/
                  </code>
                  <button
                    onClick={() => handleRevealFinder("~/heji-courses")}
                    style={{
                      background: "none",
                      border: "none",
                      color: accentColor,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "0 4px",
                      textDecoration: "underline",
                    }}
                    title="Open ~/heji-courses in macOS Finder"
                  >
                    Open in Finder ↗
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => {
                    setIsCourseListOpen(false);
                    setIsModalOpen(true);
                  }}
                  style={{
                    background: "linear-gradient(180deg, #2563EB, #1D4ED8)",
                    color: "#FFFFFF",
                    border: "1px solid #3B82F6",
                    borderRadius: 6,
                    padding: "6px 12px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }}
                >
                  + New Course
                </button>
                <button
                  onClick={() => setIsCourseListOpen(false)}
                  style={{
                    background: isLight ? "#F0F2F5" : "rgba(255, 255, 255, 0.08)",
                    border: "none",
                    color: mutColor,
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Courses Scroll Area */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {isLoadingCourses ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: mutColor, fontSize: 13 }}>
                  Scanning ~/heji-courses/...
                </div>
              ) : localCourses.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "48px 24px",
                    border: `1px dashed ${borderColor}`,
                    borderRadius: 10,
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, color: textColor, marginBottom: 6 }}>
                    No courses found in ~/heji-courses/
                  </p>
                  <p style={{ fontSize: 12, color: mutColor, marginBottom: 16 }}>
                    Create your first course workspace to start authoring interactive modules.
                  </p>
                  <button
                    onClick={() => {
                      setIsCourseListOpen(false);
                      setIsModalOpen(true);
                    }}
                    style={{
                      background: "linear-gradient(180deg, #2563EB, #1D4ED8)",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 6,
                      padding: "8px 18px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    + Create First Course
                  </button>
                </div>
              ) : (
                localCourses.map((c) => {
                  const isActive =
                    c.slug === activeCourseSlug ||
                    c.path === activeCourseDir ||
                    activeCourseDir?.endsWith(`/${c.slug}`);

                  return (
                    <div
                      key={c.slug}
                      style={{
                        background: isActive
                          ? isLight
                            ? "rgba(9, 105, 218, 0.05)"
                            : "rgba(56, 139, 253, 0.08)"
                          : isLight
                          ? "#F8F9FA"
                          : "#0D1117",
                        border: `1px solid ${
                          isActive
                            ? isLight
                              ? "rgba(9, 105, 218, 0.4)"
                              : "rgba(56, 139, 253, 0.4)"
                            : borderColor
                        }`,
                        borderRadius: 10,
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: textColor }}>
                              {c.title}
                            </h3>
                            {isActive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 10,
                                  background: "#10B981",
                                  color: "#FFFFFF",
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 12, color: mutColor, margin: 0, lineHeight: 1.4 }}>
                            {c.description}
                          </p>
                        </div>

                        {/* Switch / Select Button */}
                        <button
                          onClick={() => handleSelectCourse(c)}
                          disabled={isActive}
                          style={{
                            background: isActive
                              ? "transparent"
                              : "linear-gradient(180deg, #2563EB, #1D4ED8)",
                            color: isActive ? mutColor : "#FFFFFF",
                            border: isActive ? `1px solid ${borderColor}` : "1px solid #3B82F6",
                            borderRadius: 6,
                            padding: "6px 14px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: isActive ? "default" : "pointer",
                            flexShrink: 0,
                          }}
                        >
                          {isActive ? "Currently Loaded" : "Open Course →"}
                        </button>
                      </div>

                      {/* Course Metadata Bar */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: 8,
                          borderTop: `1px solid ${borderColor}`,
                          fontSize: 11,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", color: mutColor }}>
                            ~/heji-courses/{c.slug}
                          </span>
                          <span style={{ color: mutColor }}>•</span>
                          <span style={{ color: textColor, fontWeight: 600 }}>
                            {c.chapter_count} {c.chapter_count === 1 ? "Chapter" : "Chapters"}
                          </span>
                          {c.has_agent_skill && (
                            <>
                              <span style={{ color: mutColor }}>•</span>
                              <span style={{ color: isLight ? "#059669" : "#34D399", fontWeight: 600 }}>
                                ✓ course-author skill
                              </span>
                            </>
                          )}
                        </div>

                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => handleRevealFinder(c.path)}
                            style={{
                              background: "none",
                              border: `1px solid ${borderColor}`,
                              borderRadius: 4,
                              color: mutColor,
                              padding: "2px 8px",
                              fontSize: 10,
                              cursor: "pointer",
                            }}
                            title="Reveal course files in macOS Finder"
                          >
                            📂 Finder
                          </button>
                          <button
                            onClick={() => {
                              setActiveCourseSlug(c.slug);
                              setActiveCourseDir(c.path);
                              setIsTerminalOpen(true);
                              setIsCourseListOpen(false);
                            }}
                            style={{
                              background: "none",
                              border: `1px solid ${borderColor}`,
                              borderRadius: 4,
                              color: accentColor,
                              padding: "2px 8px",
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            title="Open terminal dock at this course"
                          >
                            &gt;_ Terminal
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "12px 24px",
                borderTop: `1px solid ${borderColor}`,
                background: isLight ? "#F8F9FA" : "#0D1117",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <button
                onClick={fetchLocalCourses}
                style={{
                  background: "none",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 6,
                  padding: "5px 12px",
                  fontSize: 11,
                  color: mutColor,
                  cursor: "pointer",
                }}
              >
                ⟳ Refresh
              </button>

              <button
                onClick={() => setIsCourseListOpen(false)}
                style={{
                  background: isLight ? "#FFFFFF" : "rgba(255, 255, 255, 0.08)",
                  border: `1px solid ${borderColor}`,
                  borderRadius: 6,
                  padding: "6px 16px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: textColor,
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
