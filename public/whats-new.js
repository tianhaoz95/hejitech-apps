// ── What's new ──────────────────────────────────────────────────────────────
// A sheet that walks through what changed since the version the user last saw.
// Content lives in whats-new.json (newest release first); each highlight can
// carry an animated `visual` and a `try` action that jumps straight to the
// feature. Features are the main stage; a release's `fixes` (bug fixes and
// small improvements, plain strings) sit on a secondary page behind a footer
// button, so people can check whether their bug is fixed without the fixes
// crowding out the features. A fixes-only release has no `highlights`. The last-seen version is the `whatsNewSeen` setting, so seeing the
// sheet on one device marks it seen everywhere.
//
// Shown automatically once per upgrade, only to the active session (an
// inactive client sits behind the overlay). With no `whatsNewSeen` yet
// (upgrading from a version before this sheet existed) only the newest
// release's notes are shown. An upgrade that brings only fixes doesn't pop the
// sheet — a clickable toast offers it instead. A fresh install starts with it set (server.js). Reopen any time from the palette or Settings → About.

let _whatsNewData = null;

function whatsNewCompare(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

async function loadWhatsNew() {
  if (_whatsNewData) return _whatsNewData;
  const res = await fetch('whats-new.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`whats-new.json: ${res.status}`);
  _whatsNewData = await res.json();
  return _whatsNewData;
}

function whatsNewCurrentVersion() {
  return window.MEOWTRIX_VERSION || '';
}

// Called once the workspace is ready and this client is the active session.
let _whatsNewChecked = false;
async function maybeShowWhatsNew() {
  if (_whatsNewChecked || window.DEMO_MODE) return;
  const current = whatsNewCurrentVersion();
  const settings = typeof getSettings === 'function' ? getSettings() : {};
  if (!current || !settings || !('whatsNewSeen' in settings)) return; // settings not loaded yet
  _whatsNewChecked = true;
  const seen = settings.whatsNewSeen || '';
  if (seen && whatsNewCompare(seen, current) >= 0) return;
  let data;
  try { data = await loadWhatsNew(); } catch { return; }
  // Releases are newest first. Without a seen version, show the newest feature
  // release up to the running one, plus any fixes-only releases after it.
  const released = data.releases.filter(r => whatsNewCompare(r.version, current) <= 0);
  let unseen;
  if (seen) unseen = released.filter(r => whatsNewCompare(r.version, seen) > 0);
  else {
    const lastFeature = released.findIndex(whatsNewHasFeatures);
    unseen = released.slice(0, lastFeature < 0 ? 1 : lastFeature + 1);
  }
  if (!unseen.length) { markWhatsNewSeen(); return; }
  if (!unseen.some(whatsNewHasFeatures)) {
    // Only fixes: don't interrupt, but say so in case one was theirs.
    const n = unseen.reduce((sum, r) => sum + (r.fixes || []).length, 0);
    markWhatsNewSeen();
    if (n && typeof showToast === 'function') {
      showToast(`Updated to Meowtrix ${current} · ${n} fix${n === 1 ? '' : 'es'} — click to see`, () => openWhatsNew({ releases: unseen }));
    }
    return;
  }
  openWhatsNew({ releases: unseen });
}

function whatsNewHasFeatures(r) {
  return !!(r.highlights && r.highlights.length);
}

function markWhatsNewSeen() {
  const current = whatsNewCurrentVersion();
  if (current && typeof saveSetting === 'function') saveSetting('whatsNewSeen', current);
}

// opts.releases: the releases to show (defaults to all, newest first).
// opts.fixes: open on the first release's fixes page.
async function openWhatsNew(opts = {}) {
  let releases = opts.releases;
  if (!releases) {
    try { releases = (await loadWhatsNew()).releases; } catch {
      if (typeof showToast === 'function') showToast("Couldn't load the release notes");
      return;
    }
  }
  if (!releases.length) return;
  closeWhatsNew();

  const overlay = document.createElement('div');
  overlay.id = 'whats-new-overlay';
  overlay.innerHTML = `
    <div id="whats-new" role="dialog" aria-modal="true" aria-labelledby="wn-title">
      <header class="wn-head">
        <div class="wn-eyebrow">What's new</div>
        <h2 id="wn-title"></h2>
        <p class="wn-summary"></p>
        <div class="wn-versions" role="tablist"></div>
        <button class="wn-close" type="button" aria-label="Close">✕</button>
      </header>
      <div class="wn-cards"></div>
      <footer class="wn-foot">
        <span class="wn-foot-note"></span>
        <span class="wn-foot-actions">
          <button class="wn-fixes-toggle" type="button" hidden></button>
          <button class="wn-done" type="button">Got it</button>
        </span>
      </footer>
    </div>`;
  document.body.appendChild(overlay);

  const versionsEl = overlay.querySelector('.wn-versions');
  if (releases.length > 1) {
    releases.forEach((r, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.textContent = r.version;
      b.addEventListener('click', () => renderRelease(i));
      versionsEl.appendChild(b);
    });
  } else {
    versionsEl.hidden = true;
  }

  const fixesToggle = overlay.querySelector('.wn-fixes-toggle');
  let current = 0, showingFixes = false;
  fixesToggle.addEventListener('click', () => renderRelease(current, !showingFixes));

  // `fixes`: show the release's fixes page instead of its feature cards. A
  // release without features only has the fixes page.
  function renderRelease(index, fixes = false) {
    const r = releases[index];
    const fixList = r.fixes || [];
    current = index;
    showingFixes = fixes || !whatsNewHasFeatures(r);
    const n = fixList.length;
    const title = showingFixes && (fixes || !r.title) ? 'Fixes & improvements' : r.title;
    overlay.querySelector('#wn-title').textContent = title;
    overlay.querySelector('.wn-summary').textContent = showingFixes
      ? `Bug fixes and polish in Meowtrix ${r.version}.`
      : (r.summary || '');
    fixesToggle.hidden = !whatsNewHasFeatures(r) || !n;
    fixesToggle.innerHTML = showingFixes
      ? '<span aria-hidden="true">←</span> Back to features'
      : `Fixes &amp; improvements (${n}) <span aria-hidden="true">→</span>`;
    overlay.querySelector('.wn-foot-note').textContent = `Meowtrix ${r.version}${r.date ? ' · ' + formatWhatsNewDate(r.date) : ''}`;
    [...versionsEl.children].forEach((b, i) => {
      b.classList.toggle('active', i === index);
      b.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    const cards = overlay.querySelector('.wn-cards');
    cards.innerHTML = '';
    cards.classList.toggle('wn-cards-fixes', showingFixes);
    if (showingFixes) cards.appendChild(buildWhatsNewFixes(fixList));
    else r.highlights.forEach((h, i) => cards.appendChild(buildWhatsNewCard(h, i)));
    cards.scrollTop = 0;
  }
  renderRelease(0, !!opts.fixes);

  const close = () => { closeWhatsNew(); markWhatsNewSeen(); };
  overlay.querySelector('.wn-close').addEventListener('click', close);
  overlay.querySelector('.wn-done').addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay._onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', overlay._onKey, true);
  overlay.querySelector('.wn-done').focus();
}

function closeWhatsNew() {
  const overlay = document.getElementById('whats-new-overlay');
  if (!overlay) return;
  document.removeEventListener('keydown', overlay._onKey, true);
  overlay.remove();
}

function formatWhatsNewDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Inline `code` in note text, everything else escaped.
function whatsNewRichText(text) {
  const esc = (s) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return esc(text || '').replace(/`([^`]+)`/g, '<code>$1</code>');
}

function buildWhatsNewFixes(fixes) {
  const list = document.createElement('ul');
  list.className = 'wn-fixes';
  fixes.forEach((f, i) => {
    const li = document.createElement('li');
    li.style.setProperty('--wn-delay', `${i * 40}ms`);
    li.innerHTML = whatsNewRichText(f);
    list.appendChild(li);
  });
  return list;
}

function buildWhatsNewCard(h, index) {
  const card = document.createElement('article');
  card.className = 'wn-card';
  card.style.setProperty('--wn-delay', `${index * 70}ms`);
  if (h.visual) card.appendChild(buildWhatsNewVisual(h.visual));
  const text = document.createElement('div');
  text.className = 'wn-card-text';
  text.innerHTML = `<h3>${whatsNewRichText(h.title)}</h3><p>${whatsNewRichText(h.body)}</p>`;
  card.appendChild(text);
  if (h.try && h.try.action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wn-try';
    btn.innerHTML = `${whatsNewRichText(h.try.label || 'Try it')} <span aria-hidden="true">→</span>`;
    btn.addEventListener('click', () => runWhatsNewAction(h.try.action, btn));
    card.appendChild(btn);
  }
  return card;
}

// Expands a timeline row's marks: explicit `at` starts, or one every `every`
// (optionally stopping at `until`), minus any that fall in a `skip` range.
function whatsNewRowMarks(row) {
  const width = row.width || 0.01;
  let starts = [];
  if (Array.isArray(row.at)) starts = row.at.slice();
  else if (row.every > 0) for (let x = 0.01; x < (row.until ?? 1) - width / 2; x += row.every) starts.push(x);
  const skip = row.skip || [];
  return starts
    .filter(x => !skip.some(([a, b]) => x >= a && x < b))
    .map(x => [x, Math.min(width, 1 - x)]);
}

// Visuals are plain DOM + CSS so they follow the theme tokens. A timeline is a
// set of lanes; a playhead sweeps across and each mark lights up as it passes,
// with a live counter per lane — the before/after difference is the point.
function buildWhatsNewVisual(v) {
  const stage = document.createElement('div');
  stage.className = `wn-visual wn-visual-${v.type}`;
  if (v.type === 'glyph') {
    stage.innerHTML = `<div class="wn-glyph" aria-hidden="true">${v.glyph || '✨'}</div>`;
  } else if (v.type === 'timeline') {
    const lanes = document.createElement('div');
    lanes.className = 'wn-lanes';
    // Span shading and the playhead sit in a layer aligned with the track column.
    const layer = document.createElement('div');
    layer.className = 'wn-layer';
    if (v.span) {
      const span = document.createElement('div');
      span.className = 'wn-span';
      span.style.left = `${v.span[0] * 100}%`;
      span.style.width = `${(v.span[1] - v.span[0]) * 100}%`;
      span.innerHTML = `<span>${whatsNewRichText(v.spanLabel || '')}</span>`;
      layer.appendChild(span);
    }
    const rows = (v.rows || []).map(row => {
      const lane = document.createElement('div');
      lane.className = `wn-lane wn-tone-${row.tone || 'accent'}`;
      lane.innerHTML = `<span class="wn-lane-label">${whatsNewRichText(row.label)}</span><div class="wn-track"></div><span class="wn-count">0</span>`;
      const track = lane.querySelector('.wn-track');
      const marks = whatsNewRowMarks(row).map(([x, w]) => {
        const m = document.createElement('i');
        m.style.left = `${x * 100}%`;
        m.style.width = `${w * 100}%`;
        track.appendChild(m);
        return { x, el: m };
      });
      lanes.appendChild(lane);
      return { marks, countEl: lane.querySelector('.wn-count') };
    });
    const head = document.createElement('div');
    head.className = 'wn-playhead';
    layer.appendChild(head);
    lanes.appendChild(layer);
    stage.appendChild(lanes);
    animateWhatsNewTimeline(stage, head, rows);
  }
  if (v.caption) {
    const cap = document.createElement('div');
    cap.className = 'wn-caption';
    cap.innerHTML = whatsNewRichText(v.caption);
    stage.appendChild(cap);
  }
  return stage;
}

function animateWhatsNewTimeline(stage, head, rows) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint = (t) => {
    head.style.left = `${t * 100}%`;
    for (const r of rows) {
      let n = 0;
      for (const m of r.marks) {
        const lit = m.x <= t;
        if (lit) n++;
        m.el.classList.toggle('lit', lit);
      }
      r.countEl.textContent = String(n);
    }
  };
  if (reduced) { paint(1); head.hidden = true; return; }
  const SWEEP = 3200, HOLD = 1400;
  let start = null;
  const frame = (now) => {
    if (!stage.isConnected) return; // sheet closed or release switched
    if (start === null) start = now;
    const t = ((now - start) % (SWEEP + HOLD)) / SWEEP;
    paint(Math.min(1, t));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function runWhatsNewAction(action, btn) {
  const [kind, ...rest] = String(action).split(':');
  const arg = rest.join(':');
  const pane = typeof activePane !== 'undefined' ? activePane : null;
  if (kind === 'copy') {
    const done = () => { btn.classList.add('wn-copied'); btn.textContent = 'Copied ✓'; };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(arg).then(done, () => {});
    else if (typeof showToast === 'function') showToast(arg);
    return; // stays open: copying doesn't take you anywhere
  }
  closeWhatsNew();
  markWhatsNewSeen();
  if (kind === 'settings') {
    if (typeof openSettings !== 'function') return;
    openSettings();
    const section = arg && document.getElementById(arg);
    if (section) {
      section.open = true;
      setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        section.classList.add('wn-highlight');
        setTimeout(() => section.classList.remove('wn-highlight'), 1800);
      }, 220);
    }
  } else if (kind === 'tab' && pane && typeof addTab === 'function') {
    addTab(pane, arg);
    if (typeof saveSessionState === 'function') saveSessionState();
  } else if (kind === 'split' && pane && typeof splitPane === 'function') {
    splitPane(pane, 'vertical');
  } else if (kind === 'palette' && typeof openPalette === 'function') {
    openPalette();
  }
}
