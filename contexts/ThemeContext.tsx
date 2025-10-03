// contexts/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  placeholder: string;
  primary: string;
  primaryLight: string;
  border: string;
  success: string;
  shadow: string;
};

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
};

const LIGHT: ThemeColors = {
  background: '#f0f4ff',
  surface: '#ffffff',
  text: '#1e293b',
  textSecondary: '#64748b',
  placeholder: '#94a3b8',
  primary: '#6366f1',
  primaryLight: '#eef2ff',
  border: '#e5e7eb',
  success: '#22c55e',
  shadow: 'rgba(0,0,0,0.1)',
};

const DARK: ThemeColors = {
  background: '#0b1220',
  surface: '#111827',
  text: '#f3f4f6',
  textSecondary: '#cbd5e1',
  placeholder: '#94a3b8',
  primary: '#818cf8',
  primaryLight: '#1f2937',
  border: '#1f2937',
  success: '#22c55e',
  shadow: 'rgba(0,0,0,0.5)',
};

const THEME_KEY = 'app_theme'; // 'light' | 'dark'

const ThemeContext = createContext<ThemeContextValue>({
  colors: LIGHT,
  isDark: false,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = Appearance.getColorScheme();
  const [isDark, setIsDark] = useState<boolean>(system === 'dark');

  // Load persisted preference
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === 'light') setIsDark(false);
        if (saved === 'dark') setIsDark(true);
      } catch {}
    })();
  }, []);

  // Persist on change
  useEffect(() => {
    AsyncStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light').catch(() => {});
  }, [isDark]);

  const toggleTheme = () => setIsDark((v) => !v);

  const colors = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);

  const value = useMemo<ThemeContextValue>(() => ({ colors, isDark, toggleTheme }), [colors, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
