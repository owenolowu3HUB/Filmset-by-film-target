import React from 'react';
import { SunIcon, MoonIcon } from './icons';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, setTheme }) => {
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="p-2 rounded-full bg-bg-secondary hover:bg-surface border border-border-color text-text-secondary hover:text-accent transition-all duration-300"
    >
      {theme === 'dark' ? (
        <SunIcon className="w-5 h-5 transform transition-transform duration-500 rotate-0" />
      ) : (
        <MoonIcon className="w-5 h-5 transform transition-transform duration-500 rotate-0" />
      )}
    </button>
  );
};

export default ThemeToggle;
