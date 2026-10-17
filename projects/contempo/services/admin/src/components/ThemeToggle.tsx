import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem("contempo-theme");
  return stored === "light" || stored === "dark" ? stored : null;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(getStoredTheme);

  useEffect(() => {
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("contempo-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem("contempo-theme");
    }
  }, [theme]);

  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const effective = theme ?? (prefersDark ? "dark" : "light");

  return (
    <button
      className="btn-link"
      style={{ fontSize: "0.85rem" }}
      onClick={() => setTheme(effective === "dark" ? "light" : "dark")}
      aria-label="Toggle color theme"
    >
      {effective === "dark" ? "☀ Light" : "☾ Dark"}
    </button>
  );
}
