// Tether shared normative data model & pane tree manager (PRD §6, §7, §8, §10, §11, §13, §14).
// This specification is identical across TypeScript (@tether/core), Swift (TetherKit), and Kotlin (com.hejitech.tether.core).

export const MAX_PANES = 4;
export const MIN_SPLIT_RATIO = 0.2;
export const MAX_SPLIT_RATIO = 0.8;
export const SPLIT_RATIO_STEP = 0.05;
export const MIN_TERMINAL_FONT_SIZE = 12;
export const MAX_TERMINAL_FONT_SIZE = 20;
export const DEFAULT_TERMINAL_FONT_SIZE = 14;
export const MIN_SCROLLBACK_LINES = 10_000;

export type SplitDirection = "horizontal" | "vertical";
export type TabType = "web" | "ssh" | "files";
export type FilesMode = "local" | "sftp";
export type SshAuthType = "key" | "password" | "keyAndPassword";
export type SshConnectionState = "Disconnected" | "Connecting" | "Connected" | "Reconnecting" | "Failed";
export type LayoutPresetId = "single" | "two_columns" | "three_columns" | "left_main_right_stack";

export interface WebTabState {
  url: string;
}

export interface SshTabState {
  hostId: string;
}

export interface FilesTabState {
  mode: FilesMode;
  path: string;
  hostId?: string;
}

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  web?: WebTabState;
  ssh?: SshTabState;
  files?: FilesTabState;
}

export interface PaneNode {
  type: "pane";
  id: string;
  tabs: Tab[];
  activeTabId: string | null;
}

export interface SplitNode {
  type: "split";
  direction: SplitDirection;
  ratio: number;
  first: TreeNode;
  second: TreeNode;
}

export type TreeNode = PaneNode | SplitNode;

export interface PaneTree {
  version: 1;
  root: TreeNode;
  focusedPaneId: string;
  /** Runtime or persisted temporary maximise state (PRD §7.1, §7.6). */
  maximizedPaneId?: string | null;
}

export interface SshHost {
  id: string;
  label?: string;
  host: string;
  port: number;
  username: string;
  auth: SshAuthType;
  keyId?: string | null;
  rememberPassword?: boolean;
  autoReconnectOnDisplayReconnect: boolean;
}

export interface KnownHostKey {
  host: string;
  port: number;
  algorithm: string;
  fingerprintSha256: string;
  acceptedAt: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface TetherSettings {
  terminalFontSize: number;
  landscapeLockWhenMonitorConnected: boolean;
  defaultSearchEngine: string;
}

export const DEFAULT_SETTINGS: TetherSettings = {
  terminalFontSize: DEFAULT_TERMINAL_FONT_SIZE,
  landscapeLockWhenMonitorConnected: true,
  defaultSearchEngine: "https://duckduckgo.com/?q=",
};

export interface WorkspaceSnapshot {
  tree: PaneTree;
  hosts: SshHost[];
  bookmarks: Bookmark[];
  settings: TetherSettings;
  updatedAt: string;
}

// ---------------------------------------------------------------- Clamping & Helpers

export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, Math.round(ratio * 1000) / 1000));
}

export function clampTerminalFontSize(pt: number): number {
  if (!Number.isFinite(pt)) return DEFAULT_TERMINAL_FONT_SIZE;
  return Math.min(MAX_TERMINAL_FONT_SIZE, Math.max(MIN_TERMINAL_FONT_SIZE, Math.round(pt)));
}

/**
 * Formats tab title according to PRD §8.1:
 * - Web: page title if available, otherwise host name from URL, otherwise "New Tab".
 * - SSH: `username@host` when connected, `username@host (disconnected)` when disconnected,
 *        `username@host (connecting...)` while connecting/reconnecting, `username@host (failed)` when failed.
 * - Files: last component of current directory path, or "Files" for default/root directory.
 */
export function formatTabTitle(
  tab: Tab,
  opts?: {
    pageTitle?: string | null;
    host?: SshHost | null;
    sshState?: SshConnectionState;
    defaultLocalPath?: string;
  }
): string {
  if (tab.type === "web") {
    const pt = opts?.pageTitle?.trim() || (tab.title && tab.title !== "New Tab" ? tab.title.trim() : "");
    if (pt) return pt;
    const rawUrl = tab.web?.url?.trim() ?? "";
    if (rawUrl) {
      try {
        const u = new URL(rawUrl);
        if (u.hostname) return u.hostname;
      } catch {
        // ignore invalid URL
      }
    }
    return "New Tab";
  }
  if (tab.type === "ssh") {
    const h = opts?.host;
    const base = h && h.username && h.host ? `${h.username}@${h.host}` : tab.title || "SSH";
    const state = opts?.sshState ?? "Disconnected";
    switch (state) {
      case "Connected":
        return base;
      case "Connecting":
      case "Reconnecting":
        return `${base} (connecting...)`;
      case "Failed":
        return `${base} (failed)`;
      case "Disconnected":
      default:
        return `${base} (disconnected)`;
    }
  }
  if (tab.type === "files") {
    const p = (tab.files?.path ?? "").trim();
    if (!p || p === "/" || p === opts?.defaultLocalPath) return "Files";
    const parts = p.replace(/\/+$/, "").split("/").filter(Boolean);
    return parts[parts.length - 1] || "Files";
  }
  return tab.title || "Tab";
}

/**
 * Resolves an address bar input into either a direct URL or a search URL (PRD §9.2).
 */
export function resolveAddressBarInput(input: string, searchPrefix = DEFAULT_SETTINGS.defaultSearchEngine): string {
  const trimmed = input.trim();
  if (!trimmed) return "https://example.com";
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    try {
      return new URL(trimmed).toString();
    } catch {
      return `${searchPrefix}${encodeURIComponent(trimmed)}`;
    }
  }
  // Check if it looks like a domain or localhost/IP without spaces
  if (!/\s/.test(trimmed) && (trimmed.includes(".") || trimmed.startsWith("localhost") || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(trimmed))) {
    const scheme = trimmed.startsWith("localhost") || /^\d{1,3}(\.\d{1,3}){3}/.test(trimmed) ? "http://" : "https://";
    try {
      return new URL(`${scheme}${trimmed}`).toString();
    } catch {
      // fall through to search
    }
  }
  return `${searchPrefix}${encodeURIComponent(trimmed)}`;
}

// ---------------------------------------------------------------- Tree Queries

export function listPanes(node: TreeNode): PaneNode[] {
  if (node.type === "pane") return [node];
  return [...listPanes(node.first), ...listPanes(node.second)];
}

export function countPanes(tree: PaneTree): number {
  return listPanes(tree.root).length;
}

export function findPane(tree: PaneTree, paneId: string): PaneNode | null {
  return listPanes(tree.root).find((p) => p.id === paneId) ?? null;
}

export function getFocusedPane(tree: PaneTree): PaneNode {
  const panes = listPanes(tree.root);
  return panes.find((p) => p.id === tree.focusedPaneId) ?? panes[0];
}

// ---------------------------------------------------------------- Factory Helpers

export function createWebTab(id: string, url = "https://example.com", title?: string): Tab {
  const tab: Tab = { id, type: "web", title: title ?? "", web: { url } };
  tab.title = formatTabTitle(tab, { pageTitle: title });
  return tab;
}

export function createSshTab(id: string, hostId: string, host?: SshHost | null): Tab {
  const tab: Tab = { id, type: "ssh", title: "", ssh: { hostId } };
  tab.title = formatTabTitle(tab, { host, sshState: "Disconnected" });
  return tab;
}

export function createFilesTab(id: string, mode: FilesMode = "local", path = "/", hostId?: string): Tab {
  const tab: Tab = {
    id,
    type: "files",
    title: "",
    files: { mode, path, ...(mode === "sftp" && hostId ? { hostId } : {}) },
  };
  tab.title = formatTabTitle(tab);
  return tab;
}

export function createDefaultTree(): PaneTree {
  const webTab = createWebTab("tab-1", "https://example.com", "Example");
  const sshTab = createSshTab("tab-2", "");
  return {
    version: 1,
    root: {
      type: "split",
      direction: "horizontal",
      ratio: 0.5,
      first: {
        type: "pane",
        id: "pane-1",
        tabs: [webTab],
        activeTabId: webTab.id,
      },
      second: {
        type: "pane",
        id: "pane-2",
        tabs: [sshTab],
        activeTabId: sshTab.id,
      },
    },
    focusedPaneId: "pane-1",
    maximizedPaneId: null,
  };
}

// ---------------------------------------------------------------- Pane Tree Operations (PRD §7.1, §7.2, §8.2)

export interface TreeOperationResult {
  tree: PaneTree;
  notice?: string;
}

function nextPaneId(tree: PaneTree): string {
  const existing = new Set(listPanes(tree.root).map((p) => p.id));
  for (let i = 1; i <= 100; i++) {
    const candidate = `pane-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `pane-${Date.now()}`;
}

function nextTabId(tree: PaneTree): string {
  const existing = new Set(listPanes(tree.root).flatMap((p) => p.tabs.map((t) => t.id)));
  for (let i = 1; i <= 1000; i++) {
    const candidate = `tab-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `tab-${Date.now()}`;
}

function mapPaneInNode(node: TreeNode, paneId: string, fn: (pane: PaneNode) => TreeNode): TreeNode {
  if (node.type === "pane") {
    return node.id === paneId ? fn(node) : node;
  }
  return {
    ...node,
    first: mapPaneInNode(node.first, paneId, fn),
    second: mapPaneInNode(node.second, paneId, fn),
  };
}

/**
 * Splits the focused pane either right (`horizontal`) or down (`vertical`).
 * Enforces the 4-pane maximum limit (PRD §7.5) with a plain-language notice.
 */
export function splitFocusedPane(
  tree: PaneTree,
  direction: SplitDirection,
  initialTab?: Tab
): TreeOperationResult {
  const panes = listPanes(tree.root);
  if (panes.length >= MAX_PANES) {
    return {
      tree,
      notice: `Maximum of ${MAX_PANES} panes reached. Close a pane before splitting again.`,
    };
  }
  const focused = getFocusedPane(tree);
  const newId = nextPaneId(tree);
  const tabs = initialTab ? [initialTab] : [];
  const newPane: PaneNode = {
    type: "pane",
    id: newId,
    tabs,
    activeTabId: initialTab ? initialTab.id : null,
  };
  const root = mapPaneInNode(tree.root, focused.id, (pane) => ({
    type: "split",
    direction,
    ratio: 0.5,
    first: pane,
    second: newPane,
  }));
  return {
    tree: {
      ...tree,
      root,
      focusedPaneId: newId,
      maximizedPaneId: null,
    },
  };
}

function removePaneFromNode(node: TreeNode, targetId: string): TreeNode | null {
  if (node.type === "pane") {
    return node.id === targetId ? null : node;
  }
  const first = removePaneFromNode(node.first, targetId);
  const second = removePaneFromNode(node.second, targetId);
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
}

/**
 * Closes a pane and rebalances the binary split tree (sibling takes its place, PRD §7.1).
 * Closing the last remaining pane is disallowed (PRD §6.1, §7.1).
 */
export function closePane(tree: PaneTree, paneId = tree.focusedPaneId): TreeOperationResult {
  const panes = listPanes(tree.root);
  if (panes.length <= 1) {
    return {
      tree,
      notice: "Cannot close the last remaining pane.",
    };
  }
  const idx = panes.findIndex((p) => p.id === paneId);
  if (idx < 0) return { tree };
  const nextRoot = removePaneFromNode(tree.root, paneId);
  if (!nextRoot) return { tree };
  const remaining = listPanes(nextRoot);
  const nextFocus = remaining[Math.min(idx, remaining.length - 1)]?.id ?? remaining[0].id;
  return {
    tree: {
      ...tree,
      root: nextRoot,
      focusedPaneId: tree.focusedPaneId === paneId ? nextFocus : tree.focusedPaneId,
      maximizedPaneId: tree.maximizedPaneId === paneId ? null : tree.maximizedPaneId,
    },
  };
}

export function focusPane(tree: PaneTree, paneId: string): PaneTree {
  if (!findPane(tree, paneId)) return tree;
  return {
    ...tree,
    focusedPaneId: paneId,
    maximizedPaneId: tree.maximizedPaneId && tree.maximizedPaneId !== paneId ? paneId : tree.maximizedPaneId,
  };
}

export function moveFocus(tree: PaneTree, delta: 1 | -1): PaneTree {
  const panes = listPanes(tree.root);
  if (panes.length <= 1) return tree;
  const idx = Math.max(0, panes.findIndex((p) => p.id === tree.focusedPaneId));
  const nextIdx = (idx + delta + panes.length) % panes.length;
  const nextId = panes[nextIdx].id;
  return {
    ...tree,
    focusedPaneId: nextId,
    maximizedPaneId: tree.maximizedPaneId ? nextId : null,
  };
}

export function toggleMaximizeFocusedPane(tree: PaneTree): PaneTree {
  const focused = getFocusedPane(tree);
  return {
    ...tree,
    maximizedPaneId: tree.maximizedPaneId === focused.id ? null : focused.id,
  };
}

/**
 * Swaps the focused pane's tabs and activeTabId with the next pane in tree order (PRD §7.1).
 */
export function swapFocusedPaneWithNext(tree: PaneTree): PaneTree {
  const panes = listPanes(tree.root);
  if (panes.length <= 1) return tree;
  const idx = Math.max(0, panes.findIndex((p) => p.id === tree.focusedPaneId));
  const nextIdx = (idx + 1) % panes.length;
  const firstPane = panes[idx];
  const secondPane = panes[nextIdx];

  function swapNodes(node: TreeNode): TreeNode {
    if (node.type === "pane") {
      if (node.id === firstPane.id) {
        return { ...node, tabs: secondPane.tabs, activeTabId: secondPane.activeTabId };
      }
      if (node.id === secondPane.id) {
        return { ...node, tabs: firstPane.tabs, activeTabId: firstPane.activeTabId };
      }
      return node;
    }
    return { ...node, first: swapNodes(node.first), second: swapNodes(node.second) };
  }

  return {
    ...tree,
    root: swapNodes(tree.root),
    focusedPaneId: secondPane.id,
  };
}

function containsPane(node: TreeNode, paneId: string): boolean {
  if (node.type === "pane") return node.id === paneId;
  return containsPane(node.first, paneId) || containsPane(node.second, paneId);
}

/**
 * Updates the split ratio at the given path of binary steps ("first" | "second") from the root,
 * or on the nearest parent split of `focusedPaneId` when `splitPath` is omitted.
 */
export function updateSplitRatio(
  tree: PaneTree,
  newRatio: number,
  splitPath?: ("first" | "second")[]
): PaneTree {
  const clamped = clampRatio(newRatio);

  if (splitPath) {
    function updateAtPath(node: TreeNode, depth: number): TreeNode {
      if (node.type === "pane") return node;
      if (depth === splitPath!.length) {
        return { ...node, ratio: clamped };
      }
      const step = splitPath![depth];
      return step === "first"
        ? { ...node, first: updateAtPath(node.first, depth + 1) }
        : { ...node, second: updateAtPath(node.second, depth + 1) };
    }
    return { ...tree, root: updateAtPath(tree.root, 0) };
  }

  // Adjust nearest ancestor split of focusedPaneId
  function adjustFocusedParent(node: TreeNode): { node: TreeNode; handled: boolean } {
    if (node.type === "pane") return { node, handled: false };
    const inFirst = containsPane(node.first, tree.focusedPaneId);
    const inSecond = containsPane(node.second, tree.focusedPaneId);
    if (inFirst && node.first.type === "split") {
      const sub = adjustFocusedParent(node.first);
      if (sub.handled) return { node: { ...node, first: sub.node }, handled: true };
    }
    if (inSecond && node.second.type === "split") {
      const sub = adjustFocusedParent(node.second);
      if (sub.handled) return { node: { ...node, second: sub.node }, handled: true };
    }
    if (inFirst || inSecond) {
      return { node: { ...node, ratio: clamped }, handled: true };
    }
    return { node, handled: false };
  }

  return { ...tree, root: adjustFocusedParent(tree.root).node };
}

export function stepFocusedSplitRatio(tree: PaneTree, deltaSteps: 1 | -1): PaneTree {
  function stepParent(node: TreeNode): { node: TreeNode; handled: boolean } {
    if (node.type === "pane") return { node, handled: false };
    const inFirst = containsPane(node.first, tree.focusedPaneId);
    const inSecond = containsPane(node.second, tree.focusedPaneId);
    if (inFirst && node.first.type === "split") {
      const sub = stepParent(node.first);
      if (sub.handled) return { node: { ...node, first: sub.node }, handled: true };
    }
    if (inSecond && node.second.type === "split") {
      const sub = stepParent(node.second);
      if (sub.handled) return { node: { ...node, second: sub.node }, handled: true };
    }
    if (inFirst || inSecond) {
      return {
        node: { ...node, ratio: clampRatio(node.ratio + deltaSteps * SPLIT_RATIO_STEP) },
        handled: true,
      };
    }
    return { node, handled: false };
  }
  return { ...tree, root: stepParent(tree.root).node };
}

/**
 * Applies one of the 4 required layout presets (PRD §7.2), keeping all existing tabs
 * and redistributing them into the new layout in tree order without losing any tab.
 */
export function applyLayoutPreset(tree: PaneTree, preset: LayoutPresetId): PaneTree {
  const oldPanes = listPanes(tree.root);
  const allTabs = oldPanes.flatMap((p) => p.tabs);

  const targetCount = preset === "single" ? 1 : preset === "two_columns" ? 2 : 3;
  const buckets: Tab[][] = Array.from({ length: targetCount }, () => []);

  if (oldPanes.length === targetCount) {
    for (let i = 0; i < targetCount; i++) {
      buckets[i] = [...oldPanes[i].tabs];
    }
  } else {
    allTabs.forEach((tab, idx) => {
      buckets[Math.min(idx, targetCount - 1)].push(tab);
    });
    // If there are more tabs than targetCount, distribute remaining into the last bucket or evenly
    if (allTabs.length > targetCount) {
      for (let i = 0; i < targetCount; i++) buckets[i] = [];
      allTabs.forEach((tab, idx) => {
        buckets[idx % targetCount].push(tab);
      });
    }
  }

  const makePane = (index: number): PaneNode => {
    const id = oldPanes[index]?.id ?? `pane-${index + 1}`;
    const tabs = buckets[index];
    const prevActive = oldPanes[index]?.activeTabId;
    const activeTabId = tabs.some((t) => t.id === prevActive)
      ? prevActive!
      : tabs[0]?.id ?? null;
    return { type: "pane", id, tabs, activeTabId };
  };

  let root: TreeNode;
  if (preset === "single") {
    root = makePane(0);
  } else if (preset === "two_columns") {
    root = {
      type: "split",
      direction: "horizontal",
      ratio: 0.5,
      first: makePane(0),
      second: makePane(1),
    };
  } else if (preset === "three_columns") {
    root = {
      type: "split",
      direction: "horizontal",
      ratio: 0.333,
      first: makePane(0),
      second: {
        type: "split",
        direction: "horizontal",
        ratio: 0.5,
        first: makePane(1),
        second: makePane(2),
      },
    };
  } else {
    // left_main_right_stack: 50% left, two stacked panes on right (50/50 vertical)
    root = {
      type: "split",
      direction: "horizontal",
      ratio: 0.5,
      first: makePane(0),
      second: {
        type: "split",
        direction: "vertical",
        ratio: 0.5,
        first: makePane(1),
        second: makePane(2),
      },
    };
  }

  const newPanes = listPanes(root);
  const focusedPaneId = newPanes.some((p) => p.id === tree.focusedPaneId)
    ? tree.focusedPaneId
    : newPanes[0].id;

  return {
    version: 1,
    root,
    focusedPaneId,
    maximizedPaneId: null,
  };
}

// ---------------------------------------------------------------- Tab Operations (PRD §8.2)

export function addTab(tree: PaneTree, tab: Tab, paneId = tree.focusedPaneId): PaneTree {
  const root = mapPaneInNode(tree.root, paneId, (pane) => ({
    ...pane,
    tabs: [...pane.tabs, tab],
    activeTabId: tab.id,
  }));
  return { ...tree, root, focusedPaneId: paneId };
}

export function createAndAddTab(
  tree: PaneTree,
  type: TabType,
  opts?: { url?: string; hostId?: string; host?: SshHost | null; filesMode?: FilesMode; path?: string },
  paneId = tree.focusedPaneId
): { tree: PaneTree; tab: Tab } {
  const id = nextTabId(tree);
  let tab: Tab;
  if (type === "web") {
    tab = createWebTab(id, opts?.url ?? "https://example.com");
  } else if (type === "ssh") {
    tab = createSshTab(id, opts?.hostId ?? "", opts?.host);
  } else {
    tab = createFilesTab(id, opts?.filesMode ?? "local", opts?.path ?? "/", opts?.hostId);
  }
  return { tree: addTab(tree, tab, paneId), tab };
}

/**
 * Closes a tab in a pane. If it is the last tab in a pane, the pane remains empty with `activeTabId: null` (PRD §6.1, §7.1).
 */
export function closeTab(tree: PaneTree, tabId: string, paneId = tree.focusedPaneId): PaneTree {
  const root = mapPaneInNode(tree.root, paneId, (pane) => {
    const idx = pane.tabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return pane;
    const nextTabs = pane.tabs.filter((t) => t.id !== tabId);
    let nextActive = pane.activeTabId;
    if (pane.activeTabId === tabId) {
      nextActive = nextTabs[Math.min(idx, nextTabs.length - 1)]?.id ?? null;
    }
    return { ...pane, tabs: nextTabs, activeTabId: nextActive };
  });
  return { ...tree, root };
}

export function activateTab(tree: PaneTree, paneId: string, tabId: string): PaneTree {
  const root = mapPaneInNode(tree.root, paneId, (pane) =>
    pane.tabs.some((t) => t.id === tabId) ? { ...pane, activeTabId: tabId } : pane
  );
  return { ...tree, root, focusedPaneId: paneId };
}

export function cycleTabInFocusedPane(tree: PaneTree, delta: 1 | -1): PaneTree {
  const pane = getFocusedPane(tree);
  if (pane.tabs.length <= 1) return tree;
  const idx = Math.max(0, pane.tabs.findIndex((t) => t.id === pane.activeTabId));
  const nextIdx = (idx + delta + pane.tabs.length) % pane.tabs.length;
  return activateTab(tree, pane.id, pane.tabs[nextIdx].id);
}

/**
 * Moves the active tab of the focused pane to the next or previous pane in tree order (PRD §8.2).
 */
export function moveActiveTabToAdjacentPane(tree: PaneTree, delta: 1 | -1): PaneTree {
  const panes = listPanes(tree.root);
  if (panes.length <= 1) return tree;
  const srcIdx = panes.findIndex((p) => p.id === tree.focusedPaneId);
  if (srcIdx < 0) return tree;
  const srcPane = panes[srcIdx];
  const activeTab = srcPane.tabs.find((t) => t.id === srcPane.activeTabId) ?? srcPane.tabs[0];
  if (!activeTab) return tree;

  const dstIdx = (srcIdx + delta + panes.length) % panes.length;
  const dstPane = panes[dstIdx];

  const afterRemove = closeTab(tree, activeTab.id, srcPane.id);
  return addTab(afterRemove, activeTab, dstPane.id);
}

/**
 * Duplicates a Web tab in the focused pane (same URL, new tab, PRD §8.2).
 * Duplicating SSH or Files tabs is out of scope for version 1 and returns unchanged.
 */
export function duplicateActiveWebTab(tree: PaneTree): TreeOperationResult {
  const pane = getFocusedPane(tree);
  const active = pane.tabs.find((t) => t.id === pane.activeTabId);
  if (!active) return { tree };
  if (active.type !== "web") {
    return { tree, notice: "Only Web tabs can be duplicated in version 1." };
  }
  const copy = createWebTab(nextTabId(tree), active.web?.url ?? "https://example.com", active.title);
  return { tree: addTab(tree, copy, pane.id) };
}

export function updateTab(tree: PaneTree, tabId: string, updater: (tab: Tab) => Tab): PaneTree {
  function mapTabs(node: TreeNode): TreeNode {
    if (node.type === "pane") {
      if (!node.tabs.some((t) => t.id === tabId)) return node;
      return { ...node, tabs: node.tabs.map((t) => (t.id === tabId ? updater(t) : t)) };
    }
    return { ...node, first: mapTabs(node.first), second: mapTabs(node.second) };
  }
  return { ...tree, root: mapTabs(tree.root) };
}

// ---------------------------------------------------------------- Terminal Geometry (PRD §10.5)

export function computeTerminalGrid(
  paneWidthPx: number,
  paneHeightPx: number,
  charWidthPx: number,
  lineHeightPx: number
): { cols: number; rows: number } {
  const safeCharW = Math.max(4, charWidthPx);
  const safeLineH = Math.max(8, lineHeightPx);
  const cols = Math.max(20, Math.floor(Math.max(0, paneWidthPx) / safeCharW));
  const rows = Math.max(5, Math.floor(Math.max(0, paneHeightPx) / safeLineH));
  return { cols, rows };
}

export function requiresPasteConfirmation(text: string): boolean {
  return text.includes("\n") || text.includes("\r");
}

// ---------------------------------------------------------------- Validation & Security Sanitization (PRD §6, §14)

export interface ValidationIssue {
  path: string;
  message: string;
}

const FORBIDDEN_SECRET_KEYS = new Set([
  "password",
  "passphrase",
  "privateKey",
  "private_key",
  "secret",
  "secretKey",
  "pem",
]);

function containsForbiddenKeys(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const hit = containsForbiddenKeys(item);
      if (hit) return hit;
    }
    return null;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_SECRET_KEYS.has(k)) return k;
    const nested = containsForbiddenKeys(v);
    if (nested) return `${k}.${nested}`;
  }
  return null;
}

export function validatePaneTree(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input || typeof input !== "object") {
    return [{ path: "tree", message: "must be an object" }];
  }
  const secretHit = containsForbiddenKeys(input);
  if (secretHit) {
    issues.push({ path: secretHit, message: "secret material is forbidden in persisted layout JSON (PRD §14)" });
  }
  const t = input as Partial<PaneTree>;
  if (t.version !== 1) issues.push({ path: "version", message: "version must be 1" });
  if (!t.root || typeof t.root !== "object") {
    issues.push({ path: "root", message: "root node is required" });
    return issues;
  }

  const paneIds = new Set<string>();
  function checkNode(node: unknown, path: string) {
    if (!node || typeof node !== "object") {
      issues.push({ path, message: "node must be an object" });
      return;
    }
    const n = node as Record<string, unknown>;
    if (n.type === "pane") {
      if (!n.id || typeof n.id !== "string") issues.push({ path: `${path}.id`, message: "pane id is required" });
      else if (paneIds.has(n.id)) issues.push({ path: `${path}.id`, message: `duplicate pane id ${n.id}` });
      else paneIds.add(n.id);

      if (!Array.isArray(n.tabs)) {
        issues.push({ path: `${path}.tabs`, message: "tabs must be an array" });
      } else {
        const tabIds = new Set<string>();
        n.tabs.forEach((rawTab: unknown, idx: number) => {
          const tp = `${path}.tabs[${idx}]`;
          if (!rawTab || typeof rawTab !== "object") {
            issues.push({ path: tp, message: "tab must be an object" });
            return;
          }
          const tab = rawTab as Record<string, unknown>;
          if (!tab.id || typeof tab.id !== "string") issues.push({ path: `${tp}.id`, message: "tab id required" });
          else tabIds.add(tab.id);
          if (!["web", "ssh", "files"].includes(String(tab.type))) {
            issues.push({ path: `${tp}.type`, message: "tab type must be web, ssh, or files" });
          }
        });
        if (n.activeTabId !== null && n.activeTabId !== undefined && !tabIds.has(String(n.activeTabId))) {
          issues.push({ path: `${path}.activeTabId`, message: "activeTabId must refer to a tab in the pane or be null" });
        }
      }
    } else if (n.type === "split") {
      if (n.direction !== "horizontal" && n.direction !== "vertical") {
        issues.push({ path: `${path}.direction`, message: "direction must be horizontal or vertical" });
      }
      if (typeof n.ratio !== "number" || n.ratio < MIN_SPLIT_RATIO || n.ratio > MAX_SPLIT_RATIO) {
        issues.push({ path: `${path}.ratio`, message: `ratio must be between ${MIN_SPLIT_RATIO} and ${MAX_SPLIT_RATIO}` });
      }
      checkNode(n.first, `${path}.first`);
      checkNode(n.second, `${path}.second`);
    } else {
      issues.push({ path: `${path}.type`, message: "node type must be pane or split" });
    }
  }

  checkNode(t.root, "root");
  if (paneIds.size === 0) {
    issues.push({ path: "root", message: "tree must contain at least one pane" });
  } else if (paneIds.size > MAX_PANES) {
    issues.push({ path: "root", message: `tree cannot exceed ${MAX_PANES} panes` });
  }
  if (!t.focusedPaneId || !paneIds.has(t.focusedPaneId)) {
    issues.push({ path: "focusedPaneId", message: "focusedPaneId must refer to a pane in the tree" });
  }
  return issues;
}

export function validateSshHost(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!input || typeof input !== "object") {
    return [{ path: "host", message: "must be an object" }];
  }
  const secretHit = containsForbiddenKeys(input);
  if (secretHit) {
    issues.push({ path: secretHit, message: "passwords and private keys must never be stored in host JSON (PRD §6.4, §14)" });
  }
  const h = input as Partial<SshHost>;
  if (!h.id || typeof h.id !== "string") issues.push({ path: "id", message: "id is required" });
  if (!h.host || typeof h.host !== "string" || !h.host.trim()) issues.push({ path: "host", message: "hostname or IP is required" });
  const port = h.port ?? 22;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push({ path: "port", message: "port must be an integer from 1 to 65535" });
  }
  if (!h.username || typeof h.username !== "string" || !h.username.trim()) {
    issues.push({ path: "username", message: "username is required" });
  }
  if (!["key", "password", "keyAndPassword"].includes(String(h.auth))) {
    issues.push({ path: "auth", message: "auth must be key, password, or keyAndPassword" });
  }
  return issues;
}

export function normalizeSshHost(h: Partial<SshHost>): SshHost {
  return {
    id: String(h.id ?? `host-${Date.now()}`),
    ...(h.label?.trim() ? { label: h.label.trim().slice(0, 60) } : {}),
    host: String(h.host ?? "").trim(),
    port: Number.isInteger(h.port) ? Number(h.port) : 22,
    username: String(h.username ?? "").trim(),
    auth: h.auth === "password" || h.auth === "keyAndPassword" ? h.auth : "key",
    ...(h.keyId ? { keyId: String(h.keyId) } : {}),
    ...(h.rememberPassword ? { rememberPassword: Boolean(h.rememberPassword) } : {}),
    autoReconnectOnDisplayReconnect: Boolean(h.autoReconnectOnDisplayReconnect),
  };
}

export function normalizeSettings(input?: Partial<TetherSettings> | null): TetherSettings {
  return {
    terminalFontSize: clampTerminalFontSize(input?.terminalFontSize ?? DEFAULT_TERMINAL_FONT_SIZE),
    landscapeLockWhenMonitorConnected: input?.landscapeLockWhenMonitorConnected ?? true,
    defaultSearchEngine: input?.defaultSearchEngine?.trim() || DEFAULT_SETTINGS.defaultSearchEngine,
  };
}

// ---------------------------------------------------------------- Keyboard Shortcuts Catalog (PRD §13.1, §13.2)

export interface ShortcutSpec {
  id: string;
  action: string;
  iosKeys: string;
  androidKeys: string;
  worksWhenTerminalFocused: boolean;
}

export const KEYBOARD_SHORTCUTS: ShortcutSpec[] = [
  { id: "new_tab", action: "New tab in focused pane (Web / SSH / Files)", iosKeys: "Cmd + T", androidKeys: "Ctrl + T", worksWhenTerminalFocused: true },
  { id: "close_tab", action: "Close active tab (confirms if live SSH)", iosKeys: "Cmd + W", androidKeys: "Ctrl + Shift + W / Alt + W", worksWhenTerminalFocused: true },
  { id: "next_tab", action: "Next tab in focused pane", iosKeys: "Cmd + Tab / Cmd + Shift + ]", androidKeys: "Ctrl + Tab", worksWhenTerminalFocused: true },
  { id: "prev_tab", action: "Previous tab in focused pane", iosKeys: "Cmd + Shift + Tab / Cmd + Shift + [", androidKeys: "Ctrl + Shift + Tab", worksWhenTerminalFocused: true },
  { id: "split_right", action: "Split focused pane right (horizontal)", iosKeys: "Cmd + \\ (or Cmd + Shift + →)", androidKeys: "Ctrl + \\ (or Ctrl + Shift + →)", worksWhenTerminalFocused: true },
  { id: "split_down", action: "Split focused pane down (vertical)", iosKeys: "Cmd + - (or Cmd + Shift + ↓)", androidKeys: "Ctrl + Shift + ↓", worksWhenTerminalFocused: true },
  { id: "focus_next_pane", action: "Focus next pane in tree order", iosKeys: "Cmd + ] (or Cmd + `)", androidKeys: "Ctrl + ] (or Ctrl + `)", worksWhenTerminalFocused: true },
  { id: "focus_prev_pane", action: "Focus previous pane in tree order", iosKeys: "Cmd + [ (or Cmd + Shift + `)", androidKeys: "Ctrl + [ (or Ctrl + Shift + `)", worksWhenTerminalFocused: true },
  { id: "maximize_pane", action: "Maximise / restore focused pane", iosKeys: "Cmd + Shift + M", androidKeys: "Ctrl + Shift + M", worksWhenTerminalFocused: true },
  { id: "close_pane", action: "Close focused pane", iosKeys: "Cmd + Shift + W", androidKeys: "Ctrl + Shift + Backspace", worksWhenTerminalFocused: true },
  { id: "focus_address", action: "Focus address bar (Web) or host selector (SSH)", iosKeys: "Cmd + L", androidKeys: "Ctrl + Shift + L (Ctrl + L in Web)", worksWhenTerminalFocused: true },
  { id: "font_size_up", action: "Terminal font size up (12–20pt)", iosKeys: "Cmd + +", androidKeys: "Ctrl + +", worksWhenTerminalFocused: true },
  { id: "font_size_down", action: "Terminal font size down (12–20pt)", iosKeys: "Cmd + -", androidKeys: "Ctrl + -", worksWhenTerminalFocused: true },
];

/**
 * Terminal control keys that MUST pass through to the remote PTY when an SSH terminal tab is focused
 * (PRD §13.2: Ctrl-C, Ctrl-D, Ctrl-Z, Ctrl-R, Ctrl-A, Ctrl-E, Ctrl-K, Ctrl-U, Ctrl-W, Ctrl-L).
 */
export const TERMINAL_RESERVED_CTRL_KEYS = new Set(["c", "d", "z", "r", "a", "e", "k", "u", "w", "l"]);

export function shouldPassCtrlKeyToTerminal(key: string, shiftKey = false, altKey = false): boolean {
  if (shiftKey || altKey) return false;
  return TERMINAL_RESERVED_CTRL_KEYS.has(key.toLowerCase());
}
