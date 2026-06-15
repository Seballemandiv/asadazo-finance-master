import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({ theme: "light", resolvedTheme: "light", setTheme: () => {} });

function applyTheme() {
  if (typeof window === "undefined") return "light";
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "light";
  localStorage.setItem("asadazo-theme", "light");
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");
  const [resolvedTheme, setResolvedTheme] = useState("light");

  const setTheme = () => {
    localStorage.setItem("asadazo-theme", "light");
    setThemeState("light");
    setResolvedTheme(applyTheme());
  };

  useEffect(() => {
    setThemeState("light");
    setResolvedTheme(applyTheme());
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
