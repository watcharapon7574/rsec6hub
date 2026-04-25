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
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => !!el,
    );
    if (elements.length === 0) return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.set(entry.target.id, entry.intersectionRatio);
          } else {
            visible.delete(entry.target.id);
          }
        }
        if (visible.size > 0) {
          // Pick the section with the largest visible ratio; if tied, the first in SECTIONS order
          let bestId = SECTIONS[0].id;
          let bestRatio = -1;
          for (const s of SECTIONS) {
            const r = visible.get(s.id);
            if (r !== undefined && r > bestRatio) {
              bestRatio = r;
              bestId = s.id;
            }
          }
          setActiveId(bestId);
        }
      },
      {
        rootMargin: '-80px 0px -50% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="fixed left-2 md:left-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-1.5 md:gap-2 bg-background/85 backdrop-blur-xl rounded-2xl shadow-lg border border-border/40 p-1.5 md:p-2">
      {SECTIONS.map((s) => {
        const isActive = activeId === s.id;
        return (
          <button
            key={s.id}
            type="button"
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
