import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'cosmic' | 'paper' | 'cyberpunk' | 'luxury';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('manverse_theme') as Theme;
      // Validate stored theme is valid, otherwise fallback to cyberpunk
      if (['cosmic', 'paper', 'cyberpunk', 'luxury'].includes(stored)) {
        return stored;
      }
    }
    return 'cyberpunk';
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all previous theme classes
    root.classList.remove(
      'theme-cosmic', 
      'theme-paper', 
      'theme-cyberpunk', 
      'theme-luxury'
    );
    // Add new theme class
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('manverse_theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
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
];