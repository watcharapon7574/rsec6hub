import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { generateSignedPDF, downloadGeneratedPDF } from '@/services/signedPDFService';
import { Upload, FileText, Plus, X, Download } from 'lucide-react';

interface SignatureFile {
  id: string;
  file: File;
  key: string;
}

const defaultSignatures = [
  {
    "type": "text",
    "page": 0,
    "x": 100,
    "y": 500,
    "text": "เห็นชอบแล้ว",
    "color": [2, 53, 139]
  },
  {
    "type": "image",
    "page": 0,
    "x": 100,
    "y": 600,
    "file_key": "sig1"
  }
];

const ManualPDFSignatureForm: React.FC = () => {
  const { toast } = useToast();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [signatureFiles, setSignatureFiles] = useState<SignatureFile[]>([]);
  const [signaturesJson, setSignaturesJson] = useState<string>(
    JSON.stringify(defaultSignatures, null, 2)
  );
  const [loading, setLoading] = useState(false);

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      toast({
        title: "อัปโหลด PDF สำเร็จ",
        description: `ไฟล์: ${file.name}`,
      });
    } else {
      toast({
        title: "ไฟล์ไม่ถูกต้อง",
        description: "กรุณาเลือกไฟล์ PDF เท่านั้น",
        variant: "destructive",
      });
    }
  };

  const addSignatureFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const id = Date.now().toString();
        const key = `sig${signatureFiles.length + 1}`;
        const newSignatureFile: SignatureFile = {
          id,
          file,
          key
        };
        setSignatureFiles(prev => [...prev, newSignatureFile]);
        toast({
          title: "เพิ่มไฟล์ลายเซ็นสำเร็จ",
          description: `ไฟล์: ${file.name} (key: ${key})`,
        });
      }
    };
    input.click();
  };

  const removeSignatureFile = (id: string) => {
    setSignatureFiles(prev => prev.filter(file => file.id !== id));
  };

  const validateAndParseSignatures = (): any[] | null => {
    try {
      const parsed = JSON.parse(signaturesJson);
      if (!Array.isArray(parsed)) {
        throw new Error('Signatures ต้องเป็น array');
      }
      
      // ตรวจสอบโครงสร้างแต่ละ signature
      for (const sig of parsed) {
        if (!sig.type || !['text', 'image'].includes(sig.type)) {
          throw new Error('type ต้องเป็น "text" หรือ "image"');
        }
        if (typeof sig.page !== 'number' || typeof sig.x !== 'number' || typeof sig.y !== 'number') {
          throw new Error('page, x, y ต้องเป็นตัวเลข');
        }
        if (sig.type === 'text' && !sig.text) {
          throw new Error('signature แบบ text ต้องมี field "text"');
        }
        if (sig.type === 'image' && !sig.file_key) {
          throw new Error('signature แบบ image ต้องมี field "file_key"');
        }
      }
      
      return parsed;
    } catch (error) {
      toast({
        title: "JSON ไม่ถูกต้อง",
        description: error instanceof Error ? error.message : "กรุณาตรวจสอบรูปแบบ JSON",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pdfFile) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณาเลือกไฟล์ PDF",
        variant: "destructive",
      });
      return;
    }

    const signatures = validateAndParseSignatures();
    if (!signatures) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      formData.append('signatures', JSON.stringify(signatures));
      
      // เพิ่มไฟล์ลายเซ็น
      signatureFiles.forEach(sigFile => {
        formData.append(sigFile.key, sigFile.file, sigFile.file.name);
      });

      // เรียก API
      const response = await fetch('https://pdf-memo-docx-production.up.railway.app/add_signature', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const signedBlob = await response.blob();
      downloadGeneratedPDF(signedBlob, `signed_${pdfFile.name}`);

      toast({
        title: "สำเร็จ",
        description: "เอกสารลงนามเรียบร้อยแล้ว",
      });

      // รีเซ็ตฟอร์ม
      setPdfFile(null);
      setSignatureFiles([]);
      setSignaturesJson(JSON.stringify(defaultSignatures, null, 2));
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Submit error:', error);
      
      let errorMessage = "ไม่สามารถสร้างเอกสารลงนามได้";
      
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่";
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            ฟอร์มลงนาม PDF แบบ Manual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PDF Upload */}
            <div className="space-y-2">
              <Label htmlFor="pdf">ไฟล์ PDF *</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <input
                    ref={pdfInputRef}
                    id="pdf"
                    name="pdf"
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    เลือกไฟล์ PDF
                  </Button>
                  {pdfFile && (
                    <p className="mt-2 text-sm text-green-600">
                      ไฟล์: {pdfFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Signature Files */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>ไฟล์ลายเซ็น</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addSignatureFile}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  เพิ่มไฟล์ลายเซ็น
                </Button>
              </div>
              
              {signatureFiles.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  ยังไม่มีไฟล์ลายเซ็น
                </div>
              ) : (
                <div className="space-y-2">
                  {signatureFiles.map((sigFile) => (
                    <div
                      key={sigFile.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{sigFile.file.name}</p>
                        <p className="text-sm text-gray-600">Key: {sigFile.key}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSignatureFile(sigFile.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Signatures JSON */}
            <div className="space-y-2">
              <Label htmlFor="signatures">Signatures JSON *</Label>
              <Textarea
                id="signatures"
                name="signatures"
                value={signaturesJson}
                onChange={(e) => setSignaturesJson(e.target.value)}
                placeholder="กรอก JSON สำหรับกำหนดตำแหน่งลายเซ็น"
                rows={15}
                className="font-mono text-sm"
              />
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>โครงสร้าง JSON:</strong></p>
                <p>• type: "text" หรือ "image"</p>
                <p>• page: หมายเลขหน้า (เริ่มจาก 0)</p>
                <p>• x, y: ตำแหน่งพิกัด</p>
                <p>• text: ข้อความ (สำหรับ type: "text")</p>
                <p>• file_key: key ของไฟล์ลายเซ็น (สำหรับ type: "image")</p>
                <p>• color: สี RGB array (สำหรับ type: "text")</p>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {loading ? 'กำลังสร้าง PDF...' : 'สร้างและดาวน์โหลด PDF'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Example JSON */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">ตัวอย่าง JSON</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
{`[
  {
    "type": "text",
    "page": 0,
    "x": 100,
    "y": 500,
    "text": "เห็นชอบแล้ว",
    "color": [2, 53, 139]
  },
  {
    "type": "image",
    "page": 0,
    "x": 100,
    "y": 600,
    "file_key": "sig1"
  }
]`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManualPDFSignatureForm;