export type Theme = "light" | "dark" | "system";
export const THEME_STORAGE_KEY = "rh:theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "light";
}

export function prefersDarkMode(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const useDark = theme === "dark" || (theme === "system" && prefersDarkMode());
  document.documentElement.classList.toggle("dark", useDark);
}
