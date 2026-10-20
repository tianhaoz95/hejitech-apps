// Opens VitePress's local search box from anywhere (the hero field, the 404 page). The box has no
// API: it opens on ⌘K (VPNavBarSearch's onKeyStroke on window) and keeps its query in this
// sessionStorage key (VPLocalSearchBox, unless disableQueryPersistence), read when it mounts.
const QUERY_KEY = "vitepress:local-search-filter";

export function openSearch(query?: string) {
  if (query !== undefined) {
    try {
      sessionStorage.setItem(QUERY_KEY, query);
    } catch {}
  }
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true }));
}
