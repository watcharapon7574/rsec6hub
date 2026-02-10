
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileUpload: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onFileDelete?: () => Promise<void>;
  currentUrl?: string;
  accept?: string;
  maxSize?: number;
  label: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileUpload,
  onFileDelete,
  currentUrl,
  accept = "image/*",
  maxSize = 10 * 1024 * 1024, // 10MB default
  label,
  description,
  className,
  disabled = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, 'Size:', file.size, 'Type:', file.type);

    // Validate file size
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      setErrorMessage(`ขนาดไฟล์ต้องไม่เกิน ${maxSizeMB}MB`);
      setUploadStatus('error');
      return;
    }

    setUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      console.log('Starting file upload...');
      const result = await onFileUpload(file);
      console.log('Upload result:', result);
      
      if (result.success) {
        setUploadStatus('success');
        console.log('Upload successful, URL:', result.url);
      } else {
        setUploadStatus('error');
        setErrorMessage(result.error || 'เกิดข้อผิดพลาดในการอัปโหลด');
        console.error('Upload failed:', result.error);
      }
    } catch (error: any) {
      setUploadStatus('error');
      setErrorMessage('เกิดข้อผิดพลาดที่ไม่คาดคิด');
      console.error('Upload exception:', error);
    } finally {
      setUploading(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const clearStatus = () => {
    setUploadStatus('idle');
    setErrorMessage('');
  };

  const handleDelete = async () => {
    if (onFileDelete) {
      await onFileDelete();
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        {uploadStatus === 'success' && (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs">อัปโหลดสำเร็จ</span>
          </div>
        )}
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleButtonClick}
          disabled={disabled || uploading}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'กำลังอัปโหลด...' : 'เลือกไฟล์'}
        </Button>

        {currentUrl && (
          <div className="flex items-center gap-2">
            <img
              src={currentUrl}
              alt="Preview"
              className="h-8 w-8 rounded object-cover border"
              onError={(e) => {
                console.error('Error loading image:', currentUrl);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="text-xs text-muted-foreground">รูปปัจจุบัน</span>
            {onFileDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {uploadStatus === 'error' && (
        <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-950 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs">{errorMessage}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearStatus}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
};

export default FileUploader;
