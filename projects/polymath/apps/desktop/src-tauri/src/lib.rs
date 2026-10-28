use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Deserialize)]
pub struct ProvisionResult {
    pub path: String,
    pub slug: String,
    pub title: String,
}

#[derive(Serialize, Deserialize)]
pub struct TestRunResult {
    pub success: bool,
    pub output: String,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalCourseInfo {
    pub slug: String,
    pub title: String,
    pub description: String,
    pub path: String,
    pub chapter_count: usize,
    pub has_agent_skill: bool,
    pub is_active: bool,
}

struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct AppPtyState {
    session: Arc<Mutex<Option<PtySession>>>,
}

impl Default for AppPtyState {
    fn default() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
        }
    }
}

fn resolve_course_dir(course_dir: &str) -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    if course_dir.is_empty() || course_dir == "." {
        PathBuf::from(home).join("heji-courses").join("vllm-sglang-trtllm")
    } else if let Some(stripped) = course_dir.strip_prefix("~/") {
        PathBuf::from(home).join(stripped)
    } else {
        PathBuf::from(course_dir)
    }
}

/// Ensures a managed virtual environment exists with pytest installed.
/// Prefers:
/// 1. Course-local `<course_dir>/.venv`
/// 2. Central managed `~/heji-courses/.venv`
/// Automatically provisions and installs pytest if absent.
fn ensure_managed_pytest(base_dir: &Path) -> Result<PathBuf, String> {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let central_venv = PathBuf::from(&home).join("heji-courses").join(".venv");

    // 1. Local course-specific virtual environment
    let local_pytest = if cfg!(windows) {
        base_dir.join(".venv").join("Scripts").join("pytest.exe")
    } else {
        base_dir.join(".venv").join("bin").join("pytest")
    };
    if local_pytest.exists() {
        return Ok(local_pytest);
    }

    // 2. Central managed virtual environment
    let central_pytest = if cfg!(windows) {
        central_venv.join("Scripts").join("pytest.exe")
    } else {
        central_venv.join("bin").join("pytest")
    };
    if central_pytest.exists() {
        return Ok(central_pytest);
    }

    // 3. Create central virtual environment
    let heji_courses_dir = PathBuf::from(&home).join("heji-courses");
    fs::create_dir_all(&heji_courses_dir).map_err(|e| e.to_string())?;

    let python_candidates = [
        "/opt/homebrew/bin/python3",
        "/usr/local/bin/python3",
        "/usr/bin/python3",
        "python3",
    ];
    let mut selected_python = "python3";
    for cand in python_candidates {
        if PathBuf::from(cand).exists() {
            selected_python = cand;
            break;
        }
    }

    let venv_status = Command::new(selected_python)
        .arg("-m")
        .arg("venv")
        .arg(&central_venv)
        .status()
        .map_err(|e| format!("Failed to invoke python3 -m venv: {}", e))?;

    if !venv_status.success() {
        return Err(format!(
            "Failed to create managed virtualenv at {}",
            central_venv.display()
        ));
    }

    let pip_bin = if cfg!(windows) {
        central_venv.join("Scripts").join("pip.exe")
    } else {
        central_venv.join("bin").join("pip")
    };

    let pip_status = Command::new(&pip_bin)
        .arg("install")
        .arg("pytest")
        .status()
        .map_err(|e| format!("Failed to run pip install pytest: {}", e))?;

    if !pip_status.success() {
        return Err("Failed to install pytest into managed virtualenv".to_string());
    }

    if central_pytest.exists() {
        Ok(central_pytest)
    } else {
        Err(format!("pytest executable not found at {}", central_pytest.display()))
    }
}

/// Ensures default starter tests and exercise stubs exist on disk before testing
fn ensure_starter_files(
    base_dir: &Path,
    target_file: Option<&str>,
    test_file: &str,
    code: Option<&str>,
) -> Result<(), String> {
    let exercises_dir = base_dir.join("exercises");
    let tests_dir = base_dir.join("tests");
    fs::create_dir_all(&exercises_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&tests_dir).map_err(|e| e.to_string())?;

    let ex_init = exercises_dir.join("__init__.py");
    if !ex_init.exists() {
        let _ = fs::write(ex_init, "");
    }
    let test_init = tests_dir.join("__init__.py");
    if !test_init.exists() {
        let _ = fs::write(test_init, "");
    }

    // Write updated code to target file if provided
    if let (Some(target), Some(c)) = (target_file, code) {
        let target_path = base_dir.join(target);
        if let Some(parent) = target_path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(target_path, c);
    }

    // Seed test file if absent
    let test_path = base_dir.join(test_file);
    if !test_path.exists() {
        if test_file.ends_with("test_block_manager.py") {
            let test_content = r#"import pytest
from exercises.block_manager import BlockManager

def test_allocation():
    mgr = BlockManager(num_blocks=4)
    b1 = mgr.allocate()
    b2 = mgr.allocate()
    assert b1 != b2
    assert len(mgr.allocated) == 2

def test_out_of_blocks():
    mgr = BlockManager(num_blocks=2)
    mgr.allocate()
    mgr.allocate()
    with pytest.raises(MemoryError):
        mgr.allocate()

def test_free_and_reuse():
    mgr = BlockManager(num_blocks=2)
    b1 = mgr.allocate()
    mgr.free(b1)
    assert b1 not in mgr.allocated
    b2 = mgr.allocate()
    assert b2 == b1
"#;
            let _ = fs::write(&test_path, test_content);
        } else if test_file.ends_with("test_starter.py") {
            let test_content = r#"from exercises.starter import check_env

def test_env():
    assert check_env() is True
"#;
            let _ = fs::write(&test_path, test_content);
        }
    }

    // Seed target exercise file if absent
    if let Some(target) = target_file {
        let target_path = base_dir.join(target);
        if !target_path.exists() {
            if target.ends_with("block_manager.py") {
                let default_code = r#"class BlockManager:
    def __init__(self, num_blocks: int):
        self.free_list = list(range(num_blocks))
        self.allocated = set()

    def allocate(self) -> int:
        if not self.free_list:
            raise MemoryError("Out of KV blocks!")
        block_id = self.free_list.pop()
        self.allocated.add(block_id)
        return block_id

    def free(self, block_id: int):
        self.allocated.remove(block_id)
        self.free_list.append(block_id)
"#;
                let _ = fs::write(&target_path, default_code);
            } else if target.ends_with("starter.py") {
                let default_code = "def check_env():\n    return True\n";
                let _ = fs::write(&target_path, default_code);
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn provision_course_workspace(slug: String, title: String, topic: String) -> Result<ProvisionResult, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let base_dir = PathBuf::from(home).join("heji-courses").join(&slug);

    if base_dir.exists() {
        return Ok(ProvisionResult {
            path: base_dir.to_string_lossy().to_string(),
            slug,
            title,
        });
    }

    fs::create_dir_all(base_dir.join(".agents/skills/course-author")).map_err(|e| e.to_string())?;
    fs::create_dir_all(base_dir.join(".claude/skills/course-author")).map_err(|e| e.to_string())?;
    fs::create_dir_all(base_dir.join(".mcp")).map_err(|e| e.to_string())?;
    fs::create_dir_all(base_dir.join("chapters")).map_err(|e| e.to_string())?;
    fs::create_dir_all(base_dir.join("exercises")).map_err(|e| e.to_string())?;
    fs::create_dir_all(base_dir.join("tests")).map_err(|e| e.to_string())?;

    // 1. Seed course.yaml
    let course_yaml = format!(
        "id: \"{}\"\ntitle: \"{}\"\ndescription: \"Interactive course on {}\"\ndomain: \"ai-inference\"\nversion: \"1.0.0\"\nchapters:\n  - id: \"ch-01\"\n    slug: \"01-overview\"\n    title: \"1. Overview & Foundations\"\n    file: \"chapters/01-overview.md\"\n",
        slug, title, topic
    );
    fs::write(base_dir.join("course.yaml"), course_yaml).map_err(|e| e.to_string())?;

    // 2. Seed .agents/skills/course-author/SKILL.md
    let skill_md = format!(
        r#"---
name: course-author
description: Author interactive courses for the Polymath Course Player using declarative components and test-driven exercises.
---

# Polymath Course Authoring Skill

You are an expert tutor authoring an interactive course on **{}** in this directory.

## Layout & Invariants
1. `chapters/*.md`: Chapter narrative content with embedded JSX components.
2. `exercises/*.py`: Starter code stubs for hands-on exercises.
3. `tests/*.py`: Pytest automated verification suites.
4. `course.yaml`: Course metadata and chapter manifest.

## Available UI Components
Embed these clean tags directly into your chapter markdown:

- `<MemoryBlockGrid totalBlocks="32" allocatedBlocks="18" sharedPrefixBlocks="8" title="GPU HBM3 Memory Map" />`
- `<CodeExercise id="ex-01" title="Build Allocator" targetFile="exercises/allocator.py" testFile="tests/test_allocator.py" instructions="Implement allocate()" starterCode="def allocate():\n    pass" />`
- `<RooflinePlot arithmeticIntensity="2.4" achievedTflops="720" memoryCeilingTbs="3.35" computeCeilingTflops="989" kernelLabel="Custom Attention" />`
- `<ClusterTopology nodeCount="1" gpusPerNode="8" interconnect="nvlink" />`
- `<SocraticQuiz question="What condition allows radix block eviction?" options="Ref count is 0|Cache is full" correctAnswerIndex="0" explanation="Nodes must have ref count 0." />`

## Instructions
1. Outline 3 to 6 progressive chapters under `chapters/`.
2. Every chapter must combine pedagogy with an interactive hardware component.
3. Create starter code in `exercises/` and passing unit tests in `tests/`.
4. Run `pytest` locally in this directory to verify test correctness.
"#,
        topic
    );
    fs::write(base_dir.join(".agents/skills/course-author/SKILL.md"), &skill_md).map_err(|e| e.to_string())?;
    fs::write(base_dir.join(".claude/skills/course-author/SKILL.md"), &skill_md).map_err(|e| e.to_string())?;

    // 3. Seed starter chapter
    let chapter_md = format!(
        r#"# 1. Overview & Core Intuition

Welcome to **{}**!

In this course, we will break down the systems architecture from zero to hero.

<MemoryBlockGrid totalBlocks="32" allocatedBlocks="8" sharedPrefixBlocks="4" title="Initial Memory Layout" />

<CodeExercise id="starter-ex" title="1.1 Starter Verification" targetFile="exercises/starter.py" testFile="tests/test_starter.py" instructions="Return True to verify the environment." starterCode="def check_env():\n    return False" />

<SocraticQuiz question="What is our primary goal?" options="Master systems through hands-on code|Memorize equations without practice" correctAnswerIndex="0" explanation="Active practice builds durable mental models." />
"#,
        title
    );
    fs::write(base_dir.join("chapters/01-overview.md"), chapter_md).map_err(|e| e.to_string())?;

    // 4. Seed starter exercise and test
    fs::write(base_dir.join("exercises/starter.py"), "def check_env():\n    return True\n").map_err(|e| e.to_string())?;
    fs::write(base_dir.join("tests/test_starter.py"), "from exercises.starter import check_env\n\ndef test_env():\n    assert check_env() is True\n").map_err(|e| e.to_string())?;

    Ok(ProvisionResult {
        path: base_dir.to_string_lossy().to_string(),
        slug,
        title,
    })
}

#[tauri::command]
fn open_course_terminal(course_dir: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "tell application \"Terminal\"\n  do script \"cd '{}' && clear && echo 'Polymath Course Workspace: {}' && ls -la\"\n  activate\nend tell",
            course_dir, course_dir
        );
        Command::new("osascript")
            .arg("-e")
            .arg(script)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok("Terminal launched".to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Ok("Platform terminal launcher ready".to_string())
    }
}

#[tauri::command]
fn init_pty_session(
    app: AppHandle,
    state: State<AppPtyState>,
    cwd: Option<String>,
    rows: Option<u16>,
    cols: Option<u16>,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let size = PtySize {
        rows: rows.unwrap_or(24).max(1),
        cols: cols.unwrap_or(80).max(1),
        pixel_width: 0,
        pixel_height: 0,
    };

    let pair = pty_system.openpty(size).map_err(|e| format!("Failed to open PTY: {}", e))?;

    let default_shell = std::env::var("SHELL").unwrap_or_else(|_| {
        if cfg!(windows) {
            "powershell.exe".to_string()
        } else {
            "/bin/zsh".to_string()
        }
    });

    let mut cmd = CommandBuilder::new(&default_shell);
    #[cfg(unix)]
    cmd.arg("-l"); // Login shell to load full environment (~/.zprofile, PATH, etc.)

    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");

    // Explicitly set UTF-8 locale so Python/Node/Ink TUI frameworks render Unicode box borders correctly
    cmd.env("LANG", std::env::var("LANG").unwrap_or_else(|_| "en_US.UTF-8".to_string()));
    cmd.env("LC_ALL", std::env::var("LC_ALL").unwrap_or_else(|_| "en_US.UTF-8".to_string()));

    // Ensure PATH has managed virtualenv bin, common developer tools, and agent CLI locations
    let current_path = std::env::var("PATH").unwrap_or_default();
    let home = std::env::var("HOME").unwrap_or_default();
    let central_venv_bin = PathBuf::from(&home).join("heji-courses").join(".venv").join("bin");
    let extra_paths = format!(
        "{}:{}/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:{}",
        central_venv_bin.display(),
        home,
        current_path
    );
    cmd.env("PATH", extra_paths);
    cmd.env("VIRTUAL_ENV", PathBuf::from(&home).join("heji-courses").join(".venv"));

    if let Some(ref dir) = cwd {
        let p = resolve_course_dir(dir);
        if p.exists() {
            cmd.cwd(p);
        }
    }

    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    // Background reader thread with incomplete UTF-8 sequence boundary buffering
    let app_clone = app.clone();
    thread::spawn(move || {
        let mut incomplete: Vec<u8> = Vec::with_capacity(16);
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = if incomplete.is_empty() {
                        buf[..n].to_vec()
                    } else {
                        let mut d = std::mem::take(&mut incomplete);
                        d.extend_from_slice(&buf[..n]);
                        d
                    };

                    let mut start = 0;
                    while start < data.len() {
                        match std::str::from_utf8(&data[start..]) {
                            Ok(valid_str) => {
                                let _ = app_clone.emit("pty-output", valid_str.to_string());
                                start = data.len();
                            }
                            Err(err) => {
                                let valid_up_to = err.valid_up_to();
                                if valid_up_to > 0 {
                                    let valid_str = unsafe {
                                        std::str::from_utf8_unchecked(&data[start..start + valid_up_to])
                                    };
                                    let _ = app_clone.emit("pty-output", valid_str.to_string());
                                    start += valid_up_to;
                                }

                                match err.error_len() {
                                    None => {
                                        // Incomplete sequence at end of chunk: hold for next read
                                        incomplete.extend_from_slice(&data[start..]);
                                        break;
                                    }
                                    Some(len) => {
                                        // Skip invalid byte and emit replacement
                                        let _ = app_clone.emit("pty-output", "\u{FFFD}".to_string());
                                        start += len;
                                    }
                                }
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }
    });

    let session = PtySession {
        master: pair.master,
        writer,
    };

    let mut lock = state.session.lock().map_err(|e| e.to_string())?;
    *lock = Some(session);

    Ok("PTY session started".to_string())
}

#[tauri::command]
fn write_pty_data(state: State<AppPtyState>, data: String) -> Result<(), String> {
    let mut lock = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut session) = *lock {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        session
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

#[tauri::command]
fn resize_pty_session(state: State<AppPtyState>, rows: u16, cols: u16) -> Result<(), String> {
    if rows == 0 || cols == 0 {
        return Ok(());
    }
    let lock = state.session.lock().map_err(|e| e.to_string())?;
    if let Some(ref session) = *lock {
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
        Ok(())
    } else {
        Err("No active PTY session".to_string())
    }
}

#[tauri::command]
async fn run_exercise_tests(
    course_dir: String,
    test_file: String,
    target_file: Option<String>,
    code: Option<String>,
) -> Result<TestRunResult, String> {
    let start = std::time::Instant::now();
    let base_dir = resolve_course_dir(&course_dir);
    fs::create_dir_all(&base_dir).map_err(|e| e.to_string())?;

    // 1. Ensure exercise files and user code are written to disk
    ensure_starter_files(&base_dir, target_file.as_deref(), &test_file, code.as_deref())?;

    // 2. Ensure managed virtual environment and pytest are installed
    let pytest_bin = ensure_managed_pytest(&base_dir)?;

    let test_path = base_dir.join(&test_file);

    // 3. Execute pytest using the managed virtual environment with PYTHONPATH
    let output = Command::new(&pytest_bin)
        .arg(&test_path)
        .arg("-v")
        .env("PYTHONPATH", &base_dir)
        .current_dir(&base_dir)
        .output();

    let duration_ms = start.elapsed().as_millis() as u64;

    match output {
        Ok(out) => {
            let success = out.status.success();
            let mut text = String::from_utf8_lossy(&out.stdout).to_string();
            if !out.stderr.is_empty() {
                text.push_str("\n");
                text.push_str(&String::from_utf8_lossy(&out.stderr));
            }
            Ok(TestRunResult {
                success,
                output: text,
                duration_ms,
            })
        }
        Err(e) => Ok(TestRunResult {
            success: false,
            output: format!("Failed to spawn pytest at {}: {}", pytest_bin.display(), e),
            duration_ms,
        }),
    }
}

#[tauri::command]
fn list_local_courses(active_dir: Option<String>) -> Result<Vec<LocalCourseInfo>, String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let courses_root = PathBuf::from(&home).join("heji-courses");
    if !courses_root.exists() {
        let _ = fs::create_dir_all(&courses_root);
    }

    let mut courses = Vec::new();
    let entries = fs::read_dir(&courses_root).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        if dir_name.starts_with('.') {
            continue; // Skip hidden folders like .venv or .git
        }

        let course_yaml = path.join("course.yaml");
        let course_json = path.join("course.json");
        let chapters_dir = path.join("chapters");
        let agents_skill = path.join(".agents/skills/course-author/SKILL.md");
        let claude_skill = path.join(".claude/skills/course-author/SKILL.md");

        let chapter_count = if chapters_dir.is_dir() {
            fs::read_dir(&chapters_dir)
                .map(|it| {
                    it.flatten()
                        .filter(|p| p.path().extension().map_or(false, |ext| ext == "md"))
                        .count()
                })
                .unwrap_or(0)
        } else {
            0
        };

        let mut title = dir_name.replace('-', " ");
        let mut description = format!("Interactive course in {}", path.display());

        if course_yaml.exists() {
            if let Ok(content) = fs::read_to_string(&course_yaml) {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("title:") {
                        title = trimmed
                            .trim_start_matches("title:")
                            .trim()
                            .trim_matches('"')
                            .trim_matches('\'')
                            .to_string();
                    } else if trimmed.starts_with("description:") {
                        description = trimmed
                            .trim_start_matches("description:")
                            .trim()
                            .trim_matches('"')
                            .trim_matches('\'')
                            .to_string();
                    }
                }
            }
        } else if course_json.exists() {
            if let Ok(content) = fs::read_to_string(&course_json) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(t) = val.get("title").and_then(|v| v.as_str()) {
                        title = t.to_string();
                    }
                    if let Some(d) = val.get("description").and_then(|v| v.as_str()) {
                        description = d.to_string();
                    }
                }
            }
        }

        let has_agent_skill = agents_skill.exists() || claude_skill.exists();
        let path_str = path.to_string_lossy().to_string();
        let is_active = active_dir.as_ref().map_or(false, |ad| {
            ad == &path_str || ad.ends_with(&dir_name) || (ad.starts_with("~/") && path_str.ends_with(ad.trim_start_matches("~/")))
        });

        courses.push(LocalCourseInfo {
            slug: dir_name,
            title,
            description,
            path: path_str,
            chapter_count,
            has_agent_skill,
            is_active,
        });
    }

    courses.sort_by(|a, b| a.slug.cmp(&b.slug));
    Ok(courses)
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let target = if let Some(stripped) = path.strip_prefix("~/") {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            PathBuf::from(home).join(stripped)
        } else {
            PathBuf::from(path)
        };
        Command::new("open")
            .arg(&target)
            .spawn()
            .map_err(|e| format!("Failed to open path in Finder: {}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppPtyState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            provision_course_workspace,
            open_course_terminal,
            init_pty_session,
            write_pty_data,
            resize_pty_session,
            run_exercise_tests,
            list_local_courses,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running polymath desktop");
}
