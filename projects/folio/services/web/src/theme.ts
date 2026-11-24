// Theme preference: follows the device by default, or locks Folio to light or dark.
// Stored in localStorage under THEME_STORAGE_KEY; mirrored to `<html data-theme>` and
// `<meta name="theme-color">`, and kept in sync across controls and open tabs.

export type ThemePreference = "device" | "light" | "dark";

export const THEME_STORAGE_KEY = "folio-theme";

export const THEME_OPTIONS: readonly { value: ThemePreference; label: string }[] = [
  { value: "device", label: "Device" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function parseTheme(raw: string | null | undefined): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "device";
}

export function getTheme(): ThemePreference {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "device";
  }
}

export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === "light" || pref === "dark") {
    root.dataset.theme = pref;
  } else {
    delete root.dataset.theme;
  }

  const lightMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-theme-color="light"]');
  const darkMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"][data-theme-color="dark"]');
  if (lightMeta && darkMeta) {
    lightMeta.media = pref === "light" ? "all" : pref === "dark" ? "not all" : "(prefers-color-scheme: light)";
    darkMeta.media = pref === "dark" ? "all" : pref === "light" ? "not all" : "(prefers-color-scheme: dark)";
  }

  for (const btn of document.querySelectorAll<HTMLElement>("[data-theme-choice]")) {
    const selected = btn.dataset.themeChoice === pref;
    btn.setAttribute("aria-checked", selected ? "true" : "false");
  }
}

export function setTheme(pref: ThemePreference): void {
  try {
    if (pref === "device") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, pref);
    }
  } catch {
    // Storage may be unavailable in private/sandboxed contexts; still apply in memory.
  }
  applyTheme(pref);
}

let initialized = false;

export function initTheme(): void {
  applyTheme(getTheme());
  if (initialized) return;
  initialized = true;

  document.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement | null)?.closest<HTMLElement>("[data-theme-choice]");
    if (!btn) return;
    setTheme(parseTheme(btn.dataset.themeChoice));
  });

  window.addEventListener("storage", (ev) => {
    if (ev.key === THEME_STORAGE_KEY || ev.key === null) {
      applyTheme(getTheme());
    }
  });
}
