import { describe, expect, it } from "vitest";
import {
  activateTab,
  addTab,
  applyLayoutPreset,
  clampRatio,
  clampTerminalFontSize,
  closePane,
  closeTab,
  computeTerminalGrid,
  countPanes,
  createAndAddTab,
  createDefaultTree,
  createFilesTab,
  createSshTab,
  createWebTab,
  cycleTabInFocusedPane,
  duplicateActiveWebTab,
  focusPane,
  formatTabTitle,
  getFocusedPane,
  listPanes,
  moveActiveTabToAdjacentPane,
  moveFocus,
  normalizeSettings,
  normalizeSshHost,
  requiresPasteConfirmation,
  resolveAddressBarInput,
  shouldPassCtrlKeyToTerminal,
  splitFocusedPane,
  stepFocusedSplitRatio,
  swapFocusedPaneWithNext,
  toggleMaximizeFocusedPane,
  updateSplitRatio,
  validatePaneTree,
  validateSshHost,
} from "../src/index.ts";

describe("@tether/core pane tree manager (PRD §6, §7, §8)", () => {
  it("creates a valid default 2-pane split tree", () => {
    const tree = createDefaultTree();
    expect(validatePaneTree(tree)).toEqual([]);
    expect(countPanes(tree)).toBe(2);
    expect(tree.focusedPaneId).toBe("pane-1");
  });

  it("splits panes up to MAX_PANES (4) and refuses the 5th split with a notice", () => {
    let tree = createDefaultTree(); // 2 panes
    const r3 = splitFocusedPane(tree, "vertical", createFilesTab("tab-3", "local", "/"));
    expect(r3.notice).toBeUndefined();
    tree = r3.tree;
    expect(countPanes(tree)).toBe(3);

    const r4 = splitFocusedPane(tree, "horizontal", createWebTab("tab-4", "https://example.org"));
    expect(r4.notice).toBeUndefined();
    tree = r4.tree;
    expect(countPanes(tree)).toBe(4);
    expect(validatePaneTree(tree)).toEqual([]);

    const r5 = splitFocusedPane(tree, "horizontal");
    expect(r5.notice).toMatch(/Maximum of 4 panes/);
    expect(countPanes(r5.tree)).toBe(4);
  });

  it("closes panes and rebalances the binary split tree, refusing to close the last pane", () => {
    let tree = createDefaultTree();
    const { tree: t3 } = splitFocusedPane(tree, "vertical");
    expect(countPanes(t3)).toBe(3);

    const { tree: t2 } = closePane(t3);
    expect(countPanes(t2)).toBe(2);

    const { tree: t1 } = closePane(t2);
    expect(countPanes(t1)).toBe(1);

    const last = closePane(t1);
    expect(last.notice).toMatch(/last remaining pane/);
    expect(countPanes(last.tree)).toBe(1);
  });

  it("clamps split ratios to [0.2, 0.8] and steps by 0.05", () => {
    expect(clampRatio(0.05)).toBe(0.2);
    expect(clampRatio(0.95)).toBe(0.8);
    expect(clampRatio(0.5)).toBe(0.5);

    let tree = createDefaultTree();
    tree = updateSplitRatio(tree, 0.99);
    expect(tree.root.type === "split" && tree.root.ratio).toBe(0.8);

    tree = stepFocusedSplitRatio(tree, -1);
    expect(tree.root.type === "split" && tree.root.ratio).toBe(0.75);
  });

  it("moves focus, swaps panes, and toggles temporary maximise", () => {
    let tree = createDefaultTree();
    expect(tree.focusedPaneId).toBe("pane-1");
    tree = moveFocus(tree, 1);
    expect(tree.focusedPaneId).toBe("pane-2");
    tree = moveFocus(tree, -1);
    expect(tree.focusedPaneId).toBe("pane-1");

    tree = toggleMaximizeFocusedPane(tree);
    expect(tree.maximizedPaneId).toBe("pane-1");
    tree = toggleMaximizeFocusedPane(tree);
    expect(tree.maximizedPaneId).toBeNull();

    const p1FirstTab = listPanes(tree.root)[0].tabs[0].id;
    const p2FirstTab = listPanes(tree.root)[1].tabs[0].id;
    tree = swapFocusedPaneWithNext(tree);
    expect(listPanes(tree.root)[0].tabs[0].id).toBe(p2FirstTab);
    expect(listPanes(tree.root)[1].tabs[0].id).toBe(p1FirstTab);
  });

  it("applies layout presets while redistributing all existing tabs without loss", () => {
    let tree = createDefaultTree();
    tree = addTab(tree, createFilesTab("tab-3", "local", "/Documents"), "pane-1");
    const totalBefore = listPanes(tree.root).flatMap((p) => p.tabs).length;

    const single = applyLayoutPreset(tree, "single");
    expect(countPanes(single)).toBe(1);
    expect(listPanes(single.root).flatMap((p) => p.tabs).length).toBe(totalBefore);

    const threeCols = applyLayoutPreset(single, "three_columns");
    expect(countPanes(threeCols)).toBe(3);
    expect(listPanes(threeCols.root).flatMap((p) => p.tabs).length).toBe(totalBefore);

    const stacked = applyLayoutPreset(threeCols, "left_main_right_stack");
    expect(countPanes(stacked)).toBe(3);
    expect(stacked.root.type === "split" && stacked.root.direction).toBe("horizontal");
    expect(stacked.root.type === "split" && stacked.root.second.type === "split" && stacked.root.second.direction).toBe("vertical");
  });

  it("manages tabs: add, close (leaves empty pane), cycle, move across panes, duplicate web tab", () => {
    let tree = createDefaultTree();
    const { tree: tWithFiles, tab: filesTab } = createAndAddTab(tree, "files", { filesMode: "local", path: "/Users/demo/Docs" });
    tree = tWithFiles;
    expect(getFocusedPane(tree).tabs.length).toBe(2);
    expect(getFocusedPane(tree).activeTabId).toBe(filesTab.id);

    tree = cycleTabInFocusedPane(tree, 1);
    expect(getFocusedPane(tree).activeTabId).toBe("tab-1");

    const dup = duplicateActiveWebTab(tree);
    expect(dup.notice).toBeUndefined();
    tree = dup.tree;
    expect(getFocusedPane(tree).tabs.length).toBe(3);

    // Move active web tab to pane-2
    tree = moveActiveTabToAdjacentPane(tree, 1);
    expect(tree.focusedPaneId).toBe("pane-2");
    expect(getFocusedPane(tree).tabs.length).toBe(2);

    // Close all tabs in pane-2 -> leaves empty pane with activeTabId: null
    const p2 = getFocusedPane(tree);
    for (const tb of p2.tabs) {
      tree = closeTab(tree, tb.id, p2.id);
    }
    expect(getFocusedPane(tree).tabs).toEqual([]);
    expect(getFocusedPane(tree).activeTabId).toBeNull();
  });

  it("formats tab titles per PRD §8.1", () => {
    const web = createWebTab("w1", "https://docs.example.com/guide");
    expect(web.title).toBe("docs.example.com");
    expect(formatTabTitle(web, { pageTitle: "Developer Guide" })).toBe("Developer Guide");

    const host = normalizeSshHost({ id: "h1", host: "dev.internal", port: 22, username: "alice", auth: "key" });
    const ssh = createSshTab("s1", "h1", host);
    expect(ssh.title).toBe("alice@dev.internal (disconnected)");
    expect(formatTabTitle(ssh, { host, sshState: "Connecting" })).toBe("alice@dev.internal (connecting...)");
    expect(formatTabTitle(ssh, { host, sshState: "Connected" })).toBe("alice@dev.internal");

    const filesRoot = createFilesTab("f1", "local", "/");
    expect(filesRoot.title).toBe("Files");
    const filesSub = createFilesTab("f2", "sftp", "/home/alice/projects", "h1");
    expect(filesSub.title).toBe("projects");
  });

  it("enforces PRD §14 security rules (rejects secrets in layout or host JSON)", () => {
    const treeWithSecret = {
      ...createDefaultTree(),
      leaked: { privateKey: "-----BEGIN OPENSSH PRIVATE KEY-----" },
    };
    expect(validatePaneTree(treeWithSecret)[0]?.message).toMatch(/forbidden/);

    const hostWithPassword = {
      id: "h1",
      host: "example.com",
      port: 22,
      username: "root",
      auth: "password",
      password: "secret",
    };
    expect(validateSshHost(hostWithPassword)[0]?.message).toMatch(/never be stored/);
  });

  it("resolves address bar URLs vs search queries and terminal helpers", () => {
    expect(resolveAddressBarInput("https://example.com/docs")).toBe("https://example.com/docs");
    expect(resolveAddressBarInput("example.com")).toBe("https://example.com/");
    expect(resolveAddressBarInput("swift nio ssh tutorial")).toContain("https://duckduckgo.com/?q=swift%20nio%20ssh%20tutorial");

    expect(clampTerminalFontSize(8)).toBe(12);
    expect(clampTerminalFontSize(28)).toBe(20);
    expect(computeTerminalGrid(800, 400, 8, 16)).toEqual({ cols: 100, rows: 25 });
    expect(requiresPasteConfirmation("ls -la")).toBe(false);
    expect(requiresPasteConfirmation("ls -la\nrm -rf /")).toBe(true);
    expect(shouldPassCtrlKeyToTerminal("c")).toBe(true);
    expect(shouldPassCtrlKeyToTerminal("w")).toBe(true);
    expect(shouldPassCtrlKeyToTerminal("w", true)).toBe(false);
  });
});
