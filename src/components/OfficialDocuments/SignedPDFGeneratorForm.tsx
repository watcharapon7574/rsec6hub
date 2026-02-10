import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { generateSignedPDF, downloadGeneratedPDF, previewPDF } from '@/services/signedPDFService';
import { Upload, Download, Eye, FileText } from 'lucide-react';

const SignedPDFGeneratorForm: React.FC = () => {
  const { toast } = useToast();
  const signatureInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    position: '',
  });
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedPDF, setGeneratedPDF] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // ตรวจสอบประเภทไฟล์
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "ไฟล์ไม่ถูกต้อง",
          description: "กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, JPEG) เท่านั้น",
          variant: "destructive",
        });
        return;
      }
      
      setSignatureFile(file);
      toast({
        title: "อัปโหลดลายเซ็นสำเร็จ",
        description: `ไฟล์: ${file.name}`,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.position || !signatureFile) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณากรอกข้อมูลและเลือกไฟล์ลายเซ็น",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const requestData = {
        name: formData.name,
        position: formData.position,
        signature: signatureFile,
        // เพิ่มฟิลด์อื่นๆ ตามต้องการ
        document_type: 'signed_pdf',
        timestamp: new Date().toISOString(),
      };

      const pdfBlob = await generateSignedPDF(requestData);
      const pdfUrl = previewPDF(pdfBlob);
      
      setGeneratedPDF({
        blob: pdfBlob,
        url: pdfUrl
      });

      toast({
        title: "สร้าง PDF สำเร็จ",
        description: "เอกสาร PDF พร้อมลายเซ็นถูกสร้างเรียบร้อยแล้ว",
      });

    } catch (error) {
      console.error('Generate PDF error:', error);
      
      let errorMessage = "ไม่สามารถสร้าง PDF ได้";
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต";
      } else if (error instanceof Error) {
        errorMessage = `เกิดข้อผิดพลาด: ${error.message}`;
      }
      
      toast({
        title: "เกิดข้อผิดพลาด",
        description: errorMessage,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleDownload = () => {
    if (generatedPDF) {
      const fileName = `signed_${formData.name}_${Date.now()}.pdf`;
      downloadGeneratedPDF(generatedPDF.blob, fileName);
    }
  };

  const handleReset = () => {
    setFormData({ name: '', position: '' });
    setSignatureFile(null);
    setGeneratedPDF(null);
    if (signatureInputRef.current) {
      signatureInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            สร้างเอกสาร PDF พร้อมลายเซ็น
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ-นามสกุล</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="กรอกชื่อ-นามสกุล"
                required
              />
            </div>

            {/* Position Input */}
            <div className="space-y-2">
              <Label htmlFor="position">ตำแหน่ง</Label>
              <Input
                id="position"
                name="position"
                type="text"
                value={formData.position}
                onChange={handleInputChange}
                placeholder="กรอกตำแหน่ง"
                required
              />
            </div>

            {/* Signature Upload */}
            <div className="space-y-2">
              <Label htmlFor="signature">ลายเซ็น</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-4">
                <input
                  ref={signatureInputRef}
                  id="signature"
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="hidden"
                />
                <div className="text-center">
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => signatureInputRef.current?.click()}
                  >
                    เลือกไฟล์ลายเซ็น
                  </Button>
                  {signatureFile && (
                    <p className="mt-2 text-sm text-green-600">
                      ไฟล์: {signatureFile.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    รองรับไฟล์ PNG, JPG, JPEG
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button 
                type="submit" 
                disabled={loading}
                className="flex-1"
              >
                {loading ? 'กำลังสร้าง...' : 'สร้าง PDF'}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={handleReset}
              >
                รีเซ็ต
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* PDF Preview/Download Card */}
      {generatedPDF && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              เอกสาร PDF ที่สร้างแล้ว
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* PDF Preview */}
            <div className="border rounded-lg overflow-hidden">
              <iframe
                src={generatedPDF.url}
                className="w-full h-96"
                title="PDF Preview"
              />
            </div>
            
            {/* Download Button */}
            <div className="flex justify-center">
              <Button onClick={handleDownload} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                ดาวน์โหลด PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SignedPDFGeneratorForm;