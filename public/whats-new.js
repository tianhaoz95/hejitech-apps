// ── What's new ──────────────────────────────────────────────────────────────
// A sheet that walks through what changed since the version the user last saw.
// Content lives in whats-new.json (newest release first); each highlight can
// carry an animated `visual` and a `try` action that jumps straight to the
// feature. The last-seen version is the `whatsNewSeen` setting, so seeing the
// sheet on one device marks it seen everywhere.
//
// Shown automatically once per upgrade, only to the active session (an
// inactive client sits behind the overlay). With no `whatsNewSeen` yet (first
// run, or upgrading from a version before this sheet existed) only the current
// release's notes are shown. Reopen any time from the palette or Settings → About.

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
  const unseen = data.releases.filter(r =>
    whatsNewCompare(r.version, current) <= 0 &&
    (seen ? whatsNewCompare(r.version, seen) > 0 : whatsNewCompare(r.version, current) === 0));
  if (!unseen.length) { markWhatsNewSeen(); return; }
  openWhatsNew({ releases: unseen });
}

function markWhatsNewSeen() {
  const current = whatsNewCurrentVersion();
  if (current && typeof saveSetting === 'function') saveSetting('whatsNewSeen', current);
}

// opts.releases: the releases to show (defaults to all, newest first).
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
        <button class="wn-done" type="button">Got it</button>
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

  function renderRelease(index) {
    const r = releases[index];
    overlay.querySelector('#wn-title').textContent = r.title;
    overlay.querySelector('.wn-summary').textContent = r.summary || '';
    overlay.querySelector('.wn-foot-note').textContent = `Meowtrix ${r.version}${r.date ? ' · ' + formatWhatsNewDate(r.date) : ''}`;
    [...versionsEl.children].forEach((b, i) => {
      b.classList.toggle('active', i === index);
      b.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    const cards = overlay.querySelector('.wn-cards');
    cards.innerHTML = '';
    r.highlights.forEach((h, i) => cards.appendChild(buildWhatsNewCard(h, i)));
    cards.scrollTop = 0;
  }
  renderRelease(0);

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
