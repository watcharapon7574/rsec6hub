import React from 'react';
import { Signature } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FileUploader from './FileUploader';

interface SignatureUploadProps {
  signatureUrl?: string | null;
  onSignatureUpload: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onSignatureDelete: () => Promise<void>;
}

const SignatureUpload: React.FC<SignatureUploadProps> = ({
  signatureUrl,
  onSignatureUpload,
  onSignatureDelete
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Signature className="h-5 w-5 mr-2" />
          ลายเซ็นดิจิทัล
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          {signatureUrl ? (
            <img
              src={signatureUrl}
              alt="ลายเซ็น"
              className="max-h-24 mx-auto mb-4 border rounded-lg bg-white p-2"
            />
          ) : (
            <div className="h-24 mx-auto mb-4 bg-muted border rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground text-sm">ไม่มีลายเซ็น</span>
            </div>
          )}
        </div>
        
        <FileUploader
          onFileUpload={onSignatureUpload}
          onFileDelete={onSignatureDelete}
          currentUrl={signatureUrl}
          accept="image/*"
          maxSize={5 * 1024 * 1024} // 5MB
          label="อัปโหลดลายเซ็นดิจิทัล"
          description="รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 5MB สำหรับใช้ในบันทึกข้อความราชการ"
        />
      </CardContent>
    </Card>
  );
};

export default SignatureUpload;