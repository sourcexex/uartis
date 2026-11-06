import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { themeColors } from '../theme/tokens';
import type { ThemeColors } from '../theme/tokens';
import { prefersReducedTransparency, resolveReducedTransparency, supportsBackdropFilter } from '../utils/glass';

export type { ThemeColors } from '../theme/tokens';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';
export type AccentColor = 'blue' | 'green' | 'purple' | 'orange';
export type GlassStrength = 'soft' | 'standard' | 'strong';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  setThemeMode: (mode: ThemeMode) => void;
  accent: AccentColor;
  setAccent: (accent: AccentColor) => void;
  glassStrength: GlassStrength;
  setGlassStrength: (strength: GlassStrength) => void;
  reducedTransparency: boolean;
  setReducedTransparency: (enabled: boolean) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEYS: ThemeMode[] = ['light', 'dark', 'system'];
const ACCENT_KEYS: AccentColor[] = ['blue', 'green', 'purple', 'orange'];
const GLASS_KEYS: GlassStrength[] = ['soft', 'standard', 'strong'];

function readStoredTheme(): ThemeMode {
  const stored = localStorage.getItem('uartis_theme') as ThemeMode | null;
  return stored && THEME_KEYS.includes(stored) ? stored : 'dark';
}

function readStoredAccent(): AccentColor {
  const stored = localStorage.getItem('uartis_accent') as AccentColor | null;
  return stored && ACCENT_KEYS.includes(stored) ? stored : 'blue';
}

function readStoredGlassStrength(): GlassStrength {
  const stored = localStorage.getItem('uartis_glass_strength') as GlassStrength | null;
  return stored && GLASS_KEYS.includes(stored) ? stored : 'standard';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(readStoredTheme);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);
  const [accent, setAccentState] = useState<AccentColor>(readStoredAccent);
  const [glassStrength, setGlassStrengthState] = useState<GlassStrength>(readStoredGlassStrength);
  const [reducedTransparency, setReducedTransparencyState] = useState<boolean>(() =>
    resolveReducedTransparency(localStorage.getItem('uartis_reduced_transparency'), prefersReducedTransparency())
  );
  const [highContrast, setHighContrastState] = useState<boolean>(
    () => localStorage.getItem('uartis_high_contrast') === 'true'
  );
  const [reducedMotion, setReducedMotionState] = useState<boolean>(
    () => localStorage.getItem('uartis_reduced_motion') === 'true'
  );

  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode;

  // Follow the OS theme while `themeMode` is system.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    setSystemDark(media.matches);
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.setAttribute('data-glass', glassStrength);
  }, [glassStrength]);

  // Glass/transparency preference is applied as a data attribute so CSS can
  // fall back to solid surfaces without a second render path.
  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-transparency', reducedTransparency ? 'true' : 'false');
  }, [reducedTransparency]);

  useEffect(() => {
    document.documentElement.setAttribute('data-glass-supported', supportsBackdropFilter() ? 'true' : 'false');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-contrast', highContrast ? 'more' : 'normal');
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', reducedMotion ? 'true' : 'false');
  }, [reducedMotion]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('uartis_theme', mode);
  };

  const setAccent = (value: AccentColor) => {
    setAccentState(value);
    localStorage.setItem('uartis_accent', value);
  };

  const setGlassStrength = (value: GlassStrength) => {
    setGlassStrengthState(value);
    localStorage.setItem('uartis_glass_strength', value);
  };

  const setReducedTransparency = (enabled: boolean) => {
    setReducedTransparencyState(enabled);
    localStorage.setItem('uartis_reduced_transparency', enabled ? 'true' : 'false');
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
    localStorage.setItem('uartis_high_contrast', enabled ? 'true' : 'false');
  };

  const setReducedMotion = (enabled: boolean) => {
    setReducedMotionState(enabled);
    localStorage.setItem('uartis_reduced_motion', enabled ? 'true' : 'false');
  };

  // The token values are CSS variables, so they resolve to the active
  // `data-theme` without duplicating the palette in JavaScript.
  const colors = themeColors;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        colors,
        setThemeMode,
        accent,
        setAccent,
        glassStrength,
        setGlassStrength,
        reducedTransparency,
        setReducedTransparency,
        highContrast,
        setHighContrast,
        reducedMotion,
        setReducedMotion,
      }}
    >
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
