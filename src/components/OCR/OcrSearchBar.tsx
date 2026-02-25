import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Loader2 } from 'lucide-react';

export type SearchMode = 'hybrid' | 'fulltext' | 'semantic';

interface OcrSearchBarProps {
  onSearch: (query: string, mode: SearchMode) => void;
  loading?: boolean;
}

const OcrSearchBar = ({ onSearch, loading }: OcrSearchBarProps) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) return;

    debounceRef.current = setTimeout(() => {
      onSearch(query.trim(), mode);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode, onSearch]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <Input
          placeholder="ค้นหาเอกสาร... เช่น INV-2025-001 หรือ เอกสารจัดซื้อ"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-10"
        />
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="hybrid">ทั้งหมด</TabsTrigger>
          <TabsTrigger value="fulltext">คำค้น</TabsTrigger>
          <TabsTrigger value="semantic">ความหมาย</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
};

export default OcrSearchBar;
