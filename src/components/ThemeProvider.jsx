import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "asadazo-theme";
const ThemeContext = createContext({ theme: "light", resolvedTheme: "light", setTheme: () => {} });

function applyLightTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(THEME_KEY) || "light";
  });

  const setTheme = (nextTheme) => {
    const value = ["light", "system"].includes(nextTheme) ? nextTheme : "light";
    localStorage.setItem(THEME_KEY, value);
    setThemeState(value);
  };

  useEffect(() => {
    applyLightTheme();
  }, [theme]);

  const value = useMemo(() => ({ theme, resolvedTheme: "light", setTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
