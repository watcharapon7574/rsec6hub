import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate, useParams } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { MemoFormData } from '@/types/memo';
import { FileText, ArrowLeft, Sparkles, Eye, ChevronDown, ChevronUp, ClipboardCheck, AlertCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { formatThaiDateFull } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAllMemos } from '@/hooks/useAllMemos';
import { railwayPDFQueue } from '@/utils/requestQueue';

const EditReportMemoPage = () => {
  const navigate = useNavigate();
  const { memoId } = useParams<{ memoId: string }>();
  const { profile } = useEmployeeAuth();
  const { getMemoById, refetch } = useAllMemos();
  const { toast } = useToast();

  const [originalMemo, setOriginalMemo] = useState<any>(null);
  const [loadingMemo, setLoadingMemo] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSpecialCharHelp, setShowSpecialCharHelp] = useState(false);

  // Preview PDF state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  // Rejection info
  const [rejectionInfo, setRejectionInfo] = useState<{
    name: string;
    comment: string;
    rejected_at: string;
    position?: string;
  } | null>(null);

  const [formData, setFormData] = useState<MemoFormData>({
    doc_number: '',
    date: new Date().toISOString().split('T')[0],
    subject: '',
    attachment_title: '',
    introduction: '',
    author_name: profile ? `${profile.first_name} ${profile.last_name}` : '',
    author_position: profile?.current_position || profile?.job_position || profile?.position || '',
    fact: '',
    proposal: '',
    attached_files: []
  });

  // Load memo for editing
  useEffect(() => {
    const loadMemo = async () => {
      if (!memoId) {
        toast({
          title: 'ไม่พบเอกสาร',
          description: 'กรุณาเลือกเอกสารที่ต้องการแก้ไข',
          variant: 'destructive'
        });
        navigate('/documents');
        return;
      }

      setLoadingMemo(true);
      try {
        // Try to get from hook first
        let memo = getMemoById ? getMemoById(memoId) : null;

        // If not found, fetch directly
        if (!memo) {
          const { data, error } = await supabase
            .from('memos')
            .select('*')
            .eq('id', memoId)
            .single();

          if (error) throw error;
          memo = data as any;
        }

        if (!memo) {
          throw new Error('Memo not found');
        }

        setOriginalMemo(memo);

        // Parse form_data if it exists
        let parsedFormData: any = {};
        if (memo.form_data) {
          if (typeof memo.form_data === 'string') {
            try {
              parsedFormData = JSON.parse(memo.form_data);
            } catch {
              parsedFormData = {};
            }
          } else {
            parsedFormData = memo.form_data;
          }
        }

        // Set form data from memo
        setFormData({
          doc_number: memo.doc_number || '',
          date: memo.date || new Date().toISOString().split('T')[0],
          subject: memo.subject || '',
          attachment_title: memo.attachment_title || '',
          introduction: parsedFormData.introduction || memo.introduction || '',
          author_name: memo.author_name || (profile ? `${profile.first_name} ${profile.last_name}` : ''),
          author_position: memo.author_position || profile?.current_position || profile?.job_position || profile?.position || '',
          fact: parsedFormData.fact || '',
          proposal: parsedFormData.proposal || '',
          attached_files: []
        });

        // Get rejection info
        if (memo.rejected_name_comment) {
          setRejectionInfo(memo.rejected_name_comment);
        }

      } catch (error) {
        console.error('Error loading memo:', error);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถโหลดข้อมูลเอกสารได้',
          variant: 'destructive'
        });
        navigate('/documents');
      } finally {
        setLoadingMemo(false);
      }
    };

    loadMemo();
  }, [memoId, getMemoById, navigate, toast, profile]);

  // Format Thai date for PDF
  const formatThaiDate = (dateString: string) => {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const date = new Date(dateString);
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  };

  // Regenerate PDF with updated content
  const regeneratePdf = async (): Promise<string | null> => {
    try {
      // Prepare JSON data matching the /pdf endpoint format
      const pdfData = {
        doc_number: '', // Will be assigned by clerk
        date: formatThaiDate(formData.date),
        subject: formData.subject || '',
        attachment_title: formData.attachment_title || '',
        introduction: formData.introduction || '',
        fact: formData.fact || '',
        proposal: formData.proposal || '',
        author_name: formData.author_name || '',
        author_position: formData.author_position || ''
      };

      console.log('📄 Regenerating PDF for report memo...', pdfData);

      const pdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const response = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/pdf',
            },
            mode: 'cors',
            credentials: 'omit',
            body: JSON.stringify(pdfData)
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`PDF generation failed: ${errorText}`);
          }
          return await response.blob();
        },
        'Regenerate Report Memo PDF',
        3,
        1000
      );

      // Upload to Supabase Storage
      const timestamp = Date.now();
      const fileName = `report_memo_${memoId}_${timestamp}.pdf`;
      const filePath = `memos/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      console.log('✅ PDF regenerated and uploaded:', publicUrl);
      return publicUrl;

    } catch (error) {
      console.error('Error regenerating PDF:', error);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!memoId || !originalMemo) {
      toast({
        title: 'ไม่พบข้อมูลเอกสาร',
        description: 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Regenerate PDF
      const newPdfUrl = await regeneratePdf();
      if (!newPdfUrl) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถสร้าง PDF ใหม่ได้',
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }

      // Prepare form_data (include all fields + type for consistency with CreateMemoPage)
      const updatedFormData = {
        ...formData,
        type: 'create_memo',
        introduction: formData.introduction,
        fact: formData.fact,
        proposal: formData.proposal
      };

      // Update memo in database (include all content columns to keep them in sync)
      const { error: updateError } = await supabase
        .from('memos')
        .update({
          subject: formData.subject,
          date: formData.date,
          attachment_title: formData.attachment_title,
          introduction: formData.introduction,
          author_name: formData.author_name,
          author_position: formData.author_position,
          fact: formData.fact,
          proposal: formData.proposal,
          form_data: updatedFormData,
          pdf_draft_path: newPdfUrl,
          status: 'draft',
          current_signer_order: 1,
          doc_number: null, // Clear doc_number for re-assignment
          rejected_name_comment: null, // Clear rejection info
          updated_at: new Date().toISOString()
        })
        .eq('id', memoId);

      if (updateError) {
        throw updateError;
      }

      // Refetch memos
      if (refetch) {
        await refetch();
      }

      toast({
        title: 'แก้ไขสำเร็จ',
        description: 'บันทึกข้อความรายงานผลถูกแก้ไขเรียบร้อยแล้ว รอธุรการจัดการต่อ',
      });

      navigate('/documents');

    } catch (error) {
      console.error('Error updating memo:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกการแก้ไขได้',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof MemoFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Generate preview
  const generatePreview = async () => {
    setPreviewLoading(true);
    try {
      // Prepare JSON data matching the /pdf endpoint format
      const pdfData = {
        doc_number: '',
        date: formatThaiDate(formData.date),
        subject: formData.subject || '',
        attachment_title: formData.attachment_title || '',
        introduction: formData.introduction || '',
        fact: formData.fact || '',
        proposal: formData.proposal || '',
        author_name: formData.author_name || '',
        author_position: formData.author_position || ''
      };

      const pdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const response = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/pdf',
            },
            mode: 'cors',
            credentials: 'omit',
            body: JSON.stringify(pdfData)
          });
          if (!response.ok) {
            throw new Error('Preview generation failed');
          }
          return await response.blob();
        },
        'Preview Report Memo PDF',
        2,
        1000
      );

      const url = URL.createObjectURL(pdfBlob);
      setPreviewUrl(url);
      setPreviewBlob(pdfBlob);

    } catch (error) {
      console.error('Error generating preview:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถสร้างตัวอย่าง PDF ได้',
        variant: 'destructive'
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loadingMemo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-teal-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/documents')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              กลับ
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-foreground">แก้ไขบันทึกข้อความรายงานผล</h1>
              <p className="text-sm text-muted-foreground">แก้ไขเอกสารที่ถูกตีกลับ</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Rejection Info Card */}
        {rejectionInfo && (
          <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
            <CardHeader className="bg-red-100 dark:bg-red-900 border-b border-red-200 dark:border-red-800">
              <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                เหตุผลที่ถูกตีกลับ
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              <div><span className="font-medium">ตีกลับโดย:</span> {rejectionInfo.name}</div>
              {rejectionInfo.position && (
                <div><span className="font-medium">ตำแหน่ง:</span> {rejectionInfo.position}</div>
              )}
              <div><span className="font-medium">เหตุผล:</span> {rejectionInfo.comment}</div>
              {rejectionInfo.rejected_at && (
                <div><span className="font-medium">เมื่อ:</span> {new Date(rejectionInfo.rejected_at).toLocaleString('th-TH')}</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Header Card */}
        <Card className="mb-8 overflow-hidden shadow-xl border-0">
          <CardHeader className="relative bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 text-white py-12">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `radial-gradient(circle at 20px 20px, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }}></div>
            </div>

            <div className="relative z-10 text-center">
              <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6 border border-white/20 shadow-lg">
                <ClipboardCheck className="w-10 h-10 text-white" />
              </div>

              <h1 className="text-3xl font-bold mb-3 tracking-tight">
                แก้ไขบันทึกข้อความรายงานผล
              </h1>

              <p className="text-blue-100 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                แก้ไขเอกสารตามข้อเสนอแนะและส่งใหม่
              </p>
            </div>

            <div className="absolute bottom-0 left-0 right-0">
              <svg className="w-full h-6 text-white" fill="currentColor" viewBox="0 0 1200 120" preserveAspectRatio="none">
                <path d="M0,0V7.23C0,65.52,268.63,112.77,600,112.77S1200,65.52,1200,7.23V0Z"></path>
              </svg>
            </div>
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit}>
          <Card className="shadow-lg border-0 bg-card">
            <CardHeader className="bg-muted/50 dark:bg-background/50 border-b border-border rounded-t-lg">
              <CardTitle className="text-xl text-foreground font-semibold flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                ข้อมูลรายงาน
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {/* Basic Information */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                  ข้อมูลพื้นฐาน
                </h3>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-sm font-medium">วันที่ *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      required
                      className="border-border focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Subject */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">เรื่อง</h3>
                <Input
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  required
                  placeholder="ระบุเรื่องที่รายงาน"
                  className="border-border focus:border-blue-500"
                />
              </div>

              {/* Additional Info */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">ข้อมูลเพิ่มเติม</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="attachment_title">สิ่งที่ส่งมาด้วย</Label>
                    <Input
                      id="attachment_title"
                      value={formData.attachment_title}
                      onChange={(e) => handleInputChange('attachment_title', e.target.value)}
                      placeholder="ระบุเอกสารแนบ (ถ้ามี)"
                      className="border-border focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="introduction">ต้นเรื่อง</Label>
                    <Textarea
                      id="introduction"
                      value={formData.introduction}
                      onChange={(e) => handleInputChange('introduction', e.target.value)}
                      rows={3}
                      placeholder="ข้อความเปิดหรือบริบทของรายงาน"
                      className="border-border focus:border-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Author Info */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">ข้อมูลผู้รายงาน</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="author_name">ชื่อผู้รายงาน *</Label>
                    <Input id="author_name" value={formData.author_name} disabled className="bg-muted cursor-not-allowed" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="author_position">ตำแหน่ง *</Label>
                    <Input id="author_position" value={formData.author_position} disabled className="bg-muted cursor-not-allowed" />
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">เนื้อหารายงาน</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="fact">ข้อเท็จจริง / ผลการดำเนินการ</Label>
                    <Textarea
                      id="fact"
                      value={formData.fact}
                      onChange={(e) => handleInputChange('fact', e.target.value)}
                      rows={6}
                      placeholder="รายงานผลการปฏิบัติงาน สิ่งที่ดำเนินการแล้ว ผลลัพธ์ที่ได้..."
                      className="border-border focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="proposal">ข้อเสนอ / สรุป</Label>
                    <Textarea
                      id="proposal"
                      value={formData.proposal}
                      onChange={(e) => handleInputChange('proposal', e.target.value)}
                      rows={4}
                      placeholder="ข้อเสนอแนะ สรุปผล หรือแนวทางต่อไป..."
                      className="border-border focus:border-blue-500 resize-none"
                    />
                  </div>

                  {/* Special Character Help */}
                  <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() => setShowSpecialCharHelp(!showSpecialCharHelp)}
                    >
                      <span>
                        <span className="font-semibold">เครื่องหมายพิเศษ:</span>{' '}
                        พิมพ์ <code className="bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded font-bold">!</code> เพื่อขึ้นบรรทัดใหม่
                      </span>
                      {showSpecialCharHelp ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                    {showSpecialCharHelp && (
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-1">
                        <p><code className="bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded font-bold">!!</code> = ขึ้นบรรทัดใหม่ 2 ครั้ง</p>
                        <p><code className="bg-blue-200 dark:bg-blue-800 px-1.5 py-0.5 rounded font-bold">!!!</code> = ขึ้นบรรทัดใหม่ 3 ครั้ง</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6 border-t border-border">
                <Button
                  type="submit"
                  disabled={isSubmitting || previewLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2 rounded-lg shadow-md"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={generatePreview}
                  disabled={isSubmitting || previewLoading}
                  className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
                >
                  {previewLoading ? (
                    <><svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>กำลังสร้าง...</>
                  ) : (
                    <><Eye className="h-4 w-4 mr-2" />ดูตัวอย่าง</>
                  )}
                </Button>
                <div className="flex-1"></div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/documents')}
                  className="border-border hover:bg-muted"
                  disabled={isSubmitting}
                >
                  ยกเลิก
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        {/* PDF Preview */}
        {previewUrl && (
          <Card className="mt-8 shadow-lg border-0 bg-card">
            <CardHeader className="bg-blue-50 dark:bg-blue-950 border-b border-blue-100 dark:border-blue-900 rounded-t-lg">
              <CardTitle className="text-xl font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                    <Eye className="w-4 h-4 text-blue-600" />
                  </div>
                  ตัวอย่าง PDF
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                    }
                    setPreviewUrl(null);
                    setPreviewBlob(null);
                  }}
                >
                  ปิด
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                src={previewUrl}
                className="w-full h-[600px] border-0"
                title="PDF Preview"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Loading Dialog */}
      <Dialog open={isSubmitting}>
        <DialogContent>
          <DialogTitle>กำลังบันทึกการแก้ไข</DialogTitle>
          <DialogDescription>
            ระบบกำลังสร้าง PDF และบันทึกข้อมูล กรุณารอสักครู่...
          </DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <AnimatedProgress />
          </div>
        </DialogContent>
      </Dialog>

      {/* Spacer for FloatingNavbar */}
      <div className="h-32" />
    </div>
  );
};

export default EditReportMemoPage;
