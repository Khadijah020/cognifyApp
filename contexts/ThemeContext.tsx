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
  background: '#0f0f23',
  surface: '#1a1a2e',
  text: '#e5e7eb',
  textSecondary: '#9ca3af',
  placeholder: '#6b7280',
  primary: '#9333ea',
  primaryLight: '#2d2d44',
  border: '#374151',
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
