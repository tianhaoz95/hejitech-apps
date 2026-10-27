// Interactive tiling workspace simulator on the landing page, powered by @tether/core.
import {
  activateTab,
  applyLayoutPreset,
  closePane,
  closeTab,
  countPanes,
  createAndAddTab,
  createDefaultTree,
  focusPane,
  toggleMaximizeFocusedPane,
  splitFocusedPane,
  type LayoutPresetId,
  type PaneNode,
  type PaneTree,
  type TreeNode,
} from "@tether/core";
import { el } from "./supabase.ts";

const canvas = document.getElementById("monitor-canvas")!;
const statusEl = document.getElementById("pane-status")!;
let tree: PaneTree = createDefaultTree();

function renderPane(pane: PaneNode): HTMLElement {
  const isFocused = tree.focusedPaneId === pane.id;
  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId) ?? pane.tabs[0] ?? null;

  const titleBar = el(
    "div",
    { class: "pane-titlebar" },
    el("span", {}, `${isFocused ? "● " : ""}${activeTab ? activeTab.title : "Empty Pane"} (${pane.id})`),
    el("span", { class: "mono" }, isFocused ? "FOCUSED" : "IDLE")
  );

  const tabNodes = pane.tabs.map((t) =>
    el(
      "div",
      {
        class: `pane-tab ${t.id === activeTab?.id ? "active" : ""}`,
        onclick: (e) => {
          e.stopPropagation();
          tree = activateTab(tree, pane.id, t.id);
          render();
        },
      },
      el("span", {}, `[${t.type.toUpperCase()}] ${t.title}`),
      el(
        "button",
        {
          class: "close-x",
          type: "button",
          title: "Close tab",
          onclick: (e) => {
            e.stopPropagation();
            tree = closeTab(tree, t.id, pane.id);
            render();
          },
        },
        "×"
      )
    )
  );

  const addWeb = el(
    "button",
    {
      class: "btn sm",
      type: "button",
      onclick: (e) => {
        e.stopPropagation();
        tree = createAndAddTab(tree, "web", { url: "https://example.com" }, pane.id).tree;
        render();
      },
    },
    "+ Web"
  );
  const addSsh = el(
    "button",
    {
      class: "btn sm",
      type: "button",
      onclick: (e) => {
        e.stopPropagation();
        tree = createAndAddTab(tree, "ssh", { hostId: "sample-host-1" }, pane.id).tree;
        render();
      },
    },
    "+ SSH"
  );
  const addFiles = el(
    "button",
    {
      class: "btn sm",
      type: "button",
      onclick: (e) => {
        e.stopPropagation();
        tree = createAndAddTab(tree, "files", { filesMode: "local", path: "/Documents" }, pane.id).tree;
        render();
      },
    },
    "+ Files"
  );

  const tabBar = el("div", { class: "pane-tabbar" }, ...tabNodes, addWeb, addSsh, addFiles);

  let toolbar: HTMLElement;
  let body: HTMLElement;

  if (!activeTab) {
    toolbar = el("div", { class: "pane-toolbar" }, el("span", { class: "muted" }, "No open tabs in this pane"));
    body = el(
      "div",
      { class: "pane-body" },
      el("p", { class: "muted" }, "Choose a tool to open in this pane:"),
      el("div", { class: "row" }, addWeb.cloneNode(true), addSsh.cloneNode(true), addFiles.cloneNode(true))
    );
  } else if (activeTab.type === "web") {
    toolbar = el(
      "div",
      { class: "pane-toolbar" },
      el("span", { class: "mono muted" }, "← → ↻"),
      el("input", { type: "text", value: activeTab.web?.url ?? "https://example.com", readonly: true })
    );
    body = el(
      "div",
      { class: "pane-body" },
      el("h3", {}, activeTab.title),
      el("p", { class: "muted small" }, `Rendering desktop viewport for ${activeTab.web?.url ?? "https://example.com"}. Independent WKWebView / Android WebView instance per tab; shared cookie store.`)
    );
  } else if (activeTab.type === "ssh") {
    toolbar = el(
      "div",
      { class: "pane-toolbar" },
      el("span", { class: "badge" }, "Disconnected"),
      el("span", { class: "mono" }, "sample@example.invalid:22"),
      el("span", { class: "muted" }, "xterm-256color · 14pt")
    );
    body = el(
      "div",
      { class: "pane-body terminal-view" },
      el("div", {}, "SSH-only remote terminal (no local shell on the phone)."),
      el("div", { style: "color: #58a6ff; margin-top: 6px" }, "Host key verification (SHA-256) is mandatory on every connection."),
      el("div", { style: "color: #3fb950; margin-top: 8px" }, "sample@example.invalid:~$ vim README.md _")
    );
  } else {
    toolbar = el(
      "div",
      { class: "pane-toolbar" },
      el("span", { class: "badge accent" }, activeTab.files?.mode === "sftp" ? "SFTP" : "Local"),
      el("span", { class: "mono" }, activeTab.files?.path ?? "/Documents"),
      el("span", { class: "muted" }, "↑ Up · ⌂ Home · + Folder")
    );
    body = el(
      "div",
      { class: "pane-body" },
      el("ul", { class: "list" },
        el("li", {}, el("span", { class: "mono" }, "📁 projects/"), el("span", { class: "muted small" }, "Directory")),
        el("li", {}, el("span", { class: "mono" }, "📄 notes.md"), el("span", { class: "muted small" }, "4.2 KB · Open in Web tab")),
        el("li", {}, el("span", { class: "mono" }, "📄 deploy.sh"), el("span", { class: "muted small" }, "1.8 KB · Copy path to SSH"))
      )
    );
  }

  return el(
    "div",
    {
      class: `tether-pane ${isFocused ? "focused" : ""}`,
      style: "flex: 1",
      onclick: () => {
        tree = focusPane(tree, pane.id);
        render();
      },
    },
    titleBar,
    tabBar,
    toolbar,
    body
  );
}

function renderNode(node: TreeNode): HTMLElement {
  if (node.type === "pane") {
    return renderPane(node);
  }
  const firstEl = renderNode(node.first);
  const secondEl = renderNode(node.second);
  firstEl.style.flex = `${node.ratio}`;
  secondEl.style.flex = `${1 - node.ratio}`;
  const divider = el("div", { class: "split-divider", title: "Drag divider (clamped 0.2–0.8)" });
  return el("div", { class: `split-container ${node.direction}` }, firstEl, divider, secondEl);
}

function render() {
  if (tree.maximizedPaneId) {
    const maxPane = renderNode(
      tree.root.type === "pane"
        ? tree.root
        : (function find(n: TreeNode): PaneNode | null {
            if (n.type === "pane") return n.id === tree.maximizedPaneId ? n : null;
            return find(n.first) ?? find(n.second);
          })(tree.root) ?? tree.root
    );
    canvas.replaceChildren(maxPane);
  } else {
    canvas.replaceChildren(renderNode(tree.root));
  }
  statusEl.textContent = `${countPanes(tree)} pane(s) · Focused: ${tree.focusedPaneId}${
    tree.maximizedPaneId ? " (MAXIMISED)" : ""
  }`;
}

document.querySelector('[data-action="split-h"]')?.addEventListener("click", () => {
  const res = splitFocusedPane(tree, "horizontal");
  if (res.notice) alert(res.notice);
  tree = res.tree;
  render();
});
document.querySelector('[data-action="split-v"]')?.addEventListener("click", () => {
  const res = splitFocusedPane(tree, "vertical");
  if (res.notice) alert(res.notice);
  tree = res.tree;
  render();
});
document.querySelector('[data-action="maximize"]')?.addEventListener("click", () => {
  tree = toggleMaximizeFocusedPane(tree);
  render();
});
document.querySelector('[data-action="close-pane"]')?.addEventListener("click", () => {
  const res = closePane(tree);
  if (res.notice) alert(res.notice);
  tree = res.tree;
  render();
});
document.getElementById("preset-select")?.addEventListener("change", (ev) => {
  const sel = ev.target as HTMLSelectElement;
  if (sel.value) {
    tree = applyLayoutPreset(tree, sel.value as LayoutPresetId);
    sel.value = "";
    render();
  }
});

render();
