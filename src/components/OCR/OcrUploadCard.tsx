import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Image, FileSpreadsheet, File, X } from 'lucide-react';

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt';

interface OcrUploadCardProps {
  onUpload: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
}

const OcrUploadCard = ({ onUpload, disabled }: OcrUploadCardProps) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, [disabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
      setSelectedFiles([]);
    }
  };

  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (file.type === 'application/pdf' || ext === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4 text-green-500" />;
    if (['xlsx', 'xls', 'csv'].includes(ext)) return <FileSpreadsheet className="h-4 w-4 text-emerald-500" />;
    return <File className="h-4 w-4 text-blue-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
          <Upload className="h-5 w-5" />
          อัปโหลดเอกสาร
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-blue-500 bg-blue-100 dark:bg-blue-900 scale-[1.01]'
              : 'border-blue-300 dark:border-blue-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => {
            if (!disabled) document.getElementById('ocr-file-input')?.click();
          }}
        >
          <input
            id="ocr-file-input"
            type="file"
            accept={ACCEPT}
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={disabled}
          />
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900 mb-3">
            <Upload className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
          </p>
          <p className="text-xs text-blue-500/70 dark:text-blue-400/60 mt-1">
            PDF, รูปภาพ (JPG/PNG), Word, Excel, PowerPoint — เลือกได้หลายไฟล์
          </p>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {selectedFiles.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  {getFileIcon(file)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="p-1 hover:bg-background rounded transition-colors shrink-0"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                {selectedFiles.length} ไฟล์ — จะประมวลผลทีละไฟล์ตามคิว
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedFiles([])}
                >
                  ล้างทั้งหมด
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={disabled}
                >
                  เริ่ม OCR ({selectedFiles.length} ไฟล์)
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default OcrUploadCard;
