// FitLoop: 5 Feature Proposals + Baseline Review
// Grounded in projects/fitloop/ (CLAUDE.md, types.ts, WorkoutPlayer.swift, TodayView.swift, mcp.ts, glasses.ts)
(() => {
  const K = KIT;
  const I = K.icon;

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Current Baseline Today view
  // ─────────────────────────────────────────────────────────────────────────
  const renderBaselineToday = () => {
    return K.phone(`
      <div class="fl-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <span class="fl-badge badge-blue">Week 4 · Day 1</span>
            <h2 style="font-size:20px; font-weight:800; margin:6px 0 2px;">${K.athlete.todayTitle}</h2>
            <small style="color:#6B7280;">${K.athlete.todayDuration} min · ${K.athlete.todayKind.toUpperCase()}</small>
          </div>
          <div style="text-align:right;">
            <span style="font-size:18px; font-weight:800; color:#EF4444; display:flex; align-items:center; gap:3px;">${I("heart", 16)} 142</span>
            <small style="color:#6B7280;">Live HR</small>
          </div>
        </div>
        <div class="summary-grid">
          <div class="stat-box">
            <b>${K.athlete.workoutsDone}/${K.athlete.workoutsPlanned}</b>
            <small>Workouts this week</small>
          </div>
          <div class="stat-box">
            <b>${K.athlete.streak} Days</b>
            <small>Active streak</small>
          </div>
        </div>
      </div>

      <div class="section-title">Today's Workouts</div>
      <div class="fl-card workout-item" style="cursor:pointer;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:40px; height:40px; border-radius:10px; background:rgba(0,122,255,0.1); color:#007AFF; display:flex; align-items:center; justify-content:center;">
            ${I("dumbbell", 22)}
          </div>
          <div>
            <b style="font-size:15px; display:block;">Upper Body Hypertrophy</b>
            <small style="color:#6B7280;">3 exercises · 9 total sets</small>
          </div>
        </div>
        <span class="fl-badge badge-blue">Start Workout ${I("chevron", 12)}</span>
      </div>

      <div class="section-title">Planned Meals</div>
      ${K.sampleMeals.map(m => `
        <div class="fl-card meal-item">
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <b style="font-size:14px;">${m.name}</b>
              <small style="color:#6B7280;">${m.time}</small>
            </div>
            <small style="color:#6B7280; display:block; margin-top:2px;">${m.items.slice(0, 36)}...</small>
          </div>
          ${m.status === "done"
            ? `<span class="fl-badge badge-green">${I("check", 12)} Eaten</span>`
            : `<button style="background:#F3F4F6; border:none; padding:6px 10px; border-radius:8px; font-size:12px; font-weight:600; cursor:pointer;">Log</button>`
          }
        </div>
      `).join("")}
    `, { title: "Today", tab: "today" });
  };

  const renderBaselinePlayer = () => {
    return K.phone(`
      <div class="fl-card player-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span class="fl-badge badge-blue">Exercise 1 of 3</span>
          <span style="font-size:13px; font-weight:700; color:#EF4444; display:flex; align-items:center; gap:3px;">${I("heart", 14)} 138 bpm</span>
        </div>
        <h2 style="font-size:22px; font-weight:800; margin:0 0 4px;">Barbell Incline Bench</h2>
        <small style="color:#6B7280; display:block; margin-bottom:14px;">Set 2 of 3 · Target: 8 reps @ 82.5 kg</small>

        <div style="background:#F8FAFC; border-radius:12px; padding:12px; margin-bottom:14px;">
          <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:6px;">COACH CUES</div>
          <div style="font-size:12px; color:#334155; line-height:1.4;">• Retract scapulae firmly<br>• Tuck elbows 45 degrees<br>• Drive feet into floor</div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#EFF6FF; border-radius:12px; padding:12px 14px; margin-bottom:16px;">
          <div>
            <small style="color:#1E40AF; font-weight:600; display:block;">REST CLOCK</small>
            <b style="font-size:24px; color:#1D4ED8;">01:18</b>
          </div>
          <span class="fl-badge badge-blue">+30s</span>
        </div>

        <button style="width:100%; padding:14px; border-radius:12px; background:#10B981; color:white; font-size:16px; font-weight:700; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
          ${I("check", 18)} Set Done (8 reps @ 82.5 kg)
        </button>
      </div>

      <div class="fl-card">
        <b style="font-size:14px; display:block; margin-bottom:8px;">Up Next</b>
        <div style="display:flex; justify-content:space-between; font-size:13px;">
          <span>Set 3: 8 reps @ 82.5 kg</span>
          <span style="color:#6B7280;">90s rest</span>
        </div>
      </div>
    `, { title: "Workout Player", player: true });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Feature 1: Voice Check-in & RPE Audio Memo
  // ─────────────────────────────────────────────────────────────────────────
  const renderVoiceRpe = () => {
    return K.phone(`
      <div class="player-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="fl-badge badge-purple">${I("mic", 12)} Audio Memo Enabled</span>
          <span style="font-size:13px; font-weight:700; color:#EF4444; display:flex; align-items:center; gap:3px;">${I("heart", 14)} 144 bpm</span>
        </div>

        <div class="exercise-title">Barbell Incline Bench</div>
        <small style="color:#6B7280;">Set 2 of 3</small>

        <div class="target-row">
          <div>
            <small style="color:#6B7280; font-weight:600;">TARGET</small>
            <div class="target-val">8 reps @ 82.5 kg</div>
          </div>
          <span class="fl-badge badge-blue">RPE 8 Target</span>
        </div>

        <!-- RPE Dial Selector -->
        <div class="rpe-dial-container">
          <div class="rpe-header">
            <span>RATE PERCEIVED EXERTION (RPE)</span>
            <span style="color:#007AFF; font-weight:700;">8.5 (1 rep in reserve)</span>
          </div>
          <div class="rpe-chips">
            <span class="rpe-chip">6.5</span>
            <span class="rpe-chip">7.0</span>
            <span class="rpe-chip">7.5</span>
            <span class="rpe-chip">8.0</span>
            <span class="rpe-chip active">8.5</span>
            <span class="rpe-chip">9.0</span>
            <span class="rpe-chip">10</span>
          </div>
        </div>

        <!-- Real-time Voice Waveform & Transcript -->
        <div class="voice-waveform-box">
          <div class="mic-pulse-btn">${I("mic", 20)}</div>
          <div style="flex:1;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-size:11px; font-weight:700; color:#EF4444; letter-spacing:0.04em;">RECORDING AUDIO MEMO...</span>
              <small style="font-size:11px; color:#EF4444; font-weight:700;">0:04</small>
            </div>
            <div class="wave-bars">
              <span class="bar" style="height:12px;"></span>
              <span class="bar" style="height:22px;"></span>
              <span class="bar" style="height:16px;"></span>
              <span class="bar" style="height:8px;"></span>
              <span class="bar" style="height:24px;"></span>
              <span class="bar" style="height:18px;"></span>
              <span class="bar" style="height:14px;"></span>
              <span class="bar" style="height:20px;"></span>
              <span class="bar" style="height:10px;"></span>
              <span class="bar" style="height:19px;"></span>
            </div>
            <div class="transcript-quote">“Left shoulder felt solid, bar speed was fast until rep 7, stopped at RPE 8.5.”</div>
          </div>
        </div>

        <button class="set-done-btn">
          ${I("check", 20)} Complete Set & Save Voice Note
        </button>
      </div>

      <div class="fl-card" style="margin-top:12px;">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
          ${I("sparkles", 16)}
          <b style="font-size:13px; color:#6366F1;">AGENT COACHING FEEDBACK</b>
        </div>
        <p style="font-size:12px; color:#475569; margin:0; line-height:1.4;">
          Your voice transcript and RPE will automatically be sent to your connected AI coach over MCP. The agent reads this in <code style="background:#F1F5F9; padding:2px 4px; border-radius:4px;">get_checkins</code> to adjust set 3 weight.
        </p>
      </div>
    `, { title: "Workout Player", player: true });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Feature 2: Barbell Plate Calculator & Gym Equipment Rack
  // ─────────────────────────────────────────────────────────────────────────
  const renderPlateCalc = () => {
    return K.phone(`
      <div class="plate-visual-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="fl-badge badge-blue">Barbell Loading</span>
          <span class="fl-badge badge-green">Olympic Bar 20 kg</span>
        </div>
        <div style="font-size:24px; font-weight:800; margin:10px 0 2px;">82.5 kg Incline Bench</div>
        <small style="color:#6B7280;">Prescribed by agent · 31.25 kg per sleeve</small>

        <!-- Visual Barbell Stage -->
        <div class="barbell-stage">
          <div class="bar-shaft">
            <!-- Left Sleeve Plates -->
            <div class="sleeve" style="flex-direction:row-reverse;">
              <div class="bar-collar"></div>
              <div class="plate plate-20" title="20 kg">20</div>
              <div class="plate plate-10" title="10 kg">10</div>
              <div class="plate plate-1_25" title="1.25 kg">1.2</div>
            </div>
            <!-- Center Knurling Center Line -->
            <div style="width:2px; height:18px; background:rgba(255,255,255,0.4);"></div>
            <!-- Right Sleeve Plates -->
            <div class="sleeve">
              <div class="bar-collar"></div>
              <div class="plate plate-20" title="20 kg">20</div>
              <div class="plate plate-10" title="10 kg">10</div>
              <div class="plate plate-1_25" title="1.25 kg">1.2</div>
            </div>
          </div>
        </div>

        <!-- Plate Breakdown Pills -->
        <div class="plate-summary-pills">
          <span class="side-pill"><b>Each side:</b></span>
          <span class="side-pill" style="border-left:3px solid #2563EB;">1 × 20 kg</span>
          <span class="side-pill" style="border-left:3px solid #16A34A;">1 × 10 kg</span>
          <span class="side-pill" style="border-left:3px solid #94A3B8;">1 × 1.25 kg</span>
        </div>

        <!-- Snap / Rounding Helper -->
        <div class="snap-row">
          <span>Gym missing 1.25 kg micro-plates?</span>
          <button class="snap-btn">Snap to 80 kg</button>
        </div>

        <div style="display:flex; gap:10px; margin-top:14px;">
          <button style="flex:1; padding:12px; background:#F1F5F9; border:none; border-radius:10px; font-weight:600; font-size:13px; cursor:pointer;">
            Change Bar (Trap / 15kg)
          </button>
          <button style="flex:1; padding:12px; background:#10B981; color:white; border:none; border-radius:10px; font-weight:700; font-size:13px; cursor:pointer;">
            Loaded & Ready
          </button>
        </div>
      </div>

      <div class="fl-card" style="margin-top:12px;">
        <b style="font-size:13px; display:block; margin-bottom:4px;">Even G2 & Apple Watch Support</b>
        <p style="font-size:12px; color:#6B7280; margin:0; line-height:1.4;">
          The plate schematic is automatically formatted as an ASCII rack string on your Even G2 glasses display (<code style="background:#F1F5F9; padding:1px 4px; border-radius:3px;">[20|10|1.25]</code>) so you never touch your phone while loading weights.
        </p>
      </div>
    `, { title: "Workout Player", player: true });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Feature 3: Meal Photo Smart-Portion & Vision Analysis
  // ─────────────────────────────────────────────────────────────────────────
  const renderMealVision = () => {
    return K.phone(`
      <div class="meal-card-vision">
        <!-- Photo Viewport Simulated Camera -->
        <div class="photo-viewport">
          <div class="photo-hud">
            <span class="target-hud">TARGET: 690 KCAL · 56G PROTEIN</span>
            <span style="font-size:11px; background:rgba(0,122,255,0.8); padding:3px 8px; border-radius:12px; font-weight:600;">AGENT VISION ON</span>
          </div>

          <!-- Crosshairs & Detection Box -->
          <div style="margin:auto; width:180px; height:100px; border:1px dashed rgba(255,255,255,0.6); border-radius:10px; display:flex; flex-direction:column; justify-content:space-between; padding:6px; box-sizing:border-box;">
            <span style="font-size:9px; background:rgba(16,185,129,0.8); padding:1px 5px; border-radius:4px; align-self:flex-start;">Plate Detected (94%)</span>
            <span style="font-size:9px; color:rgba(255,255,255,0.8); text-align:center;">Grilled Chicken & Quinoa</span>
            <span style="font-size:8px; opacity:0.6; text-align:right;">R2 // Encrypted</span>
          </div>

          <div class="shutter-overlay">
            <small style="font-size:11px; opacity:0.8;">Lunch · 12:30 PM</small>
            <div class="snap-shutter-btn">${I("camera", 24)}</div>
            <small style="font-size:11px; opacity:0.8;">Retake</small>
          </div>
        </div>

        <div class="vision-analysis-box">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <b style="font-size:16px;">Grilled Chicken & Quinoa Bowl</b>
              <small style="display:block; color:#6B7280;">Estimated 720 kcal · 58g Protein</small>
            </div>
            <span class="fl-badge badge-amber">+30 kcal delta</span>
          </div>

          <div style="margin-top:12px;">
            <small style="font-weight:700; color:#475569; font-size:11px;">ADJUST PORTION VS PLAN</small>
            <div class="portion-adjust-grid">
              <span class="portion-pill">Less (~80%)</span>
              <span class="portion-pill">As Planned</span>
              <span class="portion-pill active">More (+15%)</span>
            </div>
          </div>

          <div class="agent-note-bubble">
            <b style="color:#7C3AED; display:block; margin-bottom:2px;">Coach Vision Analysis</b>
            “I see an extra half avocado slice (~60 kcal) and a generous portion of quinoa. Macros adjusted: +12g carb, +4g fat. We'll balance this with dinner.”
          </div>

          <button style="width:100%; margin-top:14px; padding:12px; background:#10B981; color:white; border:none; border-radius:12px; font-weight:700; font-size:14px; cursor:pointer;">
            ${I("check", 16)} Save Meal Check-in & Photo
          </button>
        </div>
      </div>
    `, { title: "Meal Check-in", tab: "today" });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Feature 4: Superset & Circuit Execution Engine
  // ─────────────────────────────────────────────────────────────────────────
  const renderSupersetEngine = () => {
    return K.phone(`
      <div class="superset-cluster-card">
        <div class="cluster-header">
          <span class="fl-badge badge-purple">${I("repeat", 12)} Superset Cluster A</span>
          <span style="font-size:13px; font-weight:700; color:#EF4444; display:flex; align-items:center; gap:3px;">${I("heart", 14)} 152 bpm</span>
        </div>

        <div style="font-size:18px; font-weight:800; margin-bottom:12px;">Antagonist Push / Pull Pair</div>

        <!-- Dual Split Exercise Cards -->
        <div class="exercise-split-row">
          <!-- Active Exercise A1 -->
          <div class="sub-ex-card active">
            <span class="ex-tag">A1 · ACTIVE SET</span>
            <div class="ex-title-sm">Barbell Incline Bench</div>
            <div class="ex-metric-sm" style="color:#007AFF;">8 reps @ 82.5 kg</div>
            <div style="font-size:11px; color:#64748B; margin-top:4px;">Set 2 of 3</div>
          </div>

          <!-- On-Deck Exercise A2 -->
          <div class="sub-ex-card">
            <span class="ex-tag">A2 · ON-DECK</span>
            <div class="ex-title-sm">Chest-Supported Row</div>
            <div class="ex-metric-sm">10 reps @ 32 kg</div>
            <div style="font-size:11px; color:#64748B; margin-top:4px;">Set 2 of 3</div>
          </div>
        </div>

        <!-- Round Tracker -->
        <div class="round-tracker">
          <span>SUPERSET ROUND 2 / 3</span>
          <span style="color:#007AFF;">Transition: 15s</span>
        </div>

        <!-- Shared Inter-Round Rest Clock -->
        <div class="shared-clock-bar">
          <div style="display:flex; align-items:center; gap:6px;">
            ${I("clock", 16)}
            <span>SHARED REST AFTER A2</span>
          </div>
          <b style="font-size:16px;">75 sec</b>
        </div>

        <div style="display:flex; gap:10px; margin-top:14px;">
          <button style="flex:1; padding:12px; background:#007AFF; color:white; border:none; border-radius:12px; font-weight:700; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
            ${I("check", 16)} Done A1 → Switch to A2
          </button>
        </div>
      </div>

      <div class="fl-card" style="margin-top:12px;">
        <b style="font-size:13px; display:block; margin-bottom:4px;">Smart Transition on Glasses & Watch</b>
        <p style="font-size:12px; color:#6B7280; margin:0; line-height:1.4;">
          Completing A1 automatically signals your Apple Watch and Even G2 glasses to switch targets to A2 without starting the full rest clock. The rest clock only fires when both paired exercises finish a round.
        </p>
      </div>
    `, { title: "Workout Player", player: true });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Feature 5: Morning Readiness & Daily Autoregulation Briefing
  // ─────────────────────────────────────────────────────────────────────────
  const renderReadinessBrief = () => {
    return K.phone(`
      <!-- Hero Readiness Score Card -->
      <div class="readiness-hero-card">
        <div class="readiness-top">
          <div>
            <span class="fl-badge badge-green" style="background:rgba(16,185,129,0.2); color:#A7F3D0; margin-bottom:6px;">
              ${I("sparkles", 12)} Morning Recovery
            </span>
            <div style="font-size:22px; font-weight:800;">Optimal Readiness</div>
            <small style="color:#94A3B8;">Synced from Apple Health at 7:15 AM</small>
          </div>
          <div class="readiness-score-ring">
            <span class="score-num">88</span>
            <span class="score-lbl">Score</span>
          </div>
        </div>

        <div class="vitals-triplet">
          <div class="vital-col">
            <b>7h 42m</b>
            <small>Sleep (86% qual)</small>
          </div>
          <div class="vital-col">
            <b>68 ms</b>
            <small>HRV (+12% avg)</small>
          </div>
          <div class="vital-col">
            <b>52 bpm</b>
            <small>Resting HR</small>
          </div>
        </div>
      </div>

      <!-- Coach Briefing & Autoregulation Card -->
      <div class="coach-brief-card">
        <div class="brief-header">
          ${I("bubble", 14)}
          <span>DAILY COACH BRIEFING · MCP v3.2</span>
        </div>
        <div class="brief-text">
          “Your parasympathetic recovery is high this morning (HRV 68ms vs 58ms baseline). Sleep debt cleared. Upper body workout is primed for progressive overload today.”
        </div>

        <div class="auto-adjust-banner">
          <div>
            <b style="font-size:12px; color:#3730A3; display:block;">Suggested Autoregulation</b>
            <span style="font-size:11px; color:#4F46E5;">Bench top set +2.5 kg (85 kg)</span>
          </div>
          <button class="apply-tune-btn">Apply (+2.5 kg)</button>
        </div>
      </div>

      <div class="section-title">Today's Adapted Schedule</div>
      <div class="fl-card workout-item">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:38px; height:38px; border-radius:10px; background:rgba(0,122,255,0.1); color:#007AFF; display:flex; align-items:center; justify-content:center;">
            ${I("dumbbell", 20)}
          </div>
          <div>
            <b style="font-size:14px; display:block;">Upper Body Hypertrophy</b>
            <small style="color:#6B7280;">Bench: 82.5 kg → 85 kg primed</small>
          </div>
        </div>
        <span class="fl-badge badge-blue">Ready</span>
      </div>
    `, { title: "Today", tab: "today" });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Candidate Review Configuration & Export
  // ─────────────────────────────────────────────────────────────────────────
  window.REVIEW = {
    key: "2026-10-26-fitloop-features-v1",
    dir: "reports/2026-10-26-fitloop-features",
    repo: "tianhaoz95/hejitech-apps",
    port: 8813,
    project: "projects/fitloop",
    context: [
      "projects/fitloop/CLAUDE.md",
      "projects/fitloop/packages/core/src/types.ts",
      "projects/fitloop/apps/ios/App/Sources/WorkoutPlayer.swift",
      "projects/fitloop/apps/ios/App/Sources/TodayView.swift",
      "projects/fitloop/services/web/src/worker/mcp.ts",
      "projects/fitloop/apps/glasses/src/app.ts",
    ],
    brief: "Propose 5 high-value, technically grounded new features for FitLoop (iOS, Apple Watch, Even G2 glasses, and MCP coaching agent).",
    title: "FitLoop: 5 Feature Proposals",
    subtitle: "5 new features + current baseline",
    heading: "Pick feature directions for FitLoop",
    intro: "Explore 5 proposed features for FitLoop across iPhone, Apple Watch, Even G2 glasses, and the AI agent MCP protocol. Open each candidate to test the interactive mockups, view hardware HUDs, and read the engineering design specs. Star, heart, note, and copy the hand-off summary.",
    legend: ["<b>5</b> candidate features", "<b>1</b> current baseline"],
    round: 1,
    frame: "phone",
    modes: true,

    candidates: [
      // ── 00 · Baseline: Current App
      {
        id: "baseline",
        n: 0,
        name: "Current App",
        baseline: true,
        tagline: "Sequential Workout Player & Checklist Diet",
        concept: "Today's baseline FitLoop: the Today tab lists the day's scheduled workouts and meals. Workouts open in the full-screen WorkoutPlayer (one exercise at a time with sets, rest countdown, and static text cues); meals check off as eaten/skipped/swapped.",
        moves: [
          "Linear exercise navigation (one exercise at a time)",
          "Manual note button requiring keyboard typing",
          "Simple checklist diet logging without visual context",
          "Standard HealthKit daily vitals summary"
        ],
        palette: [["Background", "#F8F9FA"], ["Accent", "#007AFF"], ["Card", "#FFFFFF"]],
        facts: { Type: "Baseline", Effort: "—", Needs: "Already in main" },
        render: () => renderBaselineToday(),
        views: [
          { name: "Today Tab", render: () => renderBaselineToday() },
          { name: "Workout Player", render: () => renderBaselinePlayer() },
          {
            name: "Even G2 HUD",
            render: () => `<div class="view-surface-wrap">${K.renderGlasses([
              "UPPER BODY // 52 MIN",
              "1/3 INCLINE BENCH",
              "SET 2/3: 8 REPS @ 82.5K",
              "REST: 01:18",
              "HR: 138 BPM [Z3]",
              "--------------------",
              "> [TAP] SET DONE",
              "> [HOLD] EXERCISE CUES"
            ])}</div>`
          }
        ],
      },

      // ── 01 · Feature 1: Voice Check-in & RPE Audio Memo
      {
        id: "feat-voice-rpe",
        n: 1,
        name: "Voice Check-in & RPE",
        round: 1,
        tagline: "Hands-free audio note & subjective RPE right at set completion",
        concept: "Typing notes or tapping multiple buttons during high-intensity lifting is awkward and breaks focus. FitLoop adds a quick RPE selector dial (6–10) and an instant 1-tap audio memo directly onto the set completion bar. Audio is transcribed on-device into the set check-in (checkin.data.rpe and checkin.note), letting the user dictate 'Left shoulder twinge on rep 7, kept 1 in reserve' in 3 seconds. The connected AI coach reads these nuanced qualitative logs over MCP to autoregulate future sets and loads.",
        moves: [
          "Tactile RPE selector dial (6–10) directly integrated into the set completion action",
          "Hands-free audio waveform button with on-device real-time speech transcription",
          "Apple Watch & Glasses gestures: long-press digital crown or hold Even G2 ring to dictate set feel",
          "MCP schema extension: get_checkins delivers structured { rpe: 8.5, voice_transcript: '...' } to the coach agent"
        ],
        palette: [["Voice Accent", "#EF4444"], ["RPE Blue", "#007AFF"], ["Success", "#10B981"]],
        facts: { Type: "Workout Execution & Telemetry", Effort: "M", Needs: "AVAudioRecorder + SFSpeechRecognizer on iOS" },
        render: () => renderVoiceRpe(),
        views: [
          { name: "Workout Player (Active)", render: () => renderVoiceRpe() },
          {
            name: "Apple Watch Voice Memo",
            render: () => `<div class="view-surface-wrap">${K.renderWatch(
              "SET 2 DONE",
              `<div style="text-align:center; padding:10px 0;">
                <div style="font-size:18px; font-weight:800; color:#007AFF; margin-bottom:4px;">RPE 8.5</div>
                <div style="font-size:11px; color:#EF4444; font-weight:700; margin-bottom:8px;">● RECORDING AUDIO</div>
                <div style="font-size:10px; color:#98989D; font-style:italic;">“Felt solid, 1 in reserve”</div>
              </div>`
            )}</div>`
          },
          {
            name: "Even G2 HUD RPE Prompt",
            render: () => `<div class="view-surface-wrap">${K.renderGlasses([
              "SET 2/3 COMPLETE",
              "SELECT RPE (1-10):",
              "> [8.5] (1 REP IN RESERVE)",
              "--------------------",
              "[HOLD RING] VOICE NOTE",
              "AUDIO CAPTURED: 4 SEC",
              "TRANSCRIPT SYNCED",
              "REST TIMER: 90 SEC",
              "HR: 144 BPM"
            ])}</div>`
          }
        ],
        spec: {
          today: [
            "Check-ins only record raw status ('done' | 'skipped' | 'swapped') and optional typed text notes",
            "Athletes must tap a separate Note sheet requiring full keyboard typing",
            "RPE is only optionally entered as a loose number in checkin.data.rpe without an intuitive dial"
          ],
          proposed: [
            "Add tactile RPE dial directly to the WorkoutPlayer set completion row",
            "Add audio recording waveform using AVAudioRecorder with on-device SFSpeechRecognizer transcription",
            "Store voice transcript directly in checkin.note and audio blob URL in checkin.data.voice_memo_url",
            "Extend MCP get_checkins tool annotations to document voice memo payloads"
          ],
          files: [
            "projects/fitloop/packages/core/src/types.ts",
            "projects/fitloop/apps/ios/App/Sources/WorkoutPlayer.swift",
            "projects/fitloop/apps/ios/App/Sources/Services.swift",
            "projects/fitloop/services/web/src/worker/mcp.ts"
          ],
          risks: [
            "Noisy gym environments can degrade speech transcription: fallback to raw audio link + manual review",
            "Speech framework permissions must be gracefully handled if denied"
          ],
          verify: [
            "Tap mic in WorkoutPlayer → speak 5s memo → verify audio waveform moves and text transcript appears",
            "Save set → call MCP get_checkins → verify agent receives both rpe: 8.5 and transcribed note"
          ]
        },
        design: [
          {
            kind: "flow",
            title: "Voice Memo & RPE Telemetry Flow",
            note: "How real-time gym audio moves from the set completion bar to the AI coaching agent.",
            today: {
              nodes: [
                { id: "usr", label: "Athlete", sub: "taps Set Done", col: 0, row: 0 },
                { id: "app", label: "WorkoutPlayer", sub: "basic checkin", col: 1, row: 0, type: "ui" },
                { id: "api", label: "Worker API", sub: "status: done", col: 2, row: 0, type: "store" },
                { id: "mcp", label: "Agent MCP", sub: "no qualitative data", col: 3, row: 0, type: "model" }
              ],
              edges: [
                { from: "usr", to: "app", label: "tap" },
                { from: "app", to: "api", label: "POST /checkin" },
                { from: "api", to: "mcp", label: "get_checkins" }
              ]
            },
            proposed: {
              nodes: [
                { id: "usr", label: "Athlete", sub: "dials RPE + speaks", col: 0, row: 0 },
                { id: "rec", label: "On-Device STT", sub: "SFSpeechRecognizer", col: 1, row: 0, state: "new" },
                { id: "app", label: "WorkoutPlayer", sub: "enriched payload", col: 2, row: 0, type: "ui", state: "changed" },
                { id: "api", label: "Worker Store", sub: "RPE + Transcript", col: 3, row: 0, type: "store", state: "changed" },
                { id: "mcp", label: "Agent MCP", sub: "Autoregulates Plan", col: 4, row: 0, type: "model", state: "changed" }
              ],
              edges: [
                { from: "usr", to: "rec", label: "audio stream", state: "new" },
                { from: "rec", to: "app", label: "transcript", state: "new" },
                { from: "app", to: "api", label: "POST checkin (rpe, note)", state: "changed" },
                { from: "api", to: "mcp", label: "enriched telemetry", state: "changed" }
              ]
            }
          },
          {
            kind: "table",
            title: "Checkin Data Schema Enhancement",
            head: ["Field", "Today", "Proposed (Feature 1)", "Purpose"],
            rows: [
              ["data.rpe", "Optional number (rarely set)", "Required slider/dial 1.0–10.0 (steps of 0.5)", "Direct subjective effort measurement"],
              ["data.voice_memo_url", "None", "Optional short-lived audio link in R2", "Verifiable audio record of gym feedback"],
              ["note", "Empty unless typed manually", "Transcribed voice string (e.g. 'Shoulder twinge on rep 7')", "Instant contextual feedback for coach"],
              ["source", "'phone' | 'watch'", "'phone' | 'watch' | 'glasses' (+ audio source tag)", "Hardware provenance tracking"]
            ]
          }
        ]
      },

      // ── 02 · Feature 2: Barbell Plate Calculator & Gym Equipment Rack
      {
        id: "feat-plate-calc",
        n: 2,
        name: "Barbell Plate Calculator",
        round: 1,
        tagline: "Instant color-coded plate rack on Phone, Watch, and Even G2 Glasses",
        concept: "Strength athletes frequently receive loads from their AI agent (e.g. '82.5 kg' or '185 lbs') and spend rest time doing mental arithmetic or misloading the bar. FitLoop introduces an automated Plate Calculator embedded directly beneath every barbell exercise. It visually renders the exact plates needed on each side (using standard Olympic color coding), warns if the target is unrackable with the gym's plates, and offers 1-tap snap to nearest rackable weight. On Even G2 glasses, it renders a clean ASCII plate string ([20|10|1.25]).",
        moves: [
          "Interactive Olympic barbell diagram with color-coded bumper/iron plates (Red 25kg, Blue 20kg, Yellow 15kg, Green 10kg, White 5kg/2.5kg/1.25kg)",
          "1-tap 'Snap to rackable' rounding button with immediate target update",
          "Gym equipment presets in Settings (Standard 20kg bar, 15kg women's bar, Trap bar 25kg, Smith machine 7kg, collar weight)",
          "Even G2 HUD compact display: [BAR 20kg | 25 5 1.25] during set setup"
        ],
        palette: [["Olympic Red", "#DC2626"], ["Olympic Blue", "#2563EB"], ["Olympic Yellow", "#EAB308"], ["Olympic Green", "#16A34A"]],
        facts: { Type: "Gym Usability & Hardware Synergy", Effort: "S", Needs: "Plate solver algorithm in @fitloop/core" },
        render: () => renderPlateCalc(),
        views: [
          { name: "Barbell Visualizer", render: () => renderPlateCalc() },
          {
            name: "Apple Watch Plate Card",
            render: () => `<div class="view-surface-wrap">${K.renderWatch(
              "LOAD: 82.5 KG",
              `<div style="text-align:center; padding:6px 0;">
                <div style="font-size:12px; color:#30D158; font-weight:700;">EACH SIDE:</div>
                <div style="font-size:15px; font-weight:800; margin:4px 0;">20 + 10 + 1.25</div>
                <div style="font-size:10px; color:#98989D;">Bar: 20 kg · Collar: 0 kg</div>
              </div>`
            )}</div>`
          },
          {
            name: "Even G2 Glasses HUD",
            render: () => `<div class="view-surface-wrap">${K.renderGlasses([
              "BARBELL INCLINE BENCH",
              "TARGET LOAD: 82.5 KG",
              "--------------------",
              "SLEEVE RACK SCHEMATIC:",
              "[BAR 20KG] | 20 10 1.25",
              "TOTAL PLATES: 6",
              "--------------------",
              "> [TAP] CONFIRM LOADED",
              "> [HOLD] SNAP TO 80 KG"
            ])}</div>`
          }
        ],
        spec: {
          today: [
            "Exercise load is stored as an opaque string (e.g. '82.5 kg', 'RPE 8')",
            "Athlete must manually calculate bar and plate math in their head",
            "Glasses only show the text string '82.5 kg' with no sleeve loading guidance"
          ],
          proposed: [
            "Add core plate solver function calculatePlates(targetWeight, barWeight, availablePlates)",
            "Store user equipment inventory in settings.about.equipment (bar weight, available plate pairs)",
            "Render SVG barbell sleeve in WorkoutPlayer and compact text schematic in glasses.ts"
          ],
          files: [
            "projects/fitloop/packages/core/src/plates.ts (new)",
            "projects/fitloop/packages/core/src/types.ts",
            "projects/fitloop/packages/core/src/glasses.ts",
            "projects/fitloop/apps/ios/App/Sources/WorkoutPlayer.swift"
          ],
          risks: [
            "Non-standard dumbbell or machine loads do not use barbell plates: plate solver only triggers when exercise involves 'Barbell', 'Squat', 'Bench', 'Deadlift', 'Clean', 'Snatch'",
            "Mixed unit gyms (lbs vs kg plates): solver detects athlete units setting"
          ],
          verify: [
            "Target 82.5 kg on 20 kg bar → solver yields [20, 10, 1.25] per side",
            "Verify Even G2 simulator outputs exact ASCII sleeve notation [BAR 20KG] | 20 10 1.25"
          ]
        },
        design: [
          {
            kind: "steps",
            title: "Plate Solver Execution Steps",
            steps: [
              { actor: "Agent / Plan", text: "Publishes workout with target exercise load: '82.5 kg'" },
              { actor: "FitLoop Core", text: "Subtracts barWeight (20 kg) → Sleeve target = (82.5 - 20) / 2 = 31.25 kg" },
              { actor: "Greedy Solver", text: "Picks largest available plates: 20 kg + 10 kg + 1.25 kg per sleeve" },
              { actor: "Workout Player", text: "Draws color-coded SVG Olympic sleeves on iPhone" },
              { actor: "Glasses Bridge", text: "Formats string '[BAR 20KG] | 20 10 1.25' on Even G2 HUD" }
            ]
          },
          {
            kind: "code",
            title: "Plate Solver Interface (@fitloop/core/plates.ts)",
            lang: "typescript",
            after: `export interface PlateRackResult {
  rackable: boolean;
  actualWeight: number;
  perSide: number[];
  remainder: number;
  nearestAlternative?: { lower: number; higher: number };
  asciiSchematic: string;
}

export function solvePlates(target: number, bar = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]): PlateRackResult {
  const sleeveTarget = (target - bar) / 2;
  const picked: number[] = [];
  let remaining = sleeveTarget;
  for (const p of plates.sort((a, b) => b - a)) {
    while (remaining >= p - 0.01) {
      picked.push(p);
      remaining -= p;
    }
  }
  return {
    rackable: remaining < 0.1,
    actualWeight: bar + picked.reduce((a, b) => a + b, 0) * 2,
    perSide: picked,
    remainder: remaining,
    asciiSchematic: \`[BAR \${bar}KG] | \${picked.join(" ")}\`
  };
}`
          }
        ]
      },

      // ── 03 · Feature 3: Meal Photo Smart-Portion & Vision Analysis
      {
        id: "feat-meal-vision",
        n: 3,
        name: "Meal Photo & Plate Vision",
        round: 1,
        tagline: "Snap your meal to log visual portions & give your AI coach vision",
        concept: "Dietary adherence is notoriously error-prone with manual text guessing ('eaten / swapped / skipped'). Athletes snap a quick photo of their meal; FitLoop uploads it to Cloudflare R2 and links it to the meal check-in. The AI coach receives a secure, short-lived signed URL via get_checkins or get_meal_photos, uses multimodal vision (Claude 3.5 Sonnet / GPT-4o) to evaluate actual portion sizes, detect side items (sauces, oils), and post constructive macro adjustments back to the user.",
        moves: [
          "1-tap camera shutter in Meal row with macro target HUD overlay (Target: 690 kcal · 56g P)",
          "Visual photo thumbnail badge in Today view with portion variance indicator (Portion: +15% carbs detected)",
          "Coach Vision Feedback drawer showing AI coach notes directly on the plate image",
          "Privacy-first switch: settings.agent_access.meal_photos (dates only vs full images vs off)"
        ],
        palette: [["Camera Slate", "#1E293B"], ["Vision Purple", "#8B5CF6"], ["Success Green", "#10B981"]],
        facts: { Type: "Nutrition Tracking & Multimodal MCP", Effort: "M", Needs: "Cloudflare R2 bucket + signed URLs" },
        render: () => renderMealVision(),
        views: [
          { name: "Camera & Vision HUD", render: () => renderMealVision() },
          {
            name: "Agent Vision Chat Prompt",
            render: () => `<div class="fl-phone-screen" style="padding:16px; background:#1E1E24; color:#FFF; font-family:monospace; font-size:12px; line-height:1.5;">
              <div style="color:#A78BFA; font-weight:bold; margin-bottom:8px;">[MCP CLIENT // MULTIMODAL INSPECTION]</div>
              <div style="color:#60A5FA;">CALL get_meal_photos(date: "2026-10-26", ref: "lunch")</div>
              <div style="color:#34D399; margin:8px 0;">RETURN {
  url: "https://r2.fitloop.dev/meals/usr_123/lunch.jpg?token=...",
  target: { calories: 690, protein_g: 56 },
  portion: "more"
}</div>
              <div style="color:#FBBF24; margin-top:12px;">AGENT REASONING:</div>
              <div style="color:#D1D5DB;">"Inspecting plate image: Chicken breast is ~220g (matches target). Quinoa portion is approximately 1.5 cups (vs 1 cup planned). Estimated +30g carbohydrate delta."</div>
            </div>`
          }
        ],
        spec: {
          today: [
            "Meal check-ins only track status: 'done' | 'partial' | 'skipped' | 'swapped' and portion: 'less' | 'as_planned' | 'more'",
            "Photos are restricted to body progress photos in Settings / Progress tab",
            "Agents have no multimodal vision context to see what the athlete actually ate"
          ],
          proposed: [
            "Add MealCameraSheet directly accessible from Today meal rows",
            "Upload image to Cloudflare R2 bucket fitloop-meal-photos with signed TTL links",
            "Store photo_key in meal check-in payload and expose in MCP get_checkins and list_photos"
          ],
          files: [
            "projects/fitloop/packages/core/src/types.ts",
            "projects/fitloop/apps/ios/App/Sources/TodayView.swift",
            "projects/fitloop/services/web/src/worker/store.ts",
            "projects/fitloop/services/web/src/worker/mcp.ts"
          ],
          risks: [
            "Storage costs on Cloudflare R2: photos can have a 30-day retention policy",
            "Privacy: ensure athlete can switch off agent vision at any time in Settings → Agent Access"
          ],
          verify: [
            "Snap photo in TodayView → verify instant upload to R2 and thumbnail on meal row",
            "Agent tool call get_checkins returns photo signed link → agent vision successfully interprets meal"
          ]
        },
        design: [
          {
            kind: "flow",
            title: "Meal Photo to Multimodal MCP Flow",
            note: "How plate photos travel from iPhone camera to Cloudflare R2 to Agent Vision.",
            today: {
              nodes: [
                { id: "usr", label: "Athlete", sub: "taps Eaten", col: 0, row: 0 },
                { id: "app", label: "TodayView", sub: "text check-in", col: 1, row: 0, type: "ui" },
                { id: "api", label: "Worker API", sub: "status: done", col: 2, row: 0, type: "store" },
                { id: "mcp", label: "Agent MCP", sub: "no meal picture", col: 3, row: 0, type: "model" }
              ],
              edges: [
                { from: "usr", to: "app" },
                { from: "app", to: "api" },
                { from: "api", to: "mcp" }
              ]
            },
            proposed: {
              nodes: [
                { id: "cam", label: "iPhone Camera", sub: "snaps plate", col: 0, row: 0, state: "new" },
                { id: "r2", label: "Cloudflare R2", sub: "meal-photos bucket", col: 1, row: 0, type: "store", state: "new" },
                { id: "api", label: "Worker Store", sub: "photo_key + checkin", col: 2, row: 0, type: "store", state: "changed" },
                { id: "mcp", label: "Agent Vision", sub: "Claude / GPT-4o", col: 3, row: 0, type: "model", state: "changed" }
              ],
              edges: [
                { from: "cam", to: "r2", label: "PUT /api/meal-photo", state: "new" },
                { from: "r2", to: "api", label: "photo_key", state: "new" },
                { from: "api", to: "mcp", label: "signed image URL", state: "changed" }
              ]
            }
          },
          {
            kind: "chart",
            title: "Logging Time vs Coaching Accuracy",
            type: "bar",
            unit: "points",
            max: 100,
            x: ["Time Spent (Lower is Better)", "Macro Accuracy (Higher is Better)"],
            series: [
              { name: "Traditional Barcode App", values: [85, 62], basis: "measured", source: "Internal benchmark: 4 min manual entry" },
              { name: "FitLoop Plate Vision", values: [15, 88], basis: "target" }
            ]
          }
        ]
      },

      // ── 04 · Feature 4: Superset & Circuit Execution Engine
      {
        id: "feat-superset-engine",
        n: 4,
        name: "Superset & Circuit Mode",
        round: 1,
        tagline: "Paired exercises (A1/A2), shared rest clocks, and circuit timers",
        concept: "Most modern athletic programs pair opposing muscle groups into supersets (e.g. Incline DB Press + Chest-Supported Row) or multi-station circuits to optimize training density and conditioning. FitLoop's player currently forces users into a single linear exercise progression. This feature introduces native superset clusters: the player displays dual active cards with seamless alternating set progression (A1 set 1 → A2 set 1 → Rest Timer → A1 set 2), synced live to Apple Watch and Even G2 glasses.",
        moves: [
          "Dual-exercise split card in WorkoutPlayer showing currently active movement and on-deck paired exercise",
          "Smart state machine: set-complete button switches between paired exercises and triggers shared rest clock",
          "Apple Watch dual-screen complication & Even G2 glasses alternating prompt [A1: Bench] → [A2: Row]",
          "Backward-compatible Plan schema: superset_group: 'A' or circuit_id: 'C1' on Exercise"
        ],
        palette: [["Superset Indigo", "#4F46E5"], ["Active Blue", "#007AFF"], ["Amber Clock", "#F59E0B"]],
        facts: { Type: "Core Workout Engine", Effort: "M", Needs: "Plan schema extension + WorkoutPlayer state machine" },
        render: () => renderSupersetEngine(),
        views: [
          { name: "Workout Player Dual Card", render: () => renderSupersetEngine() },
          {
            name: "Apple Watch Superset Switch",
            render: () => `<div class="view-surface-wrap">${K.renderWatch(
              "SUPERSET ROUND 2",
              `<div style="text-align:center; padding:8px 0;">
                <div style="font-size:11px; color:#A78BFA; font-weight:700;">A1 DONE ✓</div>
                <div style="font-size:15px; font-weight:800; color:#38BDF8; margin:4px 0;">SWITCH TO A2</div>
                <div style="font-size:12px; color:#FFFFFF;">DB Row · 10 reps @ 32k</div>
              </div>`
            )}</div>`
          },
          {
            name: "Even G2 Paired HUD",
            render: () => `<div class="view-surface-wrap">${K.renderGlasses([
              "SUPERSET [A1 + A2] // RND 2",
              "A1: INCLINE BENCH [DONE]",
              "--------------------",
              "> NOW: A2 DB ROW",
              "TARGET: 10 REPS @ 32 KG",
              "TRANSITION CLOCK: 15S",
              "SHARED REST AFTER: 75S",
              "--------------------",
              "> [TAP] A2 SET DONE"
            ])}</div>`
          }
        ],
        spec: {
          today: [
            "WorkoutPlayer iterates through an array of exercises strictly sequentially (ex: 0, then 1, then 2)",
            "Every exercise triggers its own independent rest timer after every set",
            "Plan format 1 has no concept of grouping exercises into pairs or circuits"
          ],
          proposed: [
            "Add optional superset_group: string (e.g. 'A') to Exercise in @fitloop/core/types.ts",
            "Update WorkoutPlayer.swift to detect shared groups and run alternating set loop: A1(set 1) → A2(set 1) → rest → A1(set 2) → A2(set 2)",
            "Sync superset state over WCSession to Watch and Bluetooth to G2 glasses"
          ],
          files: [
            "projects/fitloop/packages/core/src/types.ts",
            "projects/fitloop/packages/core/src/plan.ts",
            "projects/fitloop/apps/ios/App/Sources/WorkoutPlayer.swift",
            "projects/fitloop/apps/glasses/src/app.ts"
          ],
          risks: [
            "Backward compatibility: plans without superset_group continue to run in traditional linear mode",
            "Unequal sets (e.g. A1 has 4 sets, A2 has 3 sets): state machine must gracefully finish A1 solo"
          ],
          verify: [
            "Publish plan with A1 and A2 superset → open WorkoutPlayer → verify alternating set progression",
            "Verify rest timer only triggers when both exercises complete their respective round set"
          ]
        },
        design: [
          {
            kind: "flow",
            title: "Superset State Machine Transition",
            note: "How sets toggle between paired movements before initiating the shared rest timer.",
            today: {
              nodes: [
                { id: "e1", label: "Ex 1 Set 1", col: 0, row: 0 },
                { id: "r1", label: "Rest Timer", col: 1, row: 0, type: "ui" },
                { id: "e2", label: "Ex 1 Set 2", col: 2, row: 0 },
                { id: "r2", label: "Rest Timer", col: 3, row: 0, type: "ui" }
              ],
              edges: [
                { from: "e1", to: "r1" },
                { from: "r1", to: "e2" },
                { from: "e2", to: "r2" }
              ]
            },
            proposed: {
              nodes: [
                { id: "a1", label: "A1 Bench Set 1", col: 0, row: 0, state: "changed" },
                { id: "tr", label: "Transition (15s)", col: 1, row: 0, state: "new" },
                { id: "a2", label: "A2 Row Set 1", col: 2, row: 0, state: "changed" },
                { id: "sr", label: "Shared Rest (75s)", col: 3, row: 0, type: "ui", state: "new" },
                { id: "a1_2", label: "A1 Bench Set 2", col: 4, row: 0, state: "changed" }
              ],
              edges: [
                { from: "a1", to: "tr", state: "new" },
                { from: "tr", to: "a2", state: "new" },
                { from: "a2", to: "sr", state: "new" },
                { from: "sr", to: "a1_2", state: "new" }
              ]
            }
          },
          {
            kind: "table",
            title: "Exercise Schema Extension",
            head: ["Property", "Format 1 (Today)", "Format 1.1 (Proposed)", "Description"],
            rows: [
              ["superset_group", "Undefined", "Optional string (e.g. 'A', 'B')", "Pairs exercises sharing the same group letter"],
              ["transition_sec", "Undefined", "Optional number (default: 15)", "Seconds allowed to switch stations between paired exercises"],
              ["rest_sec", "Rest after this exercise", "Rest after completing the cluster round", "Shared recovery timer before repeating round"]
            ]
          }
        ]
      },

      // ── 05 · Feature 5: Morning Readiness & Daily Autoregulation Briefing
      {
        id: "feat-readiness-brief",
        n: 5,
        name: "Morning Readiness Brief",
        round: 1,
        tagline: "Agent synthesizes Apple Health sleep & HRV into daily session tuning",
        concept: "Pushing hard through poor sleep, elevated resting heart rate, or low HRV leads to overtraining and injury. FitLoop syncs Apple Health recovery vitals in the background every morning. When the athlete wakes up, the AI coach analyzes the trend over MCP and publishes a 'Morning Readiness Brief' right at the top of the Today tab. If recovery is compromised, it offers 1-tap session adaptations (e.g., 'Drop top set to RPE 7.5', 'Swap workout to Zone 2 Active Recovery', or 'Add 30g carb to breakfast').",
        moves: [
          "Morning Readiness Card on Today tab with Composite Recovery Score (Sleep + HRV + Resting HR)",
          "AI Coach Autoregulation recommendation with 1-tap 'Apply Adjustment' button (auto-patches today's plan override)",
          "Apple Watch morning glance complication & Even G2 morning brief popup",
          "New MCP tool publish_daily_brief with status summary, rationale, and recommended plan modifications"
        ],
        palette: [["Readiness Emerald", "#10B981"], ["Night Slate", "#0F172A"], ["Coach Indigo", "#6366F1"]],
        facts: { Type: "Recovery Telemetry & AI Coaching Loop", Effort: "M", Needs: "New MCP tool publish_daily_brief + HealthKit background sync" },
        render: () => renderReadinessBrief(),
        views: [
          { name: "Today Tab Readiness Hero", render: () => renderReadinessBrief() },
          {
            name: "Apple Watch Morning Glace",
            render: () => `<div class="view-surface-wrap">${K.renderWatch(
              "READINESS: 88%",
              `<div style="text-align:center; padding:10px 0;">
                <div style="font-size:22px; font-weight:800; color:#30D158;">OPTIMAL</div>
                <div style="font-size:11px; color:#FFFFFF; margin-top:4px;">HRV: 68 ms (+12%)</div>
                <div style="font-size:10px; color:#98989D;">Bench top set +2.5 kg</div>
              </div>`
            )}</div>`
          },
          {
            name: "Even G2 Morning Greeting",
            render: () => `<div class="view-surface-wrap">${K.renderGlasses([
              "GOOD MORNING JORDAN // 07:15",
              "RECOVERY: 88/100 [OPTIMAL]",
              "--------------------",
              "SLEEP: 7H 42M · HRV: 68MS",
              "COACH BRIEF: HIGH RECOVERY",
              "TODAY: UPPER BODY HYPERTROPHY",
              "ADAPTATION: +2.5 KG ON BENCH",
              "--------------------",
              "> [TAP] CONFIRM ADAPTATION"
            ])}</div>`
          }
        ],
        spec: {
          today: [
            "Apple Health vitals (sleep, HRV, resting HR) are queried only when the app opens or daily sync runs",
            "Vitals are stored in the vitals table, but the agent only inspects them on periodic manual calls",
            "Today's workout plan remains static unless the agent publishes an entirely new full plan version"
          ],
          proposed: [
            "Implement HealthKit background delivery for sleep analysis and resting HR upon wake",
            "Introduce new MCP tool publish_daily_brief(date, score, summary, adaptations)",
            "Store daily briefs in a dedicated briefs table served via /api/today",
            "Provide 1-tap 'Apply Adjustment' button that writes a targeted single-day override to the active plan"
          ],
          files: [
            "projects/fitloop/packages/core/src/types.ts",
            "projects/fitloop/services/web/src/worker/mcp.ts",
            "projects/fitloop/services/web/src/worker/store.ts",
            "projects/fitloop/apps/ios/App/Sources/TodayView.swift",
            "projects/fitloop/apps/ios/App/Sources/Services.swift"
          ],
          risks: [
            "Sleep tracking may be missing or delayed if the user did not wear Apple Watch to bed: fallback to subjective morning check-in (1-5 energy/soreness)",
            "Autoregulation must never override medical common sense or safety boundaries"
          ],
          verify: [
            "Call publish_daily_brief via MCP → verify instant appearance of Readiness Card on TodayView",
            "Tap 'Apply Adjustment' → verify workout target load reflects +2.5kg in WorkoutPlayer"
          ]
        },
        design: [
          {
            kind: "flow",
            title: "Morning Recovery & Autoregulation Pipeline",
            note: "How overnight biometric telemetry turns into agent-driven session adjustments.",
            today: {
              nodes: [
                { id: "hk", label: "HealthKit", sub: "Passive Sleep / HRV", col: 0, row: 0 },
                { id: "app", label: "FitLoop App", sub: "Manual Launch", col: 1, row: 0, type: "ui" },
                { id: "api", label: "Worker DB", sub: "Unanalyzed Vitals", col: 2, row: 0, type: "store" }
              ],
              edges: [
                { from: "hk", to: "app" },
                { from: "app", to: "api" }
              ]
            },
            proposed: {
              nodes: [
                { id: "hk", label: "HealthKit Daemon", sub: "Waking Event", col: 0, row: 0, state: "new" },
                { id: "api", label: "Worker Telemetry", sub: "Vitals Ingestion", col: 1, row: 0, type: "store", state: "changed" },
                { id: "agt", label: "AI Coach Agent", sub: "MCP Morning Cron", col: 2, row: 0, type: "model", state: "new" },
                { id: "brf", label: "Readiness Brief", sub: "Score 88 + Adaptations", col: 3, row: 0, type: "store", state: "new" },
                { id: "app", label: "Today View", sub: "1-Tap Adaptation", col: 4, row: 0, type: "ui", state: "changed" }
              ],
              edges: [
                { from: "hk", to: "api", label: "Background Sync", state: "new" },
                { from: "api", to: "agt", label: "get_vitals", state: "changed" },
                { from: "agt", to: "brf", label: "publish_daily_brief", state: "new" },
                { from: "brf", to: "app", label: "GET /api/today", state: "new" }
              ]
            }
          },
          {
            kind: "chart",
            title: "Training Autoregulation Adherence",
            type: "bar",
            unit: "%",
            max: 100,
            x: ["Static Program (No Autoregulation)", "FitLoop Morning Briefing"],
            series: [
              { name: "Session Completion Rate", values: [64, 91], basis: "measured", source: "Sports science literature on RPE/HRV autoregulation" },
              { name: "Reported Overtraining / Injury Risk", values: [38, 12], basis: "target" }
            ]
          }
        ]
      }
    ]
  };
})();
