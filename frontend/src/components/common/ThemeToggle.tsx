import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: string;
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isLight = theme === 'light';

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isLight ? 'dark' : 'light'} mode`}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {isLight ? (
          <Sun size={15} color="currentColor" aria-hidden="true" />
        ) : (
          <Moon size={15} color="currentColor" aria-hidden="true" />
        )}
      </span>
      <span>{isLight ? 'Dark mode' : 'Light mode'}</span>
    </button>
  );
}
