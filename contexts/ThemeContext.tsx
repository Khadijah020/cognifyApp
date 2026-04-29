// contexts/ThemeContext.tsx
import React, { createContext, useContext, useMemo, useState } from 'react';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  placeholder: string;
  primary: string;
  primaryLight: string;
  border: string;
  success: string;
  shadow: string;
  cardBg: string;
  iconBg: string;
  divider: string;
};

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
};

const LIGHT: ThemeColors = {
  background: '#f0f4ff',
  surface: '#ffffff',
  surfaceSecondary: '#f9f8fc',
  text: '#1e293b',
  textSecondary: '#64748b',
  placeholder: '#94a3b8',
  primary: '#855ff7',
  primaryLight: '#eef2ff',
  border: '#e5e7eb',
  success: '#22c55e',
  shadow: 'rgba(0,0,0,0.1)',
  cardBg: '#ffffff',
  iconBg: '#eae7f4',
  divider: '#eef2f7',
};

const DARK: ThemeColors = {
  background: '#0f0f1a',
  surface: '#1a1a2e',
  surfaceSecondary: '#16162a',
  text: '#f1f5f9',
  textSecondary: '#94a3b8',
  placeholder: '#64748b',
  primary: '#a78bfa',
  primaryLight: '#2d2a4a',
  border: '#2d2d44',
  success: '#22c55e',
  shadow: 'rgba(0,0,0,0.4)',
  cardBg: '#1e1e36',
  iconBg: '#2d2a4a',
  divider: '#2d2d44',
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT,
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState<boolean>(false);

  const toggleTheme = () => setIsDark((v) => !v);

  const colors = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);

  const value = useMemo<ThemeContextValue>(() => ({ colors, isDark, toggleTheme }), [colors, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
