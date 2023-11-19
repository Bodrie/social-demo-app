import { createContext, useEffect, useState } from "react";
import { ThemeContextT } from "../types";

type ThemeContextProps = {
  children: string | JSX.Element | JSX.Element[];
};

export const ThemeContext = createContext<ThemeContextT>(null);

export const ThemeContextProvider = ({ children }: ThemeContextProps) => {
  const [theme, setTheme] = useState<string>(
    localStorage.getItem("theme") || "light"
  );

  const switchTheme = (theme: string) => {
    setTheme(theme);
  };

  useEffect(() => {
    localStorage.setItem("theme", JSON.stringify(theme));
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme: theme, switchTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
