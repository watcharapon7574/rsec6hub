import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

const DarkModeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="สลับโหมดมืด/สว่าง"
      className="
        fixed bottom-20 right-3 z-50
        w-9 h-9 rounded-full
        flex items-center justify-center
        bg-card/90 backdrop-blur-sm
        border border-border
        shadow-lg
        text-foreground
        hover:scale-110 active:scale-95
        transition-all duration-200
      "
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-indigo-500" />
      )}
    </button>
  );
};

export default DarkModeToggle;
