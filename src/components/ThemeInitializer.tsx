// src/components/ThemeInitializer.tsx
'use client';
import { useEffect } from 'react';

export function ThemeInitializer() {
  useEffect(() => {
    // Apply theme (dark/light)
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Apply text size mode
    const storedTextSizeMode = localStorage.getItem('textSizeMode');
    if (storedTextSizeMode === 'large') {
      document.documentElement.classList.add('large-text-mode');
    } else {
      document.documentElement.classList.remove('large-text-mode');
    }
  }, []);

  return null; // This component does not render anything itself
}
