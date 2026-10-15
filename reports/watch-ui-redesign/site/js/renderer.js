/**
 * Voxbrief Watch OS & Wear OS UI Redesign Renderer
 * 20 NEW Focused Candidates: Top Segmented Switcher + Tag-First Quick Triage Fusions
 * 
 * Incorporating User Requirements:
 *  1. Bespoke Voxbrief Brand Complications (Distinct V-Wave Brand Monogram)
 *  2. Default Tag = "✨ Auto" across all candidates
 *  3. Low-frequency controls folded into a dedicated Settings Page
 *  4. 100% Flat Simplicity: Zero 3D bevels, zero specular gloss, zero drop-shadow clutter
 */

const ComplicationIcons = {
  // 1. Classic V-Wave Monogram (Left diagonal + 3 stepped audio bars)
  1: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M6 8 L14 24" fill="none" stroke="#00E5FF" stroke-width="2.5" stroke-linecap="round"/><line x1="16" y1="21" x2="16" y2="24" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="15" x2="20" y2="24" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/><line x1="24" y1="9" x2="24" y2="24" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/></svg>`,

  // 2. Convergent V-Wave (Symmetrical audio bars tapering into a V vertex)
  2: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><line x1="7" y1="9" x2="7" y2="17" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round"/><line x1="11.5" y1="12" x2="11.5" y2="21" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="16" x2="16" y2="25" stroke="#FF9F0A" stroke-width="2.5" stroke-linecap="round"/><line x1="20.5" y1="12" x2="20.5" y2="21" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round"/><line x1="25" y1="9" x2="25" y2="17" stroke="#FF9F0A" stroke-width="2" stroke-linecap="round"/></svg>`,

  // 3. Voxbrief Squircle Badge (Official royal blue squircle with white V-Wave)
  3: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><rect x="4" y="4" width="24" height="24" rx="6" fill="#1E6BF0"/><path d="M9 10 L15 22" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><line x1="17" y1="19" x2="17" y2="22" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><line x1="20" y1="15" x2="20" y2="22" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><line x1="23" y1="11" x2="23" y2="22" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  // 4. V-Wave Chevron Funnel (Sharp vector chevrons converging into audio point)
  4: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M6 10 L16 24 L26 10" fill="none" stroke="#AF52DE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 8 L16 17 L22 8" fill="none" stroke="#AF52DE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="24" r="1.5" fill="#AF52DE"/></svg>`,

  // 5. V-Wave Beacon (Left solid stem + 4 frequency bars)
  5: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M6 8 L13 24" fill="none" stroke="#30D158" stroke-width="2.5" stroke-linecap="round"/><line x1="15" y1="21" x2="15" y2="24" stroke="#30D158" stroke-width="1.8" stroke-linecap="round"/><line x1="18.5" y1="17" x2="18.5" y2="24" stroke="#30D158" stroke-width="1.8" stroke-linecap="round"/><line x1="22" y1="13" x2="22" y2="24" stroke="#30D158" stroke-width="1.8" stroke-linecap="round"/><line x1="25.5" y1="9" x2="25.5" y2="24" stroke="#30D158" stroke-width="1.8" stroke-linecap="round"/></svg>`,

  // 6. V-Wave Rotary Dial (Circular gauge with inset V sound cutouts)
  6: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 2"/><path d="M10 11 L16 22 L22 11" fill="none" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="16" r="2.5" fill="#0A84FF"/></svg>`,

  // 7. V-Wave Checklist (Left V stroke morphing into an audio checkmark)
  7: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M7 14 L13 24 L25 8" fill="none" stroke="#FF375F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="17" y1="18" x2="17" y2="23" stroke="#FF375F" stroke-width="1.5" stroke-linecap="round"/><line x1="21" y1="13" x2="21" y2="21" stroke="#FF375F" stroke-width="1.5" stroke-linecap="round"/></svg>`,

  // 8. V-Wave Split Horizon (Split horizontal bar with inset V mark)
  8: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="16" x2="29" y2="16" stroke="currentColor" stroke-width="1.5"/><path d="M10 9 L16 21 L22 9" fill="none" stroke="#007AFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 9. V-Wave Dynamic Capsule (Capsule pill enclosing the V-Wave monogram)
  9: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><rect x="4" y="10" width="24" height="12" rx="6" fill="#32ADE6"/><path d="M11 13 L15 20 L21 13" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 10. V-Wave Bento Partition (Modular partition enclosing V-Wave icon)
  10: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><rect x="4" y="4" width="14" height="24" rx="3" fill="#34C759"/><rect x="20" y="4" width="8" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="20" y="17" width="8" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M7 11 L11 21 L15 11" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 11. V-Wave Swiss Monogram (Stark 3-column solid typographic V)
  11: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><rect x="5" y="5" width="22" height="22" rx="3" fill="#FF3B30"/><path d="M9 10 L16 22 L23 10" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 12. V-Wave Arc Gauge (270° circular arc encircling center V-Wave)
  12: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.8" opacity="0.25"/><circle cx="16" cy="16" r="13" fill="none" stroke="#00E5FF" stroke-width="2.2" stroke-dasharray="60 25" stroke-linecap="round"/><path d="M11 12 L16 21 L21 12" fill="none" stroke="#00E5FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 13. V-Wave Funnel Filter (Filter funnel geometry echoing V monogram)
  13: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M5 6 L27 6 L18 17 L18 26 L14 24 L14 17 Z" fill="none" stroke="#BF5AF2" stroke-width="1.8"/><path d="M11 9 L16 16 L21 9" fill="none" stroke="#BF5AF2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 14. V-Wave Sync Orbit (Dual sync arrows forming circular V)
  14: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M16 6 C21 6 25 10 25 16 M25 16 L22 13 M25 16 L28 13" fill="none" stroke="#FF9500" stroke-width="1.8" stroke-linecap="round"/><path d="M16 26 C11 26 7 22 7 16 M7 16 L10 19 M7 16 L4 19" fill="none" stroke="#FF9500" stroke-width="1.8" stroke-linecap="round"/><path d="M12 13 L16 20 L20 13" fill="none" stroke="#FF9500" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 15. V-Wave Palette Document (Document fold with embossed V-Wave emblem)
  15: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M7 6 L25 6 C27 6, 28 8, 27 10 L25 24 C24 26, 23 27, 21 27 L11 27 C9 27, 8 26, 7 24 L5 10 C4 8, 5 6, 7 6 Z" fill="none" stroke="#5856D6" stroke-width="1.5"/><path d="M11 12 L16 21 L21 12" fill="none" stroke="#5856D6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 16. V-Wave Chromatic Spectrum (5-bar spectrum forming V silhouette)
  16: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><rect x="6" y="8" width="3" height="12" rx="1.5" fill="#30B0C7"/><rect x="11" y="12" width="3" height="12" rx="1.5" fill="#007AFF"/><rect x="16" y="16" width="3" height="11" rx="1.5" fill="#5E5CE6"/><rect x="21" y="12" width="3" height="12" rx="1.5" fill="#FF9F0A"/><rect x="26" y="8" width="3" height="12" rx="1.5" fill="#FF2D55"/></svg>`,

  // 17. V-Wave AI Neural Spark (4-point sparkle at V vertex)
  17: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M7 9 L16 23 L25 9" fill="none" stroke="#64D2FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 2 L16 7 M16 25 L16 30 M2 16 L7 16 M25 16 L30 16" stroke="#64D2FF" stroke-width="1.5" stroke-linecap="round"/></svg>`,

  // 18. V-Wave Linear Hairline (1px vector crosshair with V monogram)
  18: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="12" fill="none" stroke="#E5E5EA" stroke-width="1.2"/><line x1="16" y1="2" x2="16" y2="30" stroke="#8E8E93" stroke-width="1" stroke-dasharray="2 2"/><line x1="2" y1="16" x2="30" y2="16" stroke="#8E8E93" stroke-width="1" stroke-dasharray="2 2"/><path d="M11 11 L16 21 L21 11" fill="none" stroke="#E5E5EA" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,

  // 19. V-Wave Lightning Trigger (Lightning angle merging into V form)
  19: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="#FF2D55"/><path d="M14 7 L9 18 L16 18 L13 25 L23 13 L17 13 Z" fill="#fff"/></svg>`,

  // 20. V-Wave Viewfinder HUD (4-corner bracket target framing V monogram)
  20: `<svg class="comp-icon-svg" viewBox="0 0 32 32"><path d="M6 10 L6 6 L10 6 M22 6 L26 6 L26 10 M6 22 L6 26 L10 26 M22 26 L26 26 L26 22" fill="none" stroke="#10B981" stroke-width="1.8"/><path d="M11 11 L16 21 L21 11" fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
};

const Renderer = {
  // Render candidate screen inside the interactive watch display
  renderCandidateScreen(candidate, state, formFactor = 'squircle') {
    const isCircle = formFactor === 'circle';
    const containerClass = `watch-screen ${isCircle ? 'screen-circle' : 'screen-squircle'} candidate-${candidate.id} state-${state}`;
    
    let innerHTML = '';
    switch (state) {
      case 'idle':
        innerHTML = this.renderIdleState(candidate, isCircle);
        break;
      case 'recording':
        innerHTML = this.renderRecordingState(candidate, isCircle);
        break;
      case 'secondary':
        innerHTML = this.renderSecondaryState(candidate, isCircle);
        break;
      case 'settings':
        innerHTML = this.renderSettingsState(candidate, isCircle);
        break;
      case 'complications':
        innerHTML = this.renderComplicationsState(candidate, isCircle);
        break;
      default:
        innerHTML = this.renderIdleState(candidate, isCircle);
    }

    return `<div class="${containerClass}" style="--c-accent: ${candidate.accentColor}; --c-grad: ${candidate.accentGradient};">
      ${innerHTML}
    </div>`;
  },

  // ==========================================
  // 1. IDLE / DAILY SCREEN (DEFAULTING TO AUTO)
  // ==========================================
  renderIdleState(candidate, isCircle) {
    const id = candidate.id;

    // Common Mic Button Icon
    const micSvg = `<svg class="mic-svg" viewBox="0 0 24 24"><path fill="#fff" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path fill="#fff" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;

    // 1. Paged Swipe Architecture (Auto-First)
    if (id === 1) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="auto-tag-pill-row">
            <span class="auto-badge active">✨ Auto-Detect</span>
            <span class="auto-override-chip">💡 Idea</span>
            <span class="auto-override-chip">📋 Task</span>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor}; color: #000;">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap to Speak (Auto Intent)</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 2. Tag-First Quick Triage (Paged Swipe)
    if (id === 2) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="tag-row-selector">
            <span class="tag-chip active auto-chip">✨ Auto</span>
            <span class="tag-chip">💡 Idea</span>
            <span class="tag-chip">📋 Task</span>
            <span class="tag-chip">🤝 Meet</span>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Record in [Auto] Mode</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 3. Paged Swipe + Quick Tag Bar (Auto | Idea | Task)
    if (id === 3) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="top-tag-pills-bar">
            <button class="tag-pill-btn active auto-btn">✨ Auto</button>
            <button class="tag-pill-btn">💡 Idea</button>
            <button class="tag-pill-btn">📋 Task</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap to Record</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe Left for Vault & Settings ›</span>
          </div>
        </div>
      `;
    }

    // 4. Dynamic Header Capsule (Swipeable)
    if (id === 4) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <button class="tag-drop-capsule-btn">✨ Auto ▾</button>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap Mic to Record</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe Left for Vault (4) ›</span>
          </div>
        </div>
      `;
    }

    // 5. Paged Sub-Tag Rail (Auto Default)
    if (id === 5) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="sub-tag-rail full-rail">
            <span class="micro-tag active">✨ Auto</span>
            <span class="micro-tag">💡 Idea</span>
            <span class="micro-tag">📋 Task</span>
            <span class="micro-tag">🤝 Meet</span>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap to Record</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 6. Tag-Segmented Crown Switcher (Swipeable)
    if (id === 6) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="crown-page-label">👑 DIAL TAG</div>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
          </div>
          <div class="top-tag-pills-bar">
            <button class="tag-pill-btn active auto-btn">✨ Auto</button>
            <button class="tag-pill-btn">💡 Idea</button>
            <button class="tag-pill-btn">📋 Task</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap to Record</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault (4) ›</span>
          </div>
        </div>
      `;
    }

    // 7. Action-Outcome Format Selector (Swipeable)
    if (id === 7) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="top-tag-pills-bar">
            <button class="tag-pill-btn active auto-btn">✨ Auto</button>
            <button class="tag-pill-btn">📝 Note</button>
            <button class="tag-pill-btn">☑️ Todo</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">AI Auto-Detecting Format</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe Left for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 8. Split Horizon 50/50 (Swipeable)
    if (id === 8) {
      return `
        <div class="view-content split-view">
          <div class="watch-page-nav-bar" style="padding: 0 4px 2px;">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="split-top-tags-grid" style="grid-template-columns: repeat(3, 1fr);">
            <button class="split-tag-tile active">✨ Auto</button>
            <button class="split-tag-tile">💡 Idea</button>
            <button class="split-tag-tile">📋 Task</button>
          </div>
          <div class="split-bottom-half" onclick="App.triggerRecord()" style="background: ${candidate.accentColor};">
            ${micSvg}
            <span class="split-pad-title" style="color: #fff;">TAP ANYWHERE TO RECORD</span>
          </div>
        </div>
      `;
    }

    // 9. Dynamic Capsule Segment (Swipeable)
    if (id === 9) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="dynamic-status-capsule" onclick="App.setState('secondary')">
              <span class="capsule-icon">✨</span>
              <span class="capsule-text">Auto</span>
              <span class="capsule-sep">•</span>
              <span class="capsule-status">Ready</span>
            </div>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero huge-mic" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">1-Tap to Speak</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault (4) ›</span>
          </div>
        </div>
      `;
    }

    // 10. Bento Studio Grid (Swipeable)
    if (id === 10) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="bento-idle-grid">
            <div class="bento-tile bento-hero-tile" onclick="App.triggerRecord()" style="background: rgba(52, 199, 89, 0.15); border-color: ${candidate.accentColor};">
              <div class="bento-mic-svg" style="fill: ${candidate.accentColor};">${micSvg}</div>
              <span class="b-title">Record</span>
              <span class="b-sub">✨ Auto Mode</span>
            </div>
            <div class="bento-col-right">
              <div class="bento-tile bento-mini-tile active" style="border-left: 2px solid ${candidate.accentColor};">
                <span class="b-title">✨ Auto</span>
              </div>
              <div class="bento-tile bento-mini-tile" onclick="App.setState('secondary')">
                <span class="b-title">📁 Vault</span>
              </div>
            </div>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 11. Swiss Typographic Tabs (Swipeable)
    if (id === 11) {
      return `
        <div class="view-content swiss-view">
          <div class="watch-page-nav-bar" style="padding: 0 2px 4px;">
            <div class="swiss-tag-tabs">
              <span class="swiss-tab active">AUTO</span>
              <span class="swiss-tab">IDEA</span>
              <span class="swiss-tab">TASK</span>
            </div>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
          </div>
          <div class="swiss-center-headline" onclick="App.triggerRecord()">
            TAP TO<br>RECORD
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ SWIPE FOR VAULT // 4 MEMOS ›</span>
          </div>
        </div>
      `;
    }

    // 12. Circular Bezel Arc Tags (Swipeable)
    if (id === 12) {
      return `
        <div class="view-content view-idle">
          <div class="circular-bezel-tag-header">
            <span class="arc-tag-chip active">✨ AUTO</span>
            <span class="arc-tag-chip">IDEA</span>
            <span class="arc-tag-chip">TASK</span>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero huge-mic" style="background: ${candidate.accentColor}; color: #000;">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap to Record</span>
          </div>
          <div class="watch-page-dots" style="margin: 0 auto 3px;">
            <span class="page-dot active"></span>
            <span class="page-dot" onclick="App.setState('secondary')"></span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault (4) ›</span>
          </div>
        </div>
      `;
    }

    // 13. Two-Way Ingest Filter (Swipeable)
    if (id === 13) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="top-tag-pills-bar">
            <button class="tag-pill-btn active auto-btn">✨ Auto</button>
            <button class="tag-pill-btn">💡 Idea</button>
            <button class="tag-pill-btn">📋 Task</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Record in [Auto] Mode</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault (Filtered) ›</span>
          </div>
        </div>
      `;
    }

    // 14. Smart Tag Pill with Telemetry (Swipeable)
    if (id === 14) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <button class="tag-drop-capsule-btn">✨ Auto ▾</button>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <span class="status-pill-green" style="font-size: 7.5px;">3 Ready</span>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap to Speak</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault & Sync ›</span>
          </div>
        </div>
      `;
    }

    // 15. Slide-Up Palette with Auto Anchor (Swipeable)
    if (id === 15) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Tap to Record</span>
          </div>
          <div class="drawer-peek-pill" onclick="alert('Tag Palette: ✨ Auto (Active), 💡 Idea, 📋 Task, 🤝 Meeting, ⚡ Quick')">
            <span class="pill-dot" style="background: ${candidate.accentColor};">●</span>
            <span class="pill-txt">Tag: ✨ Auto</span>
            <span class="pill-arrow">▲ Palette</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 16. Chromatic Color Scope (Swipeable)
    if (id === 16) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="top-tag-pills-bar">
            <button class="tag-pill-btn active auto-btn" style="color: #30B0C7;">✨ Auto</button>
            <button class="tag-pill-btn" style="color: #FF9F0A;">📋 Task</button>
            <button class="tag-pill-btn" style="color: #AF52DE;">🤝 Meet</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor}; color: #000;">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Scope: Multi-Color Auto</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 17. AI Pipeline Preset Segment (Swipeable)
    if (id === 17) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
          </div>
          <div class="top-tag-pills-bar">
            <button class="tag-pill-btn active auto-btn">✨ Auto-AI</button>
            <button class="tag-pill-btn">⚡ Fast</button>
            <button class="tag-pill-btn">🧠 Deep</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor}; color: #000;">
              ${micSvg}
            </div>
            <span class="hero-prompt-text">Qwen3 Auto Model Selection</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 18. Linear Hairline Vector Studio (Swipeable)
    if (id === 18) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar" style="border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 3px;">
            <span style="font-size: 8.5px; font-weight: 800; color: #fff;">[ ✨ AUTO ]</span>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <span onclick="App.setState('secondary')" style="cursor: pointer; font-size: 8px; color: var(--text-dim);">[ VAULT › ]</span>
          </div>
          <div class="hairline-ring-target" onclick="App.triggerRecord()">
            <div class="hairline-cross-h"></div>
            <div class="hairline-cross-v"></div>
            <div class="hairline-center-dot" style="background: ${candidate.accentColor};"></div>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ SWIPE FOR VAULT ⚙️ ›</span>
          </div>
        </div>
      `;
    }

    // 19. Instant Trigger Matrix (Swipeable)
    if (id === 19) {
      return `
        <div class="view-content view-idle">
          <div class="watch-page-nav-bar">
            <span class="seg-title-badge">1-TAP AUTO</span>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault ›</button>
          </div>
          <div class="hero-capture-area" onclick="App.triggerRecord()" style="margin: auto 0;">
            <div class="flat-mic-hero huge-mic" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text" style="font-size: 12px; font-weight: 800; color: #fff;">1-TAP AUTO-RECORD</span>
          </div>
          <div class="instant-override-row">
            <span class="override-chip">💡 Idea</span>
            <span class="override-chip">📋 Task</span>
            <span class="override-chip">🤝 Meet</span>
          </div>
          <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
            <span>‹ Swipe for Vault ›</span>
          </div>
        </div>
      `;
    }

    // 20. HUD Corner Tag Matrix (Swipeable)
    if (id === 20) {
      return `
        <div class="view-content hud-view">
          <div class="hud-top-bar">
            <span class="hud-top-title">VOX HUD</span>
            <div class="watch-page-dots">
              <span class="page-dot active"></span>
              <span class="page-dot" onclick="App.setState('secondary')"></span>
            </div>
            <button class="hud-vault-btn" onclick="App.setState('secondary')">VAULT ›</button>
          </div>
          <div class="hud-corner top-left" style="color: var(--text-dim);">💡 IDEA</div>
          <div class="hud-corner top-right" style="color: var(--text-dim);">📋 TASK</div>
          <div class="hud-corner bottom-left" style="color: var(--text-dim);">🤝 MEET</div>
          <div class="hud-corner bottom-right" style="color: var(--text-dim);">📝 NOTE</div>
          <div class="hud-center-zone" onclick="App.triggerRecord()">
            <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
              ${micSvg}
            </div>
            <span class="hero-prompt-text" style="color: #fff; font-weight: 800;">✨ AUTO RECORD</span>
          </div>
        </div>
      `;
    }

    // Fallback
    return `
      <div class="view-content view-idle">
        <div class="watch-page-nav-bar">
          <div class="watch-page-dots">
            <span class="page-dot active"></span>
            <span class="page-dot" onclick="App.setState('secondary')"></span>
          </div>
          <button class="swipe-hint-btn" onclick="App.setState('secondary')">Vault (4) ›</button>
        </div>
        <div class="hero-capture-area" onclick="App.triggerRecord()">
          <div class="flat-mic-hero large-hero" style="background: ${candidate.accentColor};">
            ${micSvg}
          </div>
          <span class="hero-prompt-text">Tap to Record</span>
        </div>
        <div class="swipe-bottom-hint" onclick="App.setState('secondary')">
          <span>‹ Swipe for Vault ›</span>
        </div>
      </div>
    `;
  },

  // ==========================================
  // 2. ACTIVE RECORDING SCREEN
  // ==========================================
  renderRecordingState(candidate, isCircle) {
    return `
      <div class="view-content rec-screen">
        <div class="rec-listening-tag" style="color: ${candidate.accentColor};">
          <span class="p-rec-dot"></span>
          <span>RECORDING [AUTO-DETECT]</span>
        </div>

        <div class="rec-timer-large" id="liveTimer">00:18</div>

        <div class="siri-wave-envelope">
          <span class="siri-bar" style="animation-delay: 0s;"></span>
          <span class="siri-bar" style="animation-delay: -0.2s;"></span>
          <span class="siri-bar" style="animation-delay: -0.4s;"></span>
          <span class="siri-bar" style="animation-delay: -0.6s;"></span>
          <span class="siri-bar" style="animation-delay: -0.8s;"></span>
          <span class="siri-bar" style="animation-delay: -1.0s;"></span>
          <span class="siri-bar" style="animation-delay: -1.2s;"></span>
        </div>

        <button class="flat-full-stop-btn" onclick="App.triggerStop()">
          <span class="stop-white-square"></span>
          <span>STOP & SAVE</span>
        </button>
      </div>
    `;
  },

  // ==========================================
  // 3. SECONDARY STATE (VAULT & FOLDED SETTINGS)
  // ==========================================
  renderSecondaryState(candidate, isCircle) {
    return `
      <div class="view-content view-secondary">
        <div class="vault-paged-top-bar">
          <button class="swipe-back-btn" onclick="App.setState('idle')">‹ Capture</button>
          <div class="watch-page-dots">
            <span class="page-dot" onclick="App.setState('idle')"></span>
            <span class="page-dot active"></span>
          </div>
          <button class="settings-gear-btn" onclick="App.setState('settings')" title="Open Settings">⚙️</button>
        </div>

        <div class="secondary-memos-feed">
          <div class="memo-item-card">
            <div class="memo-card-top">
              <span class="memo-title">UI Redesign Review</span>
              <span class="memo-duration">00:42</span>
            </div>
            <div class="memo-card-bottom">
              <span class="memo-date">Today, 2:15 PM</span>
              <span class="memo-sync-badge synced">✨ Auto • Synced ✓</span>
            </div>
          </div>

          <div class="memo-item-card">
            <div class="memo-card-top">
              <span class="memo-title">Sprint Action Items</span>
              <span class="memo-duration">01:14</span>
            </div>
            <div class="memo-card-bottom">
              <span class="memo-date">Yesterday</span>
              <span class="memo-sync-badge synced">📋 Task • Synced ✓</span>
            </div>
          </div>
        </div>

        <!-- WATCH-FRIENDLY SYNC & SETTINGS FOOTER -->
        <div class="settings-folded-strip">
          <div class="strip-left">
            <span class="strip-status-dot">●</span>
            <span class="strip-status-txt">iPhone Ready</span>
          </div>
          <button class="watch-sync-capsule-btn" onclick="App.triggerSync(event)">
            <span class="sync-icon">🔄</span> Sync
          </button>
        </div>
        <div class="swipe-bottom-hint" onclick="App.setState('idle')">
          <span>‹ Swipe right for Capture ›</span>
        </div>
      </div>
    `;
  },

  // ==========================================
  // 4. SETTINGS PAGE (NATIVE WATCH LIST ARCHITECTURE)
  // ==========================================
  renderSettingsState(candidate, isCircle) {
    return `
      <div class="view-content view-settings">
        <div class="settings-top-bar">
          <button class="back-link-btn" onclick="App.setState('secondary')">‹ Vault</button>
          <span class="sec-title">Settings</span>
          <button class="back-link-btn mini-close" onclick="App.setState('idle')">✕</button>
        </div>

        <div class="settings-scroll-body">
          <!-- GROUP 1: IPHONE CONNECTIVITY & SYNC -->
          <div class="watch-settings-group">
            <div class="group-header">CONNECTIVITY</div>
            <div class="watch-settings-row">
              <span class="row-label">iPhone Status</span>
              <span class="status-pill-green">● Connected</span>
            </div>
            <!-- High-Touch Watch-Friendly Full-Width Sync Button -->
            <button class="watch-full-capsule-btn primary-sync" onclick="App.triggerSync(event)">
              <span class="btn-icon">🔄</span>
              <span class="btn-text">Sync 4 Memos to iPhone</span>
            </button>
          </div>

          <!-- GROUP 2: ON-DEVICE PIPELINE -->
          <div class="watch-settings-group">
            <div class="group-header">STAGE 2 LLM PIPELINE</div>
            <div class="watch-settings-row">
              <span class="row-label">Default Intent</span>
              <span class="row-value-badge" style="color: ${candidate.accentColor};">✨ Auto</span>
            </div>
            <div class="watch-settings-row">
              <span class="row-label">Model Engine</span>
              <span class="row-value-text">Qwen3-0.6B CoreML</span>
            </div>
            <div class="watch-settings-row">
              <span class="row-label">Auto-Format Note</span>
              <div class="watch-switch active" onclick="this.classList.toggle('active')">
                <div class="switch-knob"></div>
              </div>
            </div>
          </div>

          <!-- GROUP 3: STORAGE & CACHE PURGE -->
          <div class="watch-settings-group">
            <div class="group-header">STORAGE & CACHE</div>
            <div class="watch-settings-row">
              <span class="row-label">Audio Cache</span>
              <span class="row-value-text">3.2 MB (4 files)</span>
            </div>
            <button class="watch-full-capsule-btn purge-btn" onclick="App.triggerPurge(event)">
              <span class="btn-icon">🗑️</span>
              <span class="btn-text">Purge Synced Audio</span>
            </button>
          </div>

          <!-- GROUP 4: HAPTICS -->
          <div class="watch-settings-group">
            <div class="group-header">FEEDBACK</div>
            <div class="watch-settings-row">
              <span class="row-label">Recording Haptics</span>
              <div class="watch-switch active" onclick="this.classList.toggle('active')">
                <div class="switch-knob"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================
  // 4. COMPLICATIONS SUITE (BESPOKE VOXBRIEF V-WAVE LOGO)
  // ==========================================
  renderComplicationsState(candidate, isCircle) {
    const id = candidate.id;
    const bespokeLogo = ComplicationIcons[id] || ComplicationIcons[1];

    return `
      <div class="view-content view-complications">
        <div class="face-clock-row">
          <span class="face-date">WED 14</span>
          <span class="face-clock">10:09</span>
        </div>

        <!-- Modular Rectangular Complication with Bespoke Voxbrief Brand Mark -->
        <div class="comp-modular-card" style="border-left-color: ${candidate.accentColor};">
          <div class="comp-mod-icon-wrap" style="color: ${candidate.accentColor};">
            ${bespokeLogo}
          </div>
          <div class="comp-mod-body">
            <div class="comp-mod-head">
              <span class="comp-mod-brand">VOXBRIEF</span>
              <span class="comp-mod-pip">✨ AUTO</span>
            </div>
            <div class="comp-mod-title">${candidate.name.split(' ')[0]} Monogram</div>
            <div class="comp-mod-sub">4 Memos • Synced to iPhone ✓</div>
          </div>
        </div>

        <!-- Circular + Corner Dual Complications Row -->
        <div class="comp-dual-row">
          <div class="comp-dial-box">
            <div class="comp-circle-dial" style="color: ${candidate.accentColor}; border-color: ${candidate.accentColor};">
              ${bespokeLogo}
            </div>
            <span class="comp-mini-tag">V-WAVE CIRCULAR</span>
          </div>

          <div class="comp-dial-box">
            <div class="comp-corner-dial" style="color: ${candidate.accentColor};">
              <div class="corner-glyph-box">${bespokeLogo}</div>
              <span class="corner-text">VOX AUTO</span>
            </div>
            <span class="comp-mini-tag">CORNER</span>
          </div>
        </div>

        <div class="comp-face-footer">
          <span class="face-pill-dot" style="background: ${candidate.accentColor};"></span>
          <span>Bespoke Voxbrief Brand Mark</span>
        </div>
      </div>
    `;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Renderer, ComplicationIcons };
}
