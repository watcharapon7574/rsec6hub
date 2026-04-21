import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SearchMode } from '@/types/ocr';

interface OcrSearchModeTabsProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  className?: string;
}

const modes: { value: SearchMode; label: string; ai?: boolean }[] = [
  { value: 'fulltext', label: 'คำค้น' },
  { value: 'hybrid', label: 'ทั้งหมด', ai: true },
  { value: 'semantic', label: 'ความหมาย', ai: true },
];

const OcrSearchModeTabs = ({ mode, onModeChange, className }: OcrSearchModeTabsProps) => {
  return (
    <div className={cn('flex items-center gap-6', className)}>
      {modes.map(({ value, label, ai }) => (
        <button
          key={value}
          onClick={() => onModeChange(value)}
          className={cn(
            'text-sm pb-2 border-b-2 transition-colors inline-flex items-center gap-1',
            mode === value
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {ai && <Sparkles className="h-3.5 w-3.5" />}
          {label}
          {ai && <span className="text-[10px] font-medium opacity-80">AI</span>}
        </button>
      ))}
    </div>
  );
};

export default OcrSearchModeTabs;
