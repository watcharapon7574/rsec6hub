import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/hooks/useTheme';

const DarkModeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-1">
      <Sun className={`h-3 w-3 transition-colors ${isDark ? 'text-muted-foreground' : 'text-amber-500'}`} />
      <Switch
        checked={isDark}
        onCheckedChange={toggleTheme}
        aria-label="สลับโหมดมืด/สว่าง"
        className="scale-75 data-[state=checked]:bg-indigo-600 data-[state=unchecked]:bg-amber-400"
      />
      <Moon className={`h-3 w-3 transition-colors ${isDark ? 'text-indigo-400' : 'text-muted-foreground'}`} />
    </div>
  );
};

export default DarkModeToggle;
