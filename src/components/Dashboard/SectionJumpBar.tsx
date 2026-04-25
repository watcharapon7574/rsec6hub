import React, { useEffect, useState } from 'react';
import {
  Home,
  LayoutGrid,
  CalendarDays,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

interface JumpSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

const SECTIONS: JumpSection[] = [
  { id: 'top', label: 'บนสุด', icon: Home },
  { id: 'quick-stats', label: 'เมนูลัด', icon: LayoutGrid },
  { id: 'calendar', label: 'ปฏิทินงาน', icon: CalendarDays },
  { id: 'student-stats', label: 'สถิตินักเรียนวันนี้', icon: Users },
  { id: 'quick-actions', label: 'ดำเนินการด่วน', icon: Zap },
];

const SectionJumpBar: React.FC = () => {
  const [activeId, setActiveId] = useState<string>('top');

  useEffect(() => {
    const handleScroll = () => {
      const offset = 120; // sticky/header offset
      let current: string = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top - offset <= 0) current = s.id;
      }
      setActiveId(current);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="fixed left-2 md:left-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 md:gap-2 bg-background/85 backdrop-blur-xl rounded-2xl shadow-lg border border-border/40 p-1.5 md:p-2">
      {SECTIONS.map((s) => {
        const isActive = activeId === s.id;
        return (
          <button
            key={s.id}
            onClick={() => handleClick(s.id)}
            className={`group relative flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all duration-200 ${
              isActive
                ? 'bg-blue-500 text-white shadow-md scale-105'
                : 'text-muted-foreground hover:bg-muted hover:text-primary'
            }`}
            aria-label={s.label}
          >
            <s.icon className="h-5 w-5" />
            <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none shadow-md border border-border transition-opacity">
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default SectionJumpBar;
