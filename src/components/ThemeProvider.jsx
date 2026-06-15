import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({ theme: "light", resolvedTheme: "light", setTheme: () => {} });

function applyTheme(theme) {
  if (typeof window === "undefined") return "light";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem("asadazo-theme") || "light");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  const setTheme = (nextTheme) => {
    const value = ["light", "dark", "system"].includes(nextTheme) ? nextTheme : "light";
    localStorage.setItem("asadazo-theme", value);
    setThemeState(value);
  };

  useEffect(() => {
    const sync = () => setResolvedTheme(applyTheme(theme));
    sync();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, [theme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
