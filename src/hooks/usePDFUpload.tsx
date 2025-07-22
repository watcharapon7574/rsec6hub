import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export const usePDFUpload = () => {
  const { toast } = useToast();
  const [uploadedPdf, setUploadedPdf] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');

  const handleFileUpload = (file: File) => {
    if (file && file.type === 'application/pdf') {
      setUploadedPdf(file);
      setPdfUrl(URL.createObjectURL(file));
      toast({
        title: "อัปโหลดไฟล์สำเร็จ",
        description: "ไฟล์ PDF พร้อมใช้งาน",
      });
    } else {
      toast({
        title: "ไฟล์ไม่ถูกต้อง",
        description: "กรุณาเลือกไฟล์ PDF เท่านั้น",
        variant: "destructive",
      });
    }
  };

  const resetPDFUpload = () => {
    setUploadedPdf(null);
    setPdfUrl('');
  };

  return {
    uploadedPdf,
    pdfUrl,
    handleFileUpload,
    resetPDFUpload
  };
};