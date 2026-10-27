use std::fs;
use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};

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
    fs::write(base_dir.join(".agents/skills/course-author/SKILL.md"), skill_md).map_err(|e| e.to_string())?;

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
async fn run_exercise_tests(course_dir: String, test_file: String) -> Result<TestRunResult, String> {
    let start = std::time::Instant::now();
    let test_path = PathBuf::from(&course_dir).join(&test_file);

    let output = Command::new("python3")
        .arg("-m")
        .arg("pytest")
        .arg(test_path)
        .arg("-v")
        .current_dir(&course_dir)
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
            output: format!("Failed to spawn pytest: {}", e),
            duration_ms,
        }),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            provision_course_workspace,
            open_course_terminal,
            run_exercise_tests
        ])
        .run(tauri::generate_context!())
        .expect("error while running polymath desktop");
}
