import { cn } from '@/lib/utils';
import type { SearchMode } from '@/types/ocr';

interface OcrSearchModeTabsProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  className?: string;
}

const modes: { value: SearchMode; label: string }[] = [
  { value: 'hybrid', label: 'ทั้งหมด' },
  { value: 'fulltext', label: 'คำค้น' },
  { value: 'semantic', label: 'ความหมาย' },
];

const OcrSearchModeTabs = ({ mode, onModeChange, className }: OcrSearchModeTabsProps) => {
  return (
    <div className={cn('flex items-center gap-6', className)}>
      {modes.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onModeChange(value)}
          className={cn(
            'text-sm pb-2 border-b-2 transition-colors',
            mode === value
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default OcrSearchModeTabs;
