import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { FileText, ArrowLeft, Upload, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PDFFormData {
  date: string;
  subject: string;
  pdfFile: File | null;
}

const PDFSignaturePage = () => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PDFFormData>({
    date: new Date().toISOString().split('T')[0],
    subject: '',
    pdfFile: null
  });

  const handleInputChange = (field: keyof Omit<PDFFormData, 'pdfFile'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: "รูปแบบไฟล์ไม่ถูกต้อง",
          description: "กรุณาเลือกไฟล์ PDF เท่านั้น",
          variant: "destructive",
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({
          title: "ไฟล์ขนาดใหญ่เกินไป",
          description: "กรุณาเลือกไฟล์ที่มีขนาดไม่เกิน 10MB",
          variant: "destructive",
        });
        return;
      }
      setFormData(prev => ({
        ...prev,
        pdfFile: file
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.user_id) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่พบข้อมูลผู้ใช้",
        variant: "destructive",
      });
      return;
    }

    if (!formData.pdfFile) {
      toast({
        title: "กรุณาเลือกไฟล์",
        description: "กรุณาเลือกไฟล์ PDF ที่ต้องการอัพโหลด",
        variant: "destructive",
      });
      return;
    }

    if (!formData.subject.trim()) {
      toast({
        title: "กรุณากรอกเรื่อง",
        description: "กรุณากรอกเรื่องของเอกสาร",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Upload PDF to Supabase Storage first
      // Generate safe filename (URL safe, no Thai characters)
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const fileName = `pdf_upload_${timestamp}_${randomId}.pdf`;
      const filePath = `memos/${profile.user_id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, formData.pdfFile, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Create memo record in database
      const { data: memoData, error: memoError } = await supabase
        .from('memos')
        .insert({
          doc_number: '', // Add empty doc_number to satisfy not-null constraint
          subject: formData.subject,
          date: formData.date,
          author_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'ไม่ระบุชื่อ',
          author_position: profile.current_position || profile.job_position || profile.position || 'ไม่ระบุตำแหน่ง',
          user_id: profile.user_id,
          pdf_draft_path: publicUrl,
          status: 'draft',
          current_signer_order: 1,
          form_data: {
            type: 'pdf_upload',
            original_filename: formData.pdfFile.name,
            subject_text: formData.subject,
            upload_date: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (memoError) {
        // Clean up uploaded file if memo creation fails
        await supabase.storage
          .from('documents')
          .remove([filePath]);
        throw new Error(`Failed to create memo: ${memoError.message}`);
      }

      toast({
        title: "อัพโหลดสำเร็จ",
        description: "ไฟล์ PDF ได้ถูกอัพโหลดและสร้างเป็นเอกสารแล้ว",
      });

      navigate('/documents');
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถอัพโหลดไฟล์ได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Loading Modal */}
      <Dialog open={loading}>
        <DialogContent className="bg-white p-6 rounded-lg shadow-lg">
          <DialogTitle>กำลังอัพโหลดไฟล์</DialogTitle>
          <DialogDescription>
            กรุณาอย่าปิดหน้านี้จนกว่ากระบวนการจะเสร็จสมบูรณ์
          </DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="text-lg font-medium">ระบบกำลังอัพโหลดไฟล์...</div>
            <Progress value={100} />
          </div>
        </DialogContent>
      </Dialog>
      {/* End Loading Modal */}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2 hover:bg-white border-gray-200 text-gray-600 bg-white shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              ย้อนกลับ
            </Button>
          </div>

          {/* Header Card */}
          <Card className="mb-8 overflow-hidden shadow-xl border-0">
            <CardHeader className="relative bg-gradient-to-br from-green-400 via-green-500 to-green-600 text-white py-12">
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                  backgroundImage: `radial-gradient(circle at 20px 20px, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                  backgroundSize: '40px 40px'
                }}></div>
              </div>
              
              <div className="relative z-10 text-center">
                {/* Icon Container */}
                <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-lg">
                  <Upload className="w-10 h-10 text-white" />
                </div>
                
                {/* Title */}
                <h1 className="text-3xl font-bold mb-3 tracking-tight">
                  อัพโหลด PDF สำหรับลงนาม
                </h1>
                
                {/* Subtitle */}
                <p className="text-green-100 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                  อัพโหลดไฟล์ PDF ที่มีอยู่แล้วเพื่อนำเข้าสู่ระบบจัดการเอกสาร
                </p>
              </div>
              
              {/* Bottom Wave */}
              <div className="absolute bottom-0 left-0 right-0">
                <svg className="w-full h-6 text-white" fill="currentColor" viewBox="0 0 1200 120" preserveAspectRatio="none">
                  <path d="M0,0V7.23C0,65.52,268.63,112.77,600,112.77S1200,65.52,1200,7.23V0Z"></path>
                </svg>
              </div>
            </CardHeader>
          </Card>

          <form onSubmit={handleSubmit}>
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100 rounded-t-lg">
                <CardTitle className="text-xl text-gray-800 font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  ข้อมูลเอกสาร PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {/* PDF Upload Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    อัพโหลดไฟล์ PDF
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="pdf_file" className="text-sm font-medium text-gray-700">
                        เลือกไฟล์ PDF *
                      </Label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <Input
                          id="pdf_file"
                          type="file"
                          accept=".pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <Label 
                          htmlFor="pdf_file"
                          className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                        >
                          เลือกไฟล์ PDF
                        </Label>
                        <p className="text-sm text-gray-500 mt-2">
                          รองรับไฟล์ PDF เท่านั้น (ขนาดไม่เกิน 10MB)
                        </p>
                      </div>
                      {formData.pdfFile && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-green-800">
                              ไฟล์ที่เลือก: {formData.pdfFile.name}
                            </span>
                          </div>
                          <p className="text-xs text-green-600 mt-1">
                            ขนาด: {(formData.pdfFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Document Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    ข้อมูลพื้นฐาน
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-sm font-medium text-gray-700">
                        วันที่ *
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange('date', e.target.value)}
                        required
                        className="border-gray-300 focus:border-green-500 focus:ring-green-500/20 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-medium text-gray-700">
                        เรื่อง *
                      </Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                        required
                        placeholder="ระบุเรื่องของเอกสาร PDF"
                        className="border-gray-300 focus:border-green-500 focus:ring-green-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Author Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    ข้อมูลผู้อัพโหลด
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="author_name" className="text-sm font-medium text-gray-700">
                        ชื่อผู้อัพโหลด *
                      </Label>
                      <Input
                        id="author_name"
                        value={profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''}
                        disabled
                        className="bg-gray-50 text-gray-600 cursor-not-allowed border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author_position" className="text-sm font-medium text-gray-700">
                        ตำแหน่งผู้อัพโหลด *
                      </Label>
                      <Input
                        id="author_position"
                        value={profile?.current_position || profile?.job_position || profile?.position || ''}
                        disabled
                        className="bg-gray-50 text-gray-600 cursor-not-allowed border-gray-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Notice Section */}
                <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-800 mb-2">ข้อมูลสำคัญ</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• ไฟล์ PDF ที่อัพโหลดจะถูกนำเข้าสู่ระบบจัดการเอกสาร</li>
                        <li>• หลังจากอัพโหลดเสร็จ ธุรการจะสามารถจัดการและกำหนดเส้นทางการอนุมัติได้</li>
                        <li>• เอกสารจะอยู่ในสถานะ "ฉบับร่าง" จนกว่าจะถูกส่งเข้าสู่กระบวนการอนุมัติ</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-gray-200">
                  <Button 
                    type="submit" 
                    disabled={loading || !formData.pdfFile || !formData.subject.trim()}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'กำลังอัพโหลด...' : 'อัพโหลดเอกสาร'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => navigate('/documents')}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-8 py-2 rounded-lg transition-all duration-200"
                    disabled={loading}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
      <div className="h-10" />
    </div>
  );
};

export default PDFSignaturePage;