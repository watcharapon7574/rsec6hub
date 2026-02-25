import { SearchX } from 'lucide-react';

const OcrSearchEmptyState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <SearchX className="h-16 w-16 text-muted-foreground/40 mb-4" />
      <h3 className="text-lg font-medium text-foreground mb-1">
        ไม่พบผลลัพธ์
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        ลองค้นหาด้วยคำค้นอื่น หรือเปลี่ยนโหมดการค้นหา
      </p>
    </div>
  );
};

export default OcrSearchEmptyState;
