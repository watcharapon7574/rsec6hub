import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, Download, Loader2, Zap, Plus, Trash2 } from 'lucide-react';
import { railwayPDFQueue } from '@/utils/requestQueue';
import { railwayFetch } from '@/utils/railwayFetch';

interface SignatureFile {
  key: string;
  file: File;
}

interface SignaturePosition {
  id: string;
  type: 'text' | 'image';
  text?: string;
  file_key?: string;
  x: number;
  y: number;
  page: number;
}

const SinglePDFSignatureForm: React.FC = () => {
  const { toast } = useToast();
  const signature1Ref = useRef<HTMLInputElement>(null);
  const signature2Ref = useRef<HTMLInputElement>(null);
  const pdfFileRef = useRef<HTMLInputElement>(null);
  
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [commentData, setCommentData] = useState({
    signer2_comment: 'เห็นควรอนุมัติ',
    director_comment: 'เห็นชอบ'
  });
  
  const [signatureFiles, setSignatureFiles] = useState<SignatureFile[]>([]);
  const [signaturePositions, setSignaturePositions] = useState<SignaturePosition[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      // ตรวจสอบขนาด A4
      const { validatePdfA4, formatA4ValidationError } = await import('@/utils/validatePdfA4');
      const result = await validatePdfA4(file);
      if (!result.valid) {
        toast({
          title: 'ขนาด PDF ไม่ถูกต้อง',
          description: formatA4ValidationError(result),
          variant: 'destructive',
        });
        return;
      }
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

  const handleSignatureUpload = (key: string) => {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        setSignatureFiles(prev => {
          const filtered = prev.filter(f => f.key !== key);
          return [...filtered, { key, file }];
        });
        toast({
          title: "อัปโหลดลายเซ็นสำเร็จ",
          description: `ไฟล์: ${file.name}`,
        });
      } else {
        toast({
          title: "ไฟล์ไม่ถูกต้อง",
          description: "กรุณาเลือกไฟล์รูปภาพเท่านั้น",
          variant: "destructive",
        });
      }
    };
  };

  const addSignaturePosition = (type: 'text' | 'image', label: string, text?: string, file_key?: string) => {
    const newPosition: SignaturePosition = {
      id: `${type}_${Date.now()}`,
      type,
      text,
      file_key,
      x: Math.floor(Math.random() * 400) + 100, // Random position for demo
      y: Math.floor(Math.random() * 200) + 500,
      page: 0
    };
    
    setSignaturePositions(prev => [...prev, newPosition]);
    toast({
      title: "เพิ่มตำแหน่งแล้ว",
      description: `${label} ที่ตำแหน่ง X:${newPosition.x} Y:${newPosition.y}`,
    });
  };

  const removeSignaturePosition = (id: string) => {
    setSignaturePositions(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pdfFile) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณาอัปโหลดไฟล์ PDF",
        variant: "destructive",
      });
      return;
    }

    if (signatureFiles.length < 2) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณาอัปโหลดลายเซ็นทั้ง 2 ไฟล์",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      
      // Add template data (required by generate_signed_pdf API)
      const templateData = {
        author_name: 'อัปโหลดจากไฟล์ PDF',
        author_position: 'ผู้ใช้งาน',
        signer2_comment: commentData.signer2_comment,
        director_comment: commentData.director_comment,
        name_1: 'ผู้ลงนาม 1',
        position_1: 'ตำแหน่ง 1',
        name_2: 'ผู้ลงนาม 2',
        date: new Date().toLocaleDateString('th-TH'),
        subjeck1: 'เอกสารที่อัปโหลด'
      };
      
      formData.append('template_data', JSON.stringify(templateData));

      // Create signatures array with predefined positions if no custom positions
      let signatures = signaturePositions.length > 0 ? 
        signaturePositions.map(pos => ({
          type: pos.type,
          text: pos.text,
          file_key: pos.file_key,
          x: pos.x,
          y: pos.y,
          page: pos.page
        })) :
        [
          {
            "type": "text",
            "text": `ความคิดเห็น: ${commentData.signer2_comment}`,
            "x": 100,
            "y": 600,
            "page": 0
          },
          {
            "type": "image",
            "file_key": "signature1",
            "x": 100,
            "y": 640,
            "page": 0
          },
          {
            "type": "text",
            "text": `ความคิดเห็น: ${commentData.director_comment}`,
            "x": 300,
            "y": 600,
            "page": 0
          },
          {
            "type": "image",
            "file_key": "signature2",
            "x": 300,
            "y": 640,
            "page": 0
          }
        ];

      formData.append('signatures', JSON.stringify(signatures));

      // Add signature files
      signatureFiles.forEach(sigFile => {
        formData.append(sigFile.key, sigFile.file, sigFile.file.name);
      });

      // Call Railway generate_signed_pdf API with queue + retry logic
      const signedBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const response = await railwayFetch('/generate_signed_pdf', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} - ${errorText}`);
          }

          return await response.blob();
        },
        'Generate Signed PDF (Single)',
        3,
        1000
      );
      
      // Download signed PDF
      const downloadUrl = URL.createObjectURL(signedBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'signed_document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: "สำเร็จ",
        description: "เอกสารลงนามเรียบร้อยแล้ว (Single API)",
      });

    } catch (error) {
      console.error('PDF signature error:', error);
      
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
            <Zap className="h-5 w-5" />
            ฟังก์ชัน 2 — ใช้ API เดียวจบ (Single)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Render + ใส่ลายเซ็น จบในครั้งเดียว (เร็วกว่า)
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PDF Upload */}
            <div className="space-y-2">
              <Label>อัปโหลดไฟล์ PDF (ไม่บังคับ)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6">
                <div className="text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <input
                    ref={pdfFileRef}
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => pdfFileRef.current?.click()}
                  >
                    เลือกไฟล์ PDF (หากมี)
                  </Button>
                  {pdfFile && (
                    <p className="mt-2 text-sm text-green-600 dark:text-green-400 dark:text-green-600">
                      ✓ {pdfFile.name}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    หากไม่เลือกไฟล์ ระบบจะสร้าง PDF จาก Template ด้านล่าง
                  </p>
                </div>
              </div>
            </div>

            {/* Template Data */}
            <div className="space-y-4">
              <Label className="text-base font-medium">ข้อมูลเอกสาร</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="signer2_comment">ความเห็นผู้ลงนาม 1</Label>
                  <Input
                    id="signer2_comment"
                    value={commentData.signer2_comment}
                    onChange={(e) => setCommentData({...commentData, signer2_comment: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="director_comment">ความเห็นผู้ลงนาม 2</Label>
                  <Input
                    id="director_comment"
                    value={commentData.director_comment}
                    onChange={(e) => setCommentData({...commentData, director_comment: e.target.value})}
                  />
                </div>
              </div>
            </div>

            {/* Signature Files */}
            <div className="space-y-4">
              <Label className="text-base font-medium">ไฟล์ลายเซ็น</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ลายเซ็น 1 (signature1)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <div className="text-center">
                      <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <input
                        ref={signature1Ref}
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload('signature1')}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => signature1Ref.current?.click()}
                      >
                        เลือกไฟล์ลายเซ็น 1
                      </Button>
                      {signatureFiles.find(f => f.key === 'signature1') && (
                        <p className="mt-2 text-xs text-green-600 dark:text-green-400 dark:text-green-600">
                          ✓ {signatureFiles.find(f => f.key === 'signature1')?.file.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>ลายเซ็น 2 (signature2)</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    <div className="text-center">
                      <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <input
                        ref={signature2Ref}
                        type="file"
                        accept="image/*"
                        onChange={handleSignatureUpload('signature2')}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => signature2Ref.current?.click()}
                      >
                        เลือกไฟล์ลายเซ็น 2
                      </Button>
                      {signatureFiles.find(f => f.key === 'signature2') && (
                        <p className="mt-2 text-xs text-green-600 dark:text-green-400 dark:text-green-600">
                          ✓ {signatureFiles.find(f => f.key === 'signature2')?.file.name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Manual Position Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">ตำแหน่งลายเซ็น (ไม่บังคับ)</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addSignaturePosition('text', 'ความเห็น 1', `ความคิดเห็น: ${commentData.signer2_comment}`)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    เพิ่มความเห็น 1
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addSignaturePosition('image', 'ลายเซ็น 1', undefined, 'signature1')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    เพิ่มลายเซ็น 1
                  </Button>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSignaturePosition('text', 'ความเห็น 2', `ความคิดเห็น: ${commentData.director_comment}`)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  เพิ่มความเห็น 2
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addSignaturePosition('image', 'ลายเซ็น 2', undefined, 'signature2')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  เพิ่มลายเซ็น 2
                </Button>
              </div>

              {/* Positions List */}
              {signaturePositions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">ตำแหน่งที่กำหนด ({signaturePositions.length})</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {signaturePositions.map((pos) => (
                      <div key={pos.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="text-sm">
                          <div className="font-medium">
                            {pos.type === 'text' ? '📝' : '✍️'} {pos.text || pos.file_key}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            หน้า {pos.page + 1} • X:{pos.x} Y:{pos.y}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSignaturePosition(pos.id)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {signaturePositions.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  หากไม่กำหนดตำแหน่ง ระบบจะใช้ตำแหน่งเริ่มต้น (X:100,300 Y:600,640)
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังสร้าง PDF... (ขั้นตอนเดียว)
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  สร้างและดาวน์โหลด PDF (Single API)
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SinglePDFSignatureForm;