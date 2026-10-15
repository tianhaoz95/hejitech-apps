/**
 * Voxbrief Watch Redesign Interactive Controller
 */

const App = {
  activeCandidateId: 1,
  activeState: 'idle', // 'idle' | 'recording' | 'secondary' | 'complications'
  viewMode: 'quad_row', // 'quad_row' (all 4 in a row) | 'quad_grid' (2x2 grid) | 'single'
  activeDevice: 'ultra', // 'ultra' (squircle) | 'series10' (squircle) | 'pixel' (circle) | 'galaxy' (circle)
  activeParadigm: 'all',
  searchQuery: '',
  compareMode: false,
  compareId: 5,
  ratings: {}, // candidateId: stars (1-5)
  shortlist: new Set(), // Set of candidate IDs
  recordTimerInterval: null,
  recordSeconds: 0,
  audioCtx: null,

  init() {
    this.loadPersistedData();
    this.renderCandidateNav();
    this.updateMainView();
    this.bindEvents();
  },

  loadPersistedData() {
    try {
      const savedRatings = localStorage.getItem('voxbrief_watch_ratings');
      if (savedRatings) this.ratings = JSON.parse(savedRatings);
      const savedShortlist = localStorage.getItem('voxbrief_watch_shortlist');
      if (savedShortlist) this.shortlist = new Set(JSON.parse(savedShortlist));
    } catch (e) {
      console.warn('Could not load localStorage', e);
    }
  },

  savePersistedData() {
    try {
      localStorage.setItem('voxbrief_watch_ratings', JSON.stringify(this.ratings));
      localStorage.setItem('voxbrief_watch_shortlist', JSON.stringify(Array.from(this.shortlist)));
    } catch (e) {
      console.warn('Could not save localStorage', e);
    }
  },

  getCandidate(id) {
    return CANDIDATES.find(c => c.id === id) || CANDIDATES[0];
  },

  getFormFactor(device = this.activeDevice) {
    return (device === 'pixel' || device === 'galaxy') ? 'circle' : 'squircle';
  },

  screen1State: 'idle', // 'idle' | 'recording' | 'secondary' | 'settings'
  col3State: 'secondary', // 'secondary' | 'settings'

  setCol3State(state) {
    this.col3State = state;
    this.updateScreens();
  },

  selectCandidate(id) {
    this.activeCandidateId = id;
    this.screen1State = 'idle';
    this.activeState = 'idle';
    this.stopTimer();
    this.renderCandidateNav();
    this.updateMainView();
  },

  setState(state) {
    if (this.viewMode === 'single') {
      if (this.activeState === 'recording' && state !== 'recording') {
        this.stopTimer();
      }
      this.activeState = state;
    } else {
      // In quad mode, update the interactive Screen 1 state!
      this.screen1State = state;
      if (state === 'settings') {
        // Also update column 3 so the user sees the Settings screen clearly
        this.col3State = 'settings';
      }
      if (state !== 'recording') {
        this.stopTimer();
      }
    }
    this.updateControls();
    this.updateScreens();
  },

  triggerSync(event) {
    if (event) event.stopPropagation();
    const btn = event ? event.currentTarget : null;
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = `<span style="display:inline-block; animation: spin 0.6s linear infinite;">🔄</span> Syncing...`;
      btn.style.opacity = '0.7';
      setTimeout(() => {
        btn.innerHTML = `✓ Synced with iPhone!`;
        btn.style.background = '#34C759';
        btn.style.borderColor = '#34C759';
        btn.style.color = '#fff';
        btn.style.opacity = '1';
        setTimeout(() => {
          btn.innerHTML = origHtml;
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.style.color = '';
        }, 1800);
      }, 700);
    } else {
      alert('✓ WCSession: All 4 voice memos successfully synced to iPhone.');
    }
  },

  triggerPurge(event) {
    if (event) event.stopPropagation();
    const btn = event ? event.currentTarget : null;
    if (btn) {
      btn.innerHTML = `✓ Purged! (0 MB)`;
      btn.style.background = 'rgba(52, 199, 89, 0.2)';
      btn.style.color = '#34C759';
      setTimeout(() => {
        btn.innerHTML = `<span class="btn-icon">🗑️</span> <span class="btn-text">Purge Synced Audio</span>`;
        btn.style.background = '';
        btn.style.color = '';
      }, 1800);
    }
  },

  setViewMode(mode) {
    this.viewMode = mode;
    this.updateControls();
    this.updateScreens();
  },

  setDevice(device) {
    this.activeDevice = device;
    this.updateControls();
    this.updateScreens();
  },

  setParadigm(paradigm) {
    this.activeParadigm = paradigm;
    this.renderCandidateNav();
    this.updateControls();
  },

  toggleShortlist(id, e) {
    if (e) e.stopPropagation();
    if (this.shortlist.has(id)) {
      this.shortlist.delete(id);
    } else {
      this.shortlist.add(id);
    }
    this.savePersistedData();
    this.renderCandidateNav();
    this.updateCandidateHeader();
  },

  setRating(id, stars, e) {
    if (e) e.stopPropagation();
    this.ratings[id] = stars;
    this.savePersistedData();
    this.renderCandidateNav();
    this.updateCandidateHeader();
  },

  toggleCompareMode() {
    this.compareMode = !this.compareMode;
    document.getElementById('compareToggleBtn').classList.toggle('active', this.compareMode);
    this.updateScreens();
  },

  setCompareId(id) {
    this.compareId = parseInt(id, 10);
    this.updateScreens();
  },

  triggerRecord() {
    this.playHapticSound(880, 0.08); // pleasant start beep
    this.screen1State = 'recording';
    this.activeState = 'recording';
    this.recordSeconds = 0;
    this.updateControls();
    this.updateScreens();
    this.startTimer();
  },

  triggerStop() {
    this.playHapticSound(440, 0.12); // pleasant stop beep
    this.stopTimer();
    this.screen1State = 'idle';
    this.activeState = 'idle';
    this.updateControls();
    this.updateScreens();
  },

  startTimer() {
    this.stopTimer();
    this.recordTimerInterval = setInterval(() => {
      this.recordSeconds++;
      const mins = String(Math.floor(this.recordSeconds / 60)).padStart(2, '0');
      const secs = String(this.recordSeconds % 60).padStart(2, '0');
      const timeStr = `${mins}:${secs}`;
      document.querySelectorAll('#liveTimer').forEach(elem => {
        elem.textContent = timeStr;
      });
    }, 1000);
  },

  stopTimer() {
    if (this.recordTimerInterval) {
      clearInterval(this.recordTimerInterval);
      this.recordTimerInterval = null;
    }
    this.recordSeconds = 0;
  },

  playHapticSound(freq, duration) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
      
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio policy
    }
  },

  renderCandidateNav() {
    const listElem = document.getElementById('candidateNavList');
    if (!listElem) return;

    const filtered = CANDIDATES.filter(c => {
      let matchParadigm = false;
      if (this.activeParadigm === 'all') {
        matchParadigm = true;
      } else if (this.activeParadigm === 'shortlist') {
        matchParadigm = this.shortlist.has(c.id);
      } else if (this.activeParadigm === 'ios_lineage') {
        matchParadigm = (c.iosContinuity && (c.iosContinuity.includes('Baseline') || c.iosContinuity.includes('High')));
      } else {
        matchParadigm = c.paradigm === this.activeParadigm;
      }
      const matchSearch = !this.searchQuery || 
        c.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || 
        c.tagline.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchParadigm && matchSearch;
    });

    listElem.innerHTML = filtered.map(c => {
      const isSelected = c.id === this.activeCandidateId;
      const isShortlisted = this.shortlist.has(c.id);
      const rating = this.ratings[c.id] || 0;
      const starsHtml = [1, 2, 3, 4, 5].map(star => 
        `<span class="nav-star ${star <= rating ? 'filled' : ''}">★</span>`
      ).join('');

      let tierBadge = '';
      if (c.iosContinuity) {
        if (c.iosContinuity.includes('Baseline')) {
          tierBadge = `<span class="ios-continuity-badge baseline" style="font-size: 8px; padding: 1px 5px; margin: 0;">iOS Baseline</span>`;
        } else if (c.iosContinuity.includes('High')) {
          tierBadge = `<span class="ios-continuity-badge progressive" style="font-size: 8px; padding: 1px 5px; margin: 0;">iOS Progressive</span>`;
        }
      }

      return `
        <div class="nav-item ${isSelected ? 'active' : ''}" onclick="App.selectCandidate(${c.id})">
          <div class="nav-item-top">
            <span class="nav-id">#${String(c.id).padStart(2, '0')}</span>
            <span class="nav-name">${c.name}</span>
            <button class="nav-shortlist-btn ${isShortlisted ? 'active' : ''}" onclick="App.toggleShortlist(${c.id}, event)" title="Shortlist">
              ${isShortlisted ? '★' : '☆'}
            </button>
          </div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <div class="nav-paradigm-badge" style="border-left: 2px solid ${c.accentColor};">${c.paradigm}</div>
            ${tierBadge}
          </div>
          <div class="nav-tagline">${c.tagline}</div>
          <div class="nav-footer">
            <div class="nav-stars">${starsHtml}</div>
            <span class="nav-color-pip" style="background: ${c.accentColor};"></span>
          </div>
        </div>
      `;
    }).join('');

    document.getElementById('navCount').textContent = `${filtered.length} candidates`;
  },

  updateMainView() {
    this.updateCandidateHeader();
    this.updateControls();
    this.updateScreens();
    this.updateCandidateDetails();
  },

  updateCandidateHeader() {
    const candidate = this.getCandidate(this.activeCandidateId);
    document.getElementById('heroNumber').textContent = `#${String(candidate.id).padStart(2, '0')}`;
    document.getElementById('heroTitle').textContent = candidate.name;
    document.getElementById('heroTagline').textContent = candidate.tagline;
    document.getElementById('heroParadigm').textContent = candidate.paradigm;
    document.getElementById('heroParadigm').style.borderColor = candidate.accentColor;

    const isShortlisted = this.shortlist.has(candidate.id);
    const starBtn = document.getElementById('heroShortlistBtn');
    if (starBtn) {
      starBtn.classList.toggle('active', isShortlisted);
      starBtn.innerHTML = isShortlisted ? '★ In Shortlist' : '☆ Add to Shortlist';
    }

    const rating = this.ratings[candidate.id] || 0;
    const ratingContainer = document.getElementById('heroRatingStars');
    if (ratingContainer) {
      ratingContainer.innerHTML = [1, 2, 3, 4, 5].map(star => 
        `<button class="rating-star-btn ${star <= rating ? 'filled' : ''}" onclick="App.setRating(${candidate.id}, ${star}, event)">★</button>`
      ).join('');
    }
  },

  updateControls() {
    // Update layout mode buttons
    document.querySelectorAll('.layout-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.layout === this.viewMode);
    });

    // Show/hide single state group
    const singleGroup = document.getElementById('singleStateGroup');
    if (singleGroup) {
      singleGroup.style.display = this.viewMode === 'single' ? 'flex' : 'none';
    }

    // Update state pill buttons
    document.querySelectorAll('.state-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.state === this.activeState);
    });

    // Update device pill buttons
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.device === this.activeDevice);
    });

    // Update paradigm filters
    document.querySelectorAll('.paradigm-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.paradigm === this.activeParadigm);
    });
  },

  updateScreens() {
    const candidate = this.getCandidate(this.activeCandidateId);
    const formFactor = this.getFormFactor(this.activeDevice);
    const container = document.getElementById('devicesStageDisplay');
    if (!container) return;

    if (this.compareMode) {
      const candidate2 = this.getCandidate(this.compareId);
      container.className = `devices-stage-display mode-compare`;
      container.innerHTML = `
        <div class="device-column">
          <div class="device-column-label">
            <span class="col-title">#${String(candidate.id).padStart(2, '0')} ${candidate.name}</span>
            <span class="col-sub">${candidate.paradigm}</span>
          </div>
          <div class="watch-device-bezel bezel-${this.activeDevice} form-${formFactor}">
            <div class="bezel-screen-viewport">
              ${Renderer.renderCandidateScreen(candidate, this.activeState, formFactor)}
            </div>
          </div>
        </div>
        <div class="device-column">
          <div class="device-column-label">
            <span class="col-title">Compare With:</span>
            <select id="compareCandidateSelect" onchange="App.setCompareId(this.value)" style="background: #192033; color: white; border: 1px solid var(--border-bright); border-radius: 6px; padding: 2px 6px; font-size: 11px;">
              ${CANDIDATES.map(c => `<option value="${c.id}" ${c.id === this.compareId ? 'selected' : ''}>#${String(c.id).padStart(2, '0')} ${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="watch-device-bezel bezel-${this.activeDevice} form-${formFactor}">
            <div class="bezel-screen-viewport">
              ${Renderer.renderCandidateScreen(candidate2, this.activeState, formFactor)}
            </div>
          </div>
        </div>
      `;
      return;
    }

    if (this.viewMode === 'single') {
      container.className = `devices-stage-display mode-single`;
      const labels = {
        idle: '1. Idle / Daily Capture (Resting State)',
        recording: '2. Active Recording (Live Waveform & Timer)',
        secondary: '3. Secondary Vault (Archive, Sync & Diagnostics)',
        settings: '4. WatchOS Settings Page (Connectivity, AI, Purge)',
        complications: '5. Watch Face Complications & Tile Suite'
      };
      container.innerHTML = `
        <div class="device-column">
          <div class="device-column-label">
            <span class="col-title">${labels[this.activeState] || this.activeState}</span>
            <span class="col-sub">${this.activeDevice.toUpperCase()} BEZEL</span>
          </div>
          <div class="watch-device-bezel bezel-${this.activeDevice} form-${formFactor}">
            <div class="bezel-screen-viewport">
              ${Renderer.renderCandidateScreen(candidate, this.activeState, formFactor)}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // ALL 4 SCREENS TOGETHER! (mode-quad_row or mode-quad_grid)
    container.className = `devices-stage-display mode-${this.viewMode}`;
    const col1State = this.screen1State || 'idle';
    let col1Label = '1. Idle / Daily';
    let col1Badge = 'Interactive Screen (Tap to Record)';
    if (col1State === 'recording') {
      col1Label = '1. Recording Active';
      col1Badge = 'Tap Stop to Finish';
    } else if (col1State === 'secondary') {
      col1Label = '1. Vault Opened';
      col1Badge = 'Tap ⚙️ for Settings';
    } else if (col1State === 'settings') {
      col1Label = '1. Settings Opened';
      col1Badge = 'Tap ‹ Vault or ✕ to Exit';
    }

    const col3State = this.col3State || 'secondary';
    const isCol3Settings = col3State === 'settings';
    const col3Label = isCol3Settings ? '3. Settings Page ⚙️' : '3. Vault & Sync';
    const col3Badge = isCol3Settings ? 'WatchOS Inset List' : 'Separated Hub';

    const quadStates = [
      { key: col1State, label: col1Label, badge: col1Badge },
      { key: 'recording', label: '2. Recording Spec', badge: 'Active Soundwave' },
      { 
        key: col3State, 
        label: col3Label, 
        badge: col3Badge,
        togglePills: `
          <div class="col-pill-toggle">
            <button class="col-toggle-btn ${!isCol3Settings ? 'active' : ''}" onclick="App.setCol3State('secondary')">Vault (4)</button>
            <button class="col-toggle-btn ${isCol3Settings ? 'active' : ''}" onclick="App.setCol3State('settings')">Settings ⚙️</button>
          </div>
        `
      },
      { key: 'complications', label: '4. Complications', badge: 'Bespoke V-Wave' }
    ];

    container.innerHTML = quadStates.map(s => `
      <div class="device-column quad-col">
        <div class="device-column-label">
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
            <span class="col-title">${s.label}</span>
            ${s.togglePills || ''}
          </div>
          <span class="col-sub">${s.badge}</span>
        </div>
        <div class="watch-device-bezel bezel-${this.activeDevice} form-${formFactor} bezel-quad">
          <div class="bezel-screen-viewport">
            ${Renderer.renderCandidateScreen(candidate, s.key, formFactor)}
          </div>
        </div>
      </div>
    `).join('');
  },

  updateCandidateDetails() {
    const c = this.getCandidate(this.activeCandidateId);
    
    // iOS Continuity & Backport Idea
    const iosBadgeContainer = document.getElementById('detailIosBadgeContainer');
    if (iosBadgeContainer && c.iosContinuity) {
      let badgeClass = 'evolutionary';
      if (c.iosContinuity.includes('Baseline')) badgeClass = 'baseline';
      else if (c.iosContinuity.includes('High')) badgeClass = 'progressive';
      iosBadgeContainer.innerHTML = `<span class="ios-continuity-badge ${badgeClass}">${c.iosContinuity}</span>`;
    }
    const iosMapping = document.getElementById('detailIosMapping');
    if (iosMapping) iosMapping.textContent = c.iosComponentMapping || 'N/A';
    const iosBackport = document.getElementById('detailIosBackport');
    if (iosBackport) iosBackport.textContent = c.iosBackportIdea || 'N/A';

    document.getElementById('detailSecondaryStrat').textContent = c.secondaryStrategy;
    document.getElementById('detailPrimaryScreen').textContent = c.primaryScreenDescription;
    document.getElementById('detailRecordingState').textContent = c.recordingStateDescription;
    document.getElementById('detailSecondaryView').textContent = c.secondaryViewDescription;
    
    document.getElementById('detailCompCircular').textContent = c.complications.circular;
    document.getElementById('detailCompRect').textContent = c.complications.rectangular;
    document.getElementById('detailCompCorner').textContent = c.complications.corner;
    document.getElementById('detailCompInline').textContent = c.complications.inline;
    document.getElementById('detailCompTile').textContent = c.complications.wearOsTile;

    document.getElementById('detailWatchOs').textContent = c.watchOsAdaptation;
    document.getElementById('detailWearOs').textContent = c.wearOsAdaptation;
    document.getElementById('detailBestFor').textContent = c.bestFor;

    const prosList = document.getElementById('detailProsList');
    if (prosList) {
      prosList.innerHTML = c.pros.map(p => `<li><span class="pro-icon">✓</span> ${p}</li>`).join('');
    }

    const consList = document.getElementById('detailConsList');
    if (consList) {
      consList.innerHTML = c.cons.map(cn => `<li><span class="con-icon">!</span> ${cn}</li>`).join('');
    }
  },

  bindEvents() {
    const searchInput = document.getElementById('candidateSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderCandidateNav();
      });
    }

    // Populate compare dropdown
    const compareSelector = document.getElementById('compareCandidateSelect');
    if (compareSelector) {
      compareSelector.innerHTML = CANDIDATES.map(c => 
        `<option value="${c.id}">#${String(c.id).padStart(2, '0')} - ${c.name} (${c.paradigm})</option>`
      ).join('');
      compareSelector.value = this.compareId;
    }

    this.bindSwipeGestures();
  },

  bindSwipeGestures() {
    const container = document.getElementById('devicesStageDisplay');
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let isDragging = false;

    container.addEventListener('mousedown', (e) => {
      const viewport = e.target.closest('.bezel-screen-viewport');
      if (!viewport) return;
      startX = e.clientX;
      startY = e.clientY;
      isDragging = true;
    });

    container.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      const diffX = e.clientX - startX;
      const diffY = e.clientY - startY;

      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          // Swipe Left -> go forward (Capture -> Vault, or Vault -> Settings)
          if (this.viewMode === 'single') {
            if (this.activeState === 'idle') this.setState('secondary');
            else if (this.activeState === 'secondary') this.setState('settings');
          } else {
            if (this.screen1State === 'idle') this.setState('secondary');
            else if (this.screen1State === 'secondary') this.setState('settings');
          }
        } else {
          // Swipe Right -> go back (Settings -> Vault, or Vault -> Capture)
          if (this.viewMode === 'single') {
            if (this.activeState === 'settings') this.setState('secondary');
            else if (this.activeState === 'secondary') this.setState('idle');
          } else {
            if (this.screen1State === 'settings') this.setState('secondary');
            else if (this.screen1State === 'secondary') this.setState('idle');
          }
        }
      }
    });

    // Touch events for touchscreens / trackpad simulation
    container.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      const touch = e.changedTouches[0];
      const diffX = touch.clientX - startX;
      const diffY = touch.clientY - startY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          if (this.viewMode === 'single') {
            if (this.activeState === 'idle') this.setState('secondary');
            else if (this.activeState === 'secondary') this.setState('settings');
          } else {
            if (this.screen1State === 'idle') this.setState('secondary');
            else if (this.screen1State === 'secondary') this.setState('settings');
          }
        } else {
          if (this.viewMode === 'single') {
            if (this.activeState === 'settings') this.setState('secondary');
            else if (this.activeState === 'secondary') this.setState('idle');
          } else {
            if (this.screen1State === 'settings') this.setState('secondary');
            else if (this.screen1State === 'secondary') this.setState('idle');
          }
        }
      }
    }, { passive: true });
  },

  exportReport() {
    const shortlistedCandidates = CANDIDATES.filter(c => this.shortlist.has(c.id));
    const ratedCandidates = CANDIDATES.filter(c => this.ratings[c.id]).sort((a,b) => (this.ratings[b.id] || 0) - (this.ratings[a.id] || 0));

    let report = `# Voxbrief Watch OS & Wear OS UI Redesign Evaluation\n\n`;
    report += `Generated: ${new Date().toLocaleString()}\n\n`;
    report += `## Shortlisted Candidates (${shortlistedCandidates.length})\n`;
    if (shortlistedCandidates.length === 0) {
      report += `_No candidates shortlisted yet._\n\n`;
    } else {
      shortlistedCandidates.forEach(c => {
        report += `### #${c.id} ${c.name} (${c.paradigm})\n`;
        report += `- **Tagline**: ${c.tagline}\n`;
        report += `- **Secondary Separation Strategy**: ${c.secondaryStrategy}\n`;
        report += `- **My Rating**: ${this.ratings[c.id] ? '★'.repeat(this.ratings[c.id]) : 'Unrated'}\n`;
        report += `- **Best For**: ${c.bestFor}\n\n`;
      });
    }

    report += `## All Rated Candidates\n`;
    if (ratedCandidates.length === 0) {
      report += `_No candidates rated yet._\n\n`;
    } else {
      ratedCandidates.forEach(c => {
        report += `- **#${c.id} ${c.name}**: ${'★'.repeat(this.ratings[c.id])} (${c.paradigm}) — ${c.tagline}\n`;
      });
    }

    // Create modal to display & copy
    const modal = document.createElement('div');
    modal.className = 'export-modal-overlay';
    modal.innerHTML = `
      <div class="export-modal-content">
        <div class="export-modal-header">
          <h3>Evaluation & Shortlist Report</h3>
          <button class="modal-close-btn" onclick="this.closest('.export-modal-overlay').remove()">✕</button>
        </div>
        <textarea readonly class="export-textarea">${report}</textarea>
        <div class="export-modal-actions">
          <button class="btn-copy-report" onclick="navigator.clipboard.writeText(this.closest('.export-modal-content').querySelector('textarea').value); this.textContent = 'Copied to Clipboard! ✓';">Copy Markdown</button>
          <button class="btn-download-report" onclick="App.downloadReportFile('${encodeURIComponent(report)}')">Download .md</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },

  downloadReportFile(encodedReport) {
    const text = decodeURIComponent(encodedReport);
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voxbrief-watch-redesign-evaluation.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
