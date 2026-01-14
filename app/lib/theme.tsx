import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'cosmic' | 'paper' | 'cyberpunk' | 'luxury' | 'custom';

export type ThemeOverrides = {
  enabled: boolean;
  primary: string;
  background: string;
  surface: string;
  surfaceHighlight: string;
  textMain: string;
  contrastMode: 'dark' | 'light' | 'custom';
  contrastColor: string;
};

export type CustomTheme = {
  id: string;
  name: string;
  overrides: Partial<Omit<ThemeOverrides, 'enabled'>>;
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themeOverrides: ThemeOverrides;
  setThemeOverrides: (overrides: ThemeOverrides) => void;
  themePreview: ThemeOverrides | null;
  setThemePreview: (overrides: ThemeOverrides | null) => void;
  customThemes: CustomTheme[];
  setCustomThemes: (themes: CustomTheme[]) => void;
  activeCustomThemeId: string | null;
  setActiveCustomThemeId: (id: string | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_OVERRIDES_KEY = 'manverse_theme_overrides';
const CUSTOM_THEMES_KEY = 'manverse_custom_themes_v1';
const ACTIVE_CUSTOM_THEME_KEY = 'manverse_active_custom_theme';
const DEFAULT_THEME_OVERRIDES: ThemeOverrides = {
  enabled: false,
  primary: '#d4af37',
  background: '#050505',
  surface: '#141414',
  surfaceHighlight: '#282828',
  textMain: '#fafafa',
  contrastMode: 'dark',
  contrastColor: '#000000',
};

const normalizeHex = (value: string) => {
  const cleaned = value.trim().replace('#', '');
  if (cleaned.length === 3) {
    return `#${cleaned.split('').map((c) => `${c}${c}`).join('')}`;
  }
  if (cleaned.length === 6) return `#${cleaned}`;
  return null;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const hex = normalized.replace('#', '');
  const num = parseInt(hex, 16);
  return [
    (num >> 16) & 255,
    (num >> 8) & 255,
    num & 255,
  ];
};

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const adjustColor = (rgb: number[], amount: number) =>
  rgb.map((channel) => clamp(channel + 255 * amount));

const mixColors = (a: number[], b: number[], ratio: number) =>
  a.map((channel, index) => clamp(channel * (1 - ratio) + b[index] * ratio));

const rgbToCss = (rgb: number[]) => rgb.join(' ');

const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map((v) => v / 255);
  const adjust = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const [ra, ga, ba] = [adjust(r), adjust(g), adjust(b)];
  return 0.2126 * ra + 0.7152 * ga + 0.0722 * ba;
};

const applyOverrides = (root: HTMLElement, overrides: ThemeOverrides) => {
  if (!overrides.enabled) {
    [
      '--c-primary',
      '--c-primary-hover',
      '--c-on-primary',
      '--c-background',
      '--c-surface',
      '--c-surface-highlight',
      '--c-text-main',
      '--c-text-secondary',
      '--c-text-muted',
      '--c-text-faint',
      '--c-secondary',
      '--c-bg-contrast',
    ].forEach((key) => root.style.removeProperty(key));
    return;
  }

  const primary = hexToRgb(overrides.primary) || hexToRgb(DEFAULT_THEME_OVERRIDES.primary)!;
  const background = hexToRgb(overrides.background) || hexToRgb(DEFAULT_THEME_OVERRIDES.background)!;
  const surface = hexToRgb(overrides.surface) || hexToRgb(DEFAULT_THEME_OVERRIDES.surface)!;
  const surfaceHighlight =
    hexToRgb(overrides.surfaceHighlight) || hexToRgb(DEFAULT_THEME_OVERRIDES.surfaceHighlight)!;
  const textMain = hexToRgb(overrides.textMain) || hexToRgb(DEFAULT_THEME_OVERRIDES.textMain)!;

  const primaryHover = adjustColor(primary, -0.12);
  const onPrimary = luminance(primary) > 0.55 ? [0, 0, 0] : [255, 255, 255];
  const textSecondary = mixColors(textMain, background, 0.25);
  const textMuted = mixColors(textMain, background, 0.5);
  const textFaint = mixColors(textMain, background, 0.65);
  const secondary = textSecondary;
  const bgContrast = (() => {
    if (overrides.contrastMode === 'light') return [255, 255, 255];
    if (overrides.contrastMode === 'custom') {
      return hexToRgb(overrides.contrastColor) || [0, 0, 0];
    }
    return [0, 0, 0];
  })();

  root.style.setProperty('--c-primary', rgbToCss(primary));
  root.style.setProperty('--c-primary-hover', rgbToCss(primaryHover));
  root.style.setProperty('--c-on-primary', rgbToCss(onPrimary));
  root.style.setProperty('--c-background', rgbToCss(background));
  root.style.setProperty('--c-surface', rgbToCss(surface));
  root.style.setProperty('--c-surface-highlight', rgbToCss(surfaceHighlight));
  root.style.setProperty('--c-text-main', rgbToCss(textMain));
  root.style.setProperty('--c-text-secondary', rgbToCss(textSecondary));
  root.style.setProperty('--c-text-muted', rgbToCss(textMuted));
  root.style.setProperty('--c-text-faint', rgbToCss(textFaint));
  root.style.setProperty('--c-secondary', rgbToCss(secondary));
  root.style.setProperty('--c-bg-contrast', rgbToCss(bgContrast));
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('manverse_theme') as Theme;
      // Validate stored theme is valid, otherwise fallback to luxury
      if (['cosmic', 'paper', 'cyberpunk', 'luxury', 'custom'].includes(stored)) {
        return stored;
      }
    }
    return 'luxury';
  });

  const [themeOverrides, setThemeOverrides] = useState<ThemeOverrides>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_OVERRIDES;
    try {
      const raw = localStorage.getItem(THEME_OVERRIDES_KEY);
      if (!raw) return DEFAULT_THEME_OVERRIDES;
      const parsed = JSON.parse(raw) as ThemeOverrides;
      return { ...DEFAULT_THEME_OVERRIDES, ...parsed };
    } catch {
      return DEFAULT_THEME_OVERRIDES;
    }
  });
  const [themePreview, setThemePreview] = useState<ThemeOverrides | null>(null);
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [activeCustomThemeId, setActiveCustomThemeId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(ACTIVE_CUSTOM_THEME_KEY);
    return stored || null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
  }, [customThemes]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeCustomThemeId) {
      localStorage.setItem(ACTIVE_CUSTOM_THEME_KEY, activeCustomThemeId);
    } else {
      localStorage.removeItem(ACTIVE_CUSTOM_THEME_KEY);
    }
  }, [activeCustomThemeId]);

  useEffect(() => {
    if (!activeCustomThemeId) return;
    if (!customThemes.some((theme) => theme.id === activeCustomThemeId)) {
      setActiveCustomThemeId(null);
    }
  }, [activeCustomThemeId, customThemes]);

  useEffect(() => {
    const root = document.documentElement;
    const activeOverrides =
      theme === 'custom'
        ? themePreview ?? themeOverrides
        : { ...themeOverrides, enabled: false };
    // Remove all previous theme classes
    root.classList.remove(
      'theme-cosmic', 
      'theme-paper', 
      'theme-cyberpunk', 
      'theme-luxury',
      'theme-custom'
    );
    // Add new theme class
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('manverse_theme', theme);
    if (!themePreview) {
      localStorage.setItem(THEME_OVERRIDES_KEY, JSON.stringify(themeOverrides));
    }
    applyOverrides(root, activeOverrides);
  }, [theme, themeOverrides, themePreview]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themeOverrides,
        setThemeOverrides,
        themePreview,
        setThemePreview,
        customThemes,
        setCustomThemes,
        activeCustomThemeId,
        setActiveCustomThemeId,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const themes: { id: Theme; name: string; color: string }[] = [
  { id: 'cyberpunk', name: 'Cyberpunk', color: '#00ff9f' },
  { id: 'cosmic', name: 'Cosmic', color: '#6366f1' },
  { id: 'paper', name: 'Paper', color: '#ea580c' },
  { id: 'luxury', name: 'Luxury', color: '#d4af37' },
  { id: 'custom', name: 'Custom', color: '#9ca3af' },
];
