// Shared building blocks for the FitLoop Feature Proposals review.
// Recreates the real FitLoop iOS screens (TodayView, WorkoutPlayer, PlanView)
// from projects/fitloop/apps/ios/App/Sources/ and Even G2 / Watch surfaces.
window.KIT = window.KIT || {};

(() => {
  const P = {
    dumbbell: '<path d="m6.5 6.5 11 11M6 10l-2 2a2 2 0 1 1-2.83-2.83l2-2a2 2 0 0 1 2.83 0ZM14 18l2-2a2 2 0 0 1 2.83 0l2 2a2 2 0 1 1-2.83 2.83l-2-2M9 5l2-2a2 2 0 1 1 2.83 2.83l-2 2M15 11l-2 2"/>',
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" fill="currentColor"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.63-1.04-2.5-2.5-4-1.46 1.5-2.5 2.37-2.5 4z"/><path d="M12 2c1 3 4 5 4 9a6 6 0 1 1-12 0c0-4 3-6 4-9 1 2 3 3 4 0z"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" fill="currentColor"/><path d="m5 17 1 2.5L8.5 20.5 6 21.5 5 24l-1-2.5L1.5 20.5 4 19.5z" fill="currentColor"/>',
    bubble: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    scale: '<circle cx="12" cy="5" r="2"/><path d="M6 9h12l2 11H4z"/>',
    apple: '<path d="M12 20.94c1.5 0 2.75-1.06 4-1.06 1.23 0 2.38 1.06 3.97 1.06 2.4 0 4.03-2.6 4.03-5.26 0-2.85-1.93-4.38-3.82-4.38-1.57 0-2.78 1.05-3.89 1.05s-2.5-1.05-4.14-1.05c-2.3 0-4.15 1.83-4.15 4.38 0 2.66 1.6 5.26 4 5.26z"/><path d="M12 4.5c.3-1.6 1.6-3 3-3.5-.2 1.6-1.5 3-3 3.5z"/>',
    forward: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
    swap: '<path d="m16 3 4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/>',
    ellipsis: '<circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/>',
    watch: '<rect x="6" y="5" width="12" height="14" rx="3"/><path d="M9 2h6M9 22h6M18 10h1v4h-1"/>',
    glasses: '<circle cx="6.5" cy="14" r="3.5"/><circle cx="17.5" cy="14" r="3.5"/><path d="M10 14h4M3 13 4.5 7M21 13 19.5 7"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    tune: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  };

  const I = (KIT.icon = (name, size = 18, sw = 2) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`);

  // Shared sample athlete data
  KIT.athlete = {
    name: "Jordan Vance",
    goal: "Hypertrophy & Zone 2 Base",
    planVersion: 3,
    planDate: "2026-10-26",
    changeNote: "Increased bench load to 82.5 kg following RPE 7 last week",
    todayTitle: "Upper Body Hypertrophy & Core",
    todayDuration: 52,
    todayKind: "strength",
    workoutsDone: 3,
    workoutsPlanned: 4,
    mealsDone: 2,
    mealsPlanned: 4,
    streak: 6,
    liveHr: 142,
    restSeconds: 78,
  };

  KIT.sampleExercises = [
    {
      id: "incline-bench",
      name: "Barbell Incline Bench",
      sets: 3,
      reps: 8,
      load: "82.5 kg",
      rest_sec: 90,
      cues: ["Retract scapulae firmly", "Tuck elbows 45°", "Drive feet into floor"],
      instructions: "Set bench to 30 degrees. Lower bar with 2s eccentric to upper chest, pause slightly, drive up with intent.",
      alternative: "Dumbbell Incline Press (32 kg each)",
    },
    {
      id: "chest-supported-row",
      name: "Chest-Supported DB Row",
      sets: 3,
      reps: 10,
      load: "32 kg",
      rest_sec: 75,
      cues: ["Lead with elbows", "Pause 1s at top contraction"],
      instructions: "Lean into incline bench, row dumbbells toward hips without arching neck.",
      alternative: "Seated Cable Row",
    },
    {
      id: "cable-lateral-raise",
      name: "Cable Lateral Raise",
      sets: 3,
      reps: 12,
      load: "12 kg",
      rest_sec: 60,
      cues: ["Keep wrist neutral", "Slight forward lean"],
    },
  ];

  KIT.sampleMeals = [
    {
      id: "breakfast",
      name: "Protein Oatmeal Bowl",
      time: "08:15",
      status: "done",
      portion: "as_planned",
      items: "Rolled oats 80g, Whey isolate 30g, Blueberries 60g, Almond butter 15g",
      macros: { cal: 580, p: 42, c: 68, f: 16 },
    },
    {
      id: "lunch",
      name: "Grilled Chicken & Quinoa",
      time: "12:30",
      status: "done",
      portion: "more",
      items: "Chicken breast 220g, Tri-color quinoa 160g, Avocado 60g, Steamed broccoli",
      macros: { cal: 690, p: 56, c: 54, f: 22 },
    },
    {
      id: "post-workout",
      name: "Post-Workout Whey & Rice Cake",
      time: "17:15",
      status: "pending",
      portion: null,
      items: "Whey isolate 35g, Rice cakes 3 pcs (28g), Banana 1 medium",
      macros: { cal: 340, p: 32, c: 48, f: 3 },
    },
    {
      id: "dinner",
      name: "Wild Salmon & Sweet Potato",
      time: "19:45",
      status: "pending",
      portion: null,
      items: "Atlantic salmon 220g, Baked sweet potato 250g, Asparagus 120g, Olive oil 10ml",
      macros: { cal: 740, p: 52, c: 62, f: 28 },
    },
  ];

  // Phone Shell
  KIT.phone = (body, opts = {}) => {
    const time = opts.time || "10:24";
    const title = opts.title || "Today";
    const isPlayer = opts.player || false;
    const tab = opts.tab || "today";

    const navBar = isPlayer
      ? `<div class="pnav-player">
           <button class="nav-btn close-btn">Close</button>
           <span class="pnav-title">${title}</span>
           <button class="nav-btn more-btn">${I("ellipsis", 18)}</button>
         </div>`
      : `<div class="pnav-today">
           <div class="pnav-left">
             <button class="date-arrow">${I("chevron", 14)}</button>
             <span class="today-label">${title}</span>
             <button class="date-arrow right">${I("chevron", 14)}</button>
           </div>
           <div class="pnav-right">
             <span class="plan-pill"><i class="dot"></i>v3</span>
           </div>
         </div>`;

    const bottomTabs = isPlayer
      ? ""
      : `<div class="fl-tabbar">
           <div class="tab-item ${tab === "today" ? "on" : ""}">${I("dumbbell", 20)}<span>Today</span></div>
           <div class="tab-item ${tab === "plan" ? "on" : ""}">${I("sparkles", 20)}<span>Plan</span></div>
           <div class="tab-item ${tab === "progress" ? "on" : ""}">${I("scale", 20)}<span>Progress</span></div>
           <div class="tab-item ${tab === "notes" ? "on" : ""}">${I("bubble", 20)}<span>Notes</span></div>
           <div class="tab-item ${tab === "settings" ? "on" : ""}">${I("tune", 20)}<span>Settings</span></div>
         </div>`;

    return `
      <div class="fl-phone-screen">
        <div class="fl-sb">
          <b>${time}</b>
          <div class="fl-sb-icons">
            <span>5G</span>
            <span>98%</span>
            <div class="fl-battery"></div>
          </div>
        </div>
        ${navBar}
        <div class="fl-scroll-body">
          ${body}
        </div>
        ${bottomTabs}
        <div class="fl-home-bar"></div>
      </div>
    `;
  };

  // Apple Watch Render helper
  KIT.renderWatch = (title, content, hr = 142) => `
    <div class="watch-chassis">
      <div class="watch-crown"></div>
      <div class="watch-screen">
        <div class="w-sb">
          <span class="w-time">10:24</span>
          <span class="w-hr">${I("heart", 12)} ${hr}</span>
        </div>
        <div class="w-body">
          <div class="w-title">${title}</div>
          ${content}
        </div>
      </div>
    </div>
  `;

  // Even G2 Glasses HUD render helper (9 monochrome green pixel lines with frame)
  KIT.renderGlasses = (lines = []) => {
    const formatted = lines.slice(0, 9).map((l, i) => `<div class="hud-line l${i}">${l}</div>`).join("");
    return `
      <div class="glasses-chassis">
        <div class="hud-frame">
          <div class="hud-corner tl"></div>
          <div class="hud-corner tr"></div>
          <div class="hud-header">FITLOOP // G2 HUD</div>
          <div class="hud-content">
            ${formatted}
          </div>
          <div class="hud-footer">
            <span>[HOLD] MENU</span>
            <span>[DBL-TAP] TODAY</span>
          </div>
          <div class="hud-corner bl"></div>
          <div class="hud-corner br"></div>
        </div>
      </div>
    `;
  };
})();
