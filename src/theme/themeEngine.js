import { DEFAULT_THEME_KEY, THEMES } from "./tokens.js?v=20260714-1";

const STORAGE_KEY = "aq3d.theme";

export function createThemeEngine(options = {}) {
  const { root = document.documentElement, onThemeChange = null } = options;
  let activeThemeKey = loadStoredTheme();

  function getTheme(themeKey = activeThemeKey) {
    return THEMES[themeKey] || THEMES[DEFAULT_THEME_KEY];
  }

  function applyTheme(themeKey = activeThemeKey) {
    const theme = getTheme(themeKey);
    activeThemeKey = theme.key;

    for (const [name, value] of Object.entries(theme.cssVars)) {
      root.style.setProperty(name, value);
    }

    root.setAttribute("data-theme", theme.key);
    storeTheme(theme.key);

    if (typeof onThemeChange === "function") {
      onThemeChange(theme);
    }

    return theme;
  }

  function toggleTheme() {
    const keys = Object.keys(THEMES);
    const index = keys.indexOf(activeThemeKey);
    const next = keys[(index + 1) % keys.length] || DEFAULT_THEME_KEY;
    return applyTheme(next);
  }

  function setTheme(themeKey) {
    return applyTheme(themeKey);
  }

  function getActiveThemeKey() {
    return activeThemeKey;
  }

  function loadStoredTheme() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && Object.hasOwn(THEMES, raw)) {
        return raw;
      }
    } catch {
      // ignore
    }
    return DEFAULT_THEME_KEY;
  }

  function storeTheme(themeKey) {
    try {
      localStorage.setItem(STORAGE_KEY, themeKey);
    } catch {
      // ignore
    }
  }

  return {
    THEMES,
    applyTheme,
    setTheme,
    toggleTheme,
    getTheme,
    getActiveThemeKey,
  };
}
