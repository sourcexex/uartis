import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themeColors } from '../theme/tokens';
import type { ThemeColors } from '../theme/tokens';

export type { ThemeColors } from '../theme/tokens';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  reducedTransparency: boolean;
  setReducedTransparency: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [reducedTransparency, setReducedTransparencyState] = useState<boolean>(false);

  // Load saved theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('uartis_theme') as ThemeMode | null;
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      setThemeModeState(savedTheme);
    }
    setReducedTransparencyState(localStorage.getItem('uartis_reduced_transparency') === 'true');
  }, []);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  // Glass/transparency preference is applied as a data attribute so CSS can
  // fall back to solid surfaces without a second render path.
  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-transparency', reducedTransparency ? 'true' : 'false');
  }, [reducedTransparency]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('uartis_theme', mode);
  };

  const setReducedTransparency = (enabled: boolean) => {
    setReducedTransparencyState(enabled);
    localStorage.setItem('uartis_reduced_transparency', enabled ? 'true' : 'false');
  };

  // The token values are CSS variables, so they resolve to the active
  // `data-theme` without duplicating the palette in JavaScript.
  const colors = themeColors;

  return (
    <ThemeContext.Provider value={{ themeMode, colors, setThemeMode, reducedTransparency, setReducedTransparency }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
