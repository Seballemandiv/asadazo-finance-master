import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "asadazo-theme-v3";
const ThemeContext = createContext({ theme: "light", resolvedTheme: "light", setTheme: () => {} });

const LIGHT_VARS = {
  "--background": "37 100% 96%",
  "--foreground": "0 15% 8%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 15% 8%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "0 15% 8%",
  "--primary": "0 70% 22%",
  "--primary-foreground": "37 100% 96%",
  "--secondary": "36 86% 69%",
  "--secondary-foreground": "0 75% 15%",
  "--muted": "37 45% 91%",
  "--muted-foreground": "0 14% 36%",
  "--accent": "36 86% 69%",
  "--accent-foreground": "0 75% 15%",
  "--border": "35 45% 82%",
  "--input": "35 45% 82%",
  "--ring": "0 70% 22%",
  "--sidebar-background": "37 100% 96%",
  "--sidebar-foreground": "0 15% 8%",
  "--sidebar-primary": "0 70% 22%",
  "--sidebar-primary-foreground": "37 100% 96%",
  "--sidebar-accent": "36 86% 69%",
  "--sidebar-accent-foreground": "0 75% 15%",
  "--sidebar-border": "35 45% 82%",
  "--sidebar-ring": "0 70% 22%",
};

function applyTheme(theme) {
  if (typeof window === "undefined") return "light";
  const root = document.documentElement;
  root.classList.remove("dark");
  for (const [key, value] of Object.entries(LIGHT_VARS)) root.style.setProperty(key, value);
  root.style.colorScheme = "light";
  document.body.style.backgroundColor = "hsl(37 100% 96%)";
  document.body.style.color = "hsl(0 15% 8%)";
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(THEME_KEY) || "light";
  });
  const [resolvedTheme, setResolvedTheme] = useState("light");

  const setTheme = (nextTheme) => {
    const value = ["light", "dark", "system"].includes(nextTheme) ? nextTheme : "light";
    localStorage.setItem(THEME_KEY, value);
    setThemeState(value);
  };

  useEffect(() => {
    setResolvedTheme(applyTheme(theme));
  }, [theme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
