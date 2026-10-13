// ── mtx agent bridge (client side) ───────────────────────────────────────────
// The server forwards `mtx open` / `mtx open-file` / `mtx layout` / `mtx notify`
// (and the same tools over `mtx mcp`) to the active session as `mtx:rpc`
// messages; this file runs them against the live layout and answers with
// `mtx:rpc:result`. See mtx-service.js for the server half.
//
// Placement policy lives here, not with the agent: the client knows pane sizes,
// focus, and mobile mode, and the agent only says what it wants ("auto",
// "split", or a pane id from `mtx layout`). Callers pass the PTY id they run in
// ($MEOWTRIX_PTY_ID), so a new tab never lands on top of the agent's own
// terminal. Agent-opened tabs never steal keyboard focus from the user.

// Stable-for-this-page pane ids, handed out lazily (panes are rebuilt on
// restore, so these are only meaningful between a `layout` call and its use).
function mtxPaneId(pane) {
  if (!pane.mtxId) pane.mtxId = 'pane-' + Math.random().toString(36).slice(2, 8);
  return pane.mtxId;
}

function mtxPaneOfTab(tab, panes) {
  return tab ? (panes || getAllPanesAllWorkspaces()).find(p => p.tabs.includes(tab)) || null : null;
}

function mtxWorkspaceIndexOf(el) {
  const v = el?.closest?.('.workspace-view');
  return v ? parseInt(v.dataset.index, 10) : null;
}

// The pane the calling agent runs in, if it's on screen. Without a PTY id (a
// shell outside Meowtrix), the focused pane stands in — that's where the user is.
function mtxCallerPane(ptyId, panes) {
  if (ptyId) return mtxPaneOfTab(tabByPtyId(ptyId), panes);
  return activePane && panes.includes(activePane) ? activePane : null;
}

// Split `pane` along its longer axis so the new half isn't a sliver.
function mtxSplitBeside(pane) {
  const r = pane.el.getBoundingClientRect();
  return splitPane(pane, r.width >= r.height ? 'vertical' : 'horizontal', { empty: true });
}

// Pick the pane a new agent-opened tab should land in. Returns { pane, split }
// or { error }.
function mtxPlacePane(placement, ptyId) {
  const panes = getAllPanes();
  if (!panes.length) return { error: 'no-panes', message: 'The workspace has no panes yet.' };
  const me = mtxCallerPane(ptyId, panes);
  const mobile = typeof isMobileLike === 'function' && isMobileLike();

  if (placement && placement !== 'auto' && placement !== 'split') {
    const p = panes.find(p => mtxPaneId(p) === placement);
    if (!p) return { error: 'unknown-pane', message: `No pane "${placement}" — run get_layout for current pane ids.` };
    if (maximizedPane && maximizedPane !== p) toggleMaximizePane(maximizedPane);
    return { pane: p, split: false };
  }

  // A maximized pane hides everything else: use it unless it's the agent's own,
  // in which case restore the layout so the new tab can sit beside it.
  if (maximizedPane && panes.includes(maximizedPane)) {
    if (maximizedPane !== me) return { pane: maximizedPane, split: false };
    toggleMaximizePane(maximizedPane);
  }

  // Phones show one pane at a time; splitting there only shrinks things.
  if (placement === 'split' && !mobile) return { pane: mtxSplitBeside(me || activePane || panes[0]), split: true };

  const others = panes.filter(p => p !== me);
  if (!others.length) {
    if (mobile) return { pane: me || panes[0], split: false };
    return { pane: mtxSplitBeside(me || panes[0]), split: true };
  }

  // Prefer a pane that already shows pages (browser/CoDesign), then the biggest;
  // avoid the pane the user is focused on so we don't cover what they're doing.
  const score = (p) => {
    const r = p.el.getBoundingClientRect();
    let s = r.width * r.height;
    if (p.tabs.some(t => t.type === 'browser' || t.type === 'hostbrowser' || t.type === 'codesign')) s += 1e9;
    if (p === activePane) s -= 5e8;
    return s;
  };
  others.sort((a, b) => score(b) - score(a));
  return { pane: others[0], split: false };
}

// Run `fn` (which opens/activates a tab) without moving keyboard focus away from
// where the user was typing, then persist the layout.
function mtxPreservingFocus(fn) {
  const prevPane = activePane;
  const prevTab = prevPane?.activeTab;
  const hadFocus = prevPane && prevPane.el.contains(document.activeElement);
  const out = fn();
  const restore = () => {
    if (prevPane && prevPane.el.isConnected && getAllPanes().includes(prevPane)) {
      setActivePane(prevPane);
      if (hadFocus && prevTab?.term && prevPane.activeTab === prevTab) {
        try { prevTab.term.focus(); } catch {}
      }
    }
  };
  restore();
  // Terminal activation re-focuses on rAF/timeouts (see activateTab); restore
  // once more after those have run.
  setTimeout(restore, 200);
  saveSessionState();
  return out;
}

function mtxFlashTab(tab) {
  if (!tab?.tabEl) return;
  tab.tabEl.classList.remove('mtx-flash');
  void tab.tabEl.offsetWidth;
  tab.tabEl.classList.add('mtx-flash');
  setTimeout(() => tab.tabEl.classList.remove('mtx-flash'), 1600);
}

// Loopback / private hosts are dev servers: any page on the same origin can
// reuse the tab. Public sites only reuse a tab showing the exact same URL, so we
// never navigate away from something the user was reading.
function mtxIsLocalHost(host) {
  return /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i.test(host)
    || /\.(local|localhost|test)$/i.test(host);
}

// `host` restricts reuse to host-browser tabs (`mtx open --host`); otherwise
// either kind of browser tab may be reused.
function mtxFindReusableBrowserTab(url, panes, callerPane, host) {
  let target;
  try { target = new URL(url); } catch { return null; }
  let sameOrigin = null;
  for (const pane of panes) {
    for (const t of pane.tabs) {
      if (!(t.type === 'hostbrowser' || (t.type === 'browser' && !host)) || !t.currentUrl || !t.navigate) continue;
      // Bringing a background tab forward in the agent's own pane would cover
      // the agent's terminal; open a fresh tab elsewhere instead.
      if (pane === callerPane && pane.activeTab !== t) continue;
      let cur;
      try { cur = new URL(t.currentUrl); } catch { continue; }
      if (cur.href === target.href) return { pane, tab: t };
      if (!sameOrigin && cur.origin === target.origin && mtxIsLocalHost(target.hostname)) sameOrigin = { pane, tab: t };
    }
  }
  return sameOrigin;
}

function mtxOpenUrl({ url, placement, reuse, ptyId, host }) {
  const panes = getAllPanes();
  if (reuse !== false && (!placement || placement === 'auto')) {
    const hit = mtxFindReusableBrowserTab(url, panes, mtxCallerPane(ptyId, panes), !!host);
    if (hit) {
      mtxPreservingFocus(() => {
        if (maximizedPane && maximizedPane !== hit.pane) toggleMaximizePane(maximizedPane);
        activateTab(hit.pane, hit.tab.id);
        hit.tab.navigate(url);
      });
      mtxFlashTab(hit.tab);
      return { ok: true, action: 'reused', paneId: mtxPaneId(hit.pane), tabId: hit.tab.id, url };
    }
  }
  const out = mtxPreservingFocus(() => {
    const where = mtxPlacePane(placement, ptyId);
    if (where.error) return where;
    const tab = addTab(where.pane, host ? 'hostbrowser' : 'browser', undefined, undefined, url);
    return { ...where, tab };
  });
  if (out.error) return { ok: false, error: out.error, message: out.message };
  mtxFlashTab(out.tab);
  return { ok: true, action: out.split ? 'opened-in-new-split' : 'opened', paneId: mtxPaneId(out.pane), tabId: out.tab.id, url };
}

async function mtxOpenFile({ path, root, line, placement, ptyId }) {
  const panes = getAllPanes();
  const within = (dir) => dir && (path === dir || path.startsWith(dir.replace(/[/\\]$/, '') + '/') || path.startsWith(dir.replace(/[/\\]$/, '') + '\\'));
  // Reuse the editor tab whose folder most specifically contains the file.
  let best = null;
  for (const pane of panes) {
    for (const t of pane.tabs) {
      if (t.type === 'editor' && t.openFile && within(t.editorDir) && (!best || t.editorDir.length > best.tab.editorDir.length)) best = { pane, tab: t };
    }
  }
  let action = 'reused-editor';
  if (!best) {
    const out = mtxPreservingFocus(() => {
      const where = mtxPlacePane(placement, ptyId);
      if (where.error) return where;
      return { pane: where.pane, tab: addTab(where.pane, 'editor', undefined, undefined, undefined, root) };
    });
    if (out.error) return { ok: false, error: out.error, message: out.message };
    best = out;
    action = 'opened-editor';
  } else {
    mtxPreservingFocus(() => activateTab(best.pane, best.tab.id));
  }
  // openFile focuses Monaco; put focus back where the user was.
  const prev = document.activeElement;
  await best.tab.openFile(path, line || null);
  if (prev && prev !== document.activeElement && prev.isConnected && !best.tab.viewEl.contains(prev)) {
    try { prev.focus(); } catch {}
  }
  mtxFlashTab(best.tab);
  return { ok: true, action, paneId: mtxPaneId(best.pane), tabId: best.tab.id, path, line: line || null };
}

function mtxTabSummary(t, pane) {
  const s = { id: t.id, type: t.type, title: t.label?.textContent || t.type, active: pane.activeTab === t };
  if ((t.type === 'browser' || t.type === 'hostbrowser') && t.currentUrl) s.url = t.currentUrl;
  if (t.type === 'editor' && t.editorDir) s.dir = t.editorDir;
  if (t.type === 'codesign' && t.codesignDir) s.dir = t.codesignDir;
  if (t.type === 'agent' && (t.agentDir || t.workingDir)) s.dir = t.agentDir || t.workingDir;
  if (t.type === 'terminal' && t.sshHost) s.sshHost = t.sshHost;
  return s;
}

function mtxLayout({ ptyId }) {
  const callerTab = tabByPtyId(ptyId);
  const container = document.querySelector(`.workspace-view[data-index="${activeWorkspaceIndex}"]`);
  const root = container?.children[0];
  function ser(el) {
    if (el.classList.contains('pane')) {
      const pane = paneRegistry.get(el);
      if (!pane) return null;
      const r = el.getBoundingClientRect();
      const node = {
        type: 'pane', id: mtxPaneId(pane),
        width: Math.round(r.width), height: Math.round(r.height),
        tabs: pane.tabs.map(t => mtxTabSummary(t, pane)),
      };
      if (pane === activePane) node.focused = true;
      if (callerTab && pane.tabs.includes(callerTab)) node.containsCaller = true;
      if (pane === maximizedPane) node.maximized = true;
      return node;
    }
    if (el.classList.contains('split-container')) {
      const kids = [...el.children].filter(c => !c.classList.contains('split-divider')).map(ser).filter(Boolean);
      // 'vertical' splits are side by side (flex row); see layout.js.
      return { type: 'split', direction: el.classList.contains('vertical') ? 'row' : 'column', children: kids };
    }
    return null;
  }
  const callerWs = callerTab ? mtxWorkspaceIndexOf(callerTab.tabEl) : null;
  return {
    ok: true,
    workspace: { index: activeWorkspaceIndex, name: currentWorkspaces[activeWorkspaceIndex]?.name },
    callerWorkspace: callerWs,
    mobile: typeof isMobileLike === 'function' && isMobileLike(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    layout: root ? ser(root) : null,
  };
}

// Bring the caller's terminal to the front (used when a notification is clicked).
function mtxRevealTab(tab) {
  if (!tab?.tabEl?.isConnected) return;
  const wsIndex = mtxWorkspaceIndexOf(tab.tabEl);
  if (wsIndex !== null && wsIndex !== activeWorkspaceIndex && typeof switchWorkspace === 'function') switchWorkspace(wsIndex);
  const pane = mtxPaneOfTab(tab);
  if (!pane) return;
  setActivePane(pane);
  activateTab(pane, tab.id);
}

function mtxNotify({ message, title, ptyId }) {
  const callerTab = tabByPtyId(ptyId);
  const text = title ? `${title}: ${message}` : message;
  showToast(text, callerTab ? () => mtxRevealTab(callerTab) : undefined);

  // Mark the caller's tab until the user looks at it — unless they already are.
  const watching = callerTab && !document.hidden && mtxPaneOfTab(callerTab)?.activeTab === callerTab
    && mtxWorkspaceIndexOf(callerTab.tabEl) === activeWorkspaceIndex;
  if (callerTab && !watching) {
    callerTab.tabEl.classList.add('mtx-attention');
    callerTab.tabEl.addEventListener('click', () => callerTab.tabEl.classList.remove('mtx-attention'), { once: true });
  }

  // A system notification only when the page is in the background and the user
  // already granted permission (asking needs a user gesture).
  let system = false;
  if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      const n = new Notification(title || 'Meowtrix', { body: message, tag: 'mtx-' + (ptyId || 'notify') });
      n.onclick = () => { window.focus(); if (callerTab) mtxRevealTab(callerTab); n.close(); };
      system = true;
    } catch {}
  }
  return { ok: true, shown: system ? 'toast+system' : 'toast' };
}

async function onMtxRpc(msg) {
  let result;
  try {
    if (!isActiveSession) {
      result = { ok: false, error: 'inactive-session', message: 'This Meowtrix client is not the active session.' };
    } else {
      const p = msg.params || {};
      switch (msg.method) {
        case 'open':     result = mtxOpenUrl(p); break;
        case 'openFile': result = await mtxOpenFile(p); break;
        case 'layout':   result = mtxLayout(p); break;
        case 'notify':   result = mtxNotify(p); break;
        default:         result = { ok: false, error: 'unknown-method' };
      }
    }
  } catch (e) {
    result = { ok: false, error: 'client-error', message: String(e?.message || e) };
  }
  wsSend({ type: 'mtx:rpc:result', reqId: msg.reqId, result });
}
