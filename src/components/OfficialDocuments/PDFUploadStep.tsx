import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface PDFUploadStepProps {
  uploadedPdf: File | null;
  onFileUpload: (file: File) => void;
}

const PDFUploadStep: React.FC<PDFUploadStepProps> = ({ uploadedPdf, onFileUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          อัปโหลด PDF
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">เลือกไฟล์ PDF ที่ต้องการลงนาม</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
          >
            เลือกไฟล์ PDF
          </Button>
          {uploadedPdf && (
            <p className="mt-4 text-sm text-green-600">
              ไฟล์: {uploadedPdf.name}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PDFUploadStep;