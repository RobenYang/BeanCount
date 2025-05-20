// src/components/ThemeInitializer.tsx
'use client';
import { useEffect } from 'react';

export function ThemeInitializer() {
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      // Default to light theme if nothing is stored or if it's 'light'
      document.documentElement.classList.remove('dark');
      // Optionally, you could set localStorage to 'light' here if it's not set
      // localStorage.setItem('theme', 'light');
    }
  }, []);

  return null; // This component does not render anything itself
}
