import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { FileText, ArrowLeft, Upload, AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { railwayPDFQueue } from '@/utils/requestQueue';

interface PDFFormData {
  date: string;
  subject: string;
  docNumber: string;
  pdfFile: File | null;
}

const PDFSignaturePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editDocId = searchParams.get('edit');
  const { profile, getPermissions } = useEmployeeAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [isEditMode, setIsEditMode] = useState(!!editDocId);
  const [originalDoc, setOriginalDoc] = useState<any>(null);
  const [rejectionComment, setRejectionComment] = useState<any>(null);
  const [formData, setFormData] = useState<PDFFormData>({
    date: new Date().toISOString().split('T')[0],
    subject: '',
    docNumber: '',
    pdfFile: null
  });
  const [suggestedDocNumber, setSuggestedDocNumber] = useState<string>('');

  // ตรวจสอบสิทธิ์ - เฉพาะธุรการเท่านั้น
  const permissions = getPermissions();

  // Fetch suggested doc number on mount
  useEffect(() => {
    const fetchSuggestedDocNumber = async () => {
      try {
        const currentYear = new Date().getFullYear() + 543; // Thai Buddhist year

        // Get max doc_number for current year
        const { data: existingDocs, error: fetchError } = await (supabase as any)
          .from('doc_receive')
          .select('doc_number')
          .ilike('doc_number', `${currentYear}/%`)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching existing docs:', fetchError);
          return;
        }

        // Extract max number
        let maxNumber = 0;
        if (existingDocs && existingDocs.length > 0) {
          for (const doc of existingDocs) {
            const match = doc.doc_number.match(/\/(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxNumber) maxNumber = num;
            }
          }
        }

        const nextNumber = maxNumber + 1;
        const suggested = `${currentYear}/${nextNumber.toString().padStart(3, '0')}`;
        setSuggestedDocNumber(suggested);
      } catch (error) {
        console.error('Error fetching suggested doc number:', error);
      }
    };

    fetchSuggestedDocNumber();
  }, []);

  // Load doc_receive data for edit mode
  useEffect(() => {
    const loadDocForEdit = async () => {
      if (editDocId && !originalDoc) {
        setLoadingDoc(true);
        try {
          const { data: doc, error } = await (supabase as any)
            .from('doc_receive')
            .select('*')
            .eq('id', editDocId)
            .single();

          if (error) throw error;

          if (doc) {
            setOriginalDoc(doc);
            setIsEditMode(true);

            // Pre-fill form data
            setFormData({
              date: doc.date || new Date().toISOString().split('T')[0],
              subject: doc.subject || '',
              docNumber: doc.doc_number ? doc.doc_number.split('/')[1] || '' : '',
              pdfFile: null
            });

            // Load rejection comment if exists
            if (doc.rejected_name_comment) {
              try {
                let rejectedData = doc.rejected_name_comment;
                if (typeof rejectedData === 'string') {
                  rejectedData = JSON.parse(rejectedData);
                }
                setRejectionComment(rejectedData);
              } catch (e) {
                console.error('Error parsing rejected_name_comment:', e);
              }
            }
          }
        } catch (error) {
          console.error('Error loading doc_receive for edit:', error);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถโหลดข้อมูลเอกสารได้",
            variant: "destructive",
          });
          navigate('/documents');
        }
        setLoadingDoc(false);
      }
    };

    loadDocForEdit();
  }, [editDocId, originalDoc, navigate, toast]);

  // Redirect ถ้าไม่ใช่ธุรการหรือ admin
  useEffect(() => {
    if (profile && !permissions.isAdmin && permissions.position !== 'clerk_teacher') {
      toast({
        title: "ไม่มีสิทธิ์เข้าถึง",
        description: "เฉพาะธุรการหรือผู้ดูแลระบบเท่านั้นที่สามารถใช้ระบบหนังสือรับได้",
        variant: "destructive",
      });
      navigate('/documents');
      return;
    }
  }, [profile, permissions.isAdmin, permissions.position, navigate, toast]);

  // แสดง loading ขณะตรวจสอบสิทธิ์
  if (!profile || (!permissions.isAdmin && permissions.position !== 'clerk_teacher')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="p-8 rounded-lg animate-pulse">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4 text-center">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: keyof Omit<PDFFormData, 'pdfFile'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getDocNumberValue = () => {
    const currentYear = new Date().getFullYear() + 543;
    // If user typed something, use it. Otherwise use suggested number
    const numPart = formData.docNumber || getSuggestedNumber();
    return `${currentYear}/${numPart}`;
  };

  const getSuggestedNumber = () => {
    if (!suggestedDocNumber) return '';
    // Extract just the number part from suggested (e.g., "2568/001" -> "001")
    const match = suggestedDocNumber.match(/\/(\d+)$/);
    return match ? match[1] : '';
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

    // ในโหมดแก้ไข ต้องอัปโหลดไฟล์ใหม่
    if (!formData.pdfFile) {
      toast({
        title: "กรุณาเลือกไฟล์",
        description: isEditMode ? "กรุณาเลือกไฟล์ PDF ใหม่เพื่อแก้ไข" : "กรุณาเลือกไฟล์ PDF ที่ต้องการอัพโหลด",
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
      // Step 1: Get document number (from form or suggested)
      const documentNumber = getDocNumberValue().trim();

      if (!documentNumber) {
        toast({
          title: "กรุณากรอกเลขรับ",
          description: "กรุณากรอกเลขรับเอกสาร",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      console.log('📋 Using document number:', documentNumber);

      // Step 2: Upload PDF to Supabase Storage
      console.log('📤 Uploading PDF to storage...');
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
      console.log('✅ PDF uploaded to:', publicUrl);

      // Step 3: Call /receive_num API to stamp PDF
      console.log('🎨 Calling /receive_num API to stamp PDF...');
      const now = new Date();
      const thaiDate = now.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: '2-digit'
      });
      const thaiTime = now.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) + ' น.';

      // Fetch the uploaded PDF
      const pdfRes = await fetch(publicUrl);
      const pdfBlob = await pdfRes.blob();

      // Prepare FormData for /receive_num API
      const receiveNumFormData = new FormData();
      receiveNumFormData.append('pdf', pdfBlob, 'document.pdf');

      const payload = {
        page: 0,
        color: [2, 53, 139],
        register_no: documentNumber,
        date: thaiDate,
        time: thaiTime,
        receiver: `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
      };
      receiveNumFormData.append('payload', JSON.stringify(payload));

      console.log('📝 Stamp payload:', payload);

      // Call Railway receive_num API with queue + retry logic
      const stampedPdfBlob = await railwayPDFQueue.enqueueWithRetry(
        async () => {
          const stampRes = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/receive_num', {
            method: 'POST',
            body: receiveNumFormData
          });

          if (!stampRes.ok) {
            const errorText = await stampRes.text();
            console.error('❌ /receive_num API error:', errorText);
            throw new Error(`Failed to stamp PDF: ${errorText}`);
          }

          const blob = await stampRes.blob();
          console.log('✅ PDF stamped successfully, size:', blob.size);
          return blob;
        },
        'Receive Number Stamp',
        3,
        1000
      );

      // Step 4: Overwrite the original file with stamped PDF
      console.log('🔄 Overwriting original PDF with stamped version...');
      const { error: updateError } = await supabase.storage
        .from('documents')
        .update(filePath, stampedPdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (updateError) {
        throw new Error(`Failed to update PDF: ${updateError.message}`);
      }
      console.log('✅ PDF overwritten successfully');

      // IMPORTANT: Get fresh public URL after overwrite to ensure cache busting
      // Add timestamp to force browser to fetch the new version
      const { data: { publicUrl: finalPublicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Add cache-busting query parameter
      const stampedPdfUrl = `${finalPublicUrl}?t=${timestamp}`;
      console.log('✅ Final stamped PDF URL:', stampedPdfUrl);

      // Step 5: Create or Update doc_receive record in database
      if (isEditMode && originalDoc) {
        // UPDATE mode - แก้ไขเอกสารที่ถูกตีกลับ
        console.log('💾 Updating doc_receive record...');

        // Delete old PDF file if exists
        if (originalDoc.pdf_draft_path) {
          try {
            const oldPath = originalDoc.pdf_draft_path.split('/documents/')[1]?.split('?')[0];
            if (oldPath) {
              await supabase.storage.from('documents').remove([oldPath]);
              console.log('🗑️ Deleted old PDF:', oldPath);
            }
          } catch (e) {
            console.warn('Could not delete old PDF:', e);
          }
        }

        const { error: updateError2 } = await (supabase as any)
          .from('doc_receive')
          .update({
            doc_number: documentNumber,
            subject: formData.subject,
            date: formData.date,
            pdf_draft_path: stampedPdfUrl,
            status: 'draft', // Reset to draft
            current_signer_order: 1, // Reset signer order
            rejected_name_comment: null, // Clear rejection
            signature_positions: [], // Reset signatures
            signer_list_progress: [], // Reset progress
            updated_at: new Date().toISOString(),
            form_data: {
              type: 'pdf_upload',
              original_filename: formData.pdfFile.name,
              subject_text: formData.subject,
              upload_date: new Date().toISOString(),
              stamped_info: {
                register_no: documentNumber,
                date: thaiDate,
                time: thaiTime,
                receiver: payload.receiver
              }
            }
          })
          .eq('id', originalDoc.id);

        if (updateError2) {
          throw new Error(`Failed to update document: ${updateError2.message}`);
        }
        console.log('✅ doc_receive updated');

        toast({
          title: "แก้ไขสำเร็จ",
          description: `แก้ไขเอกสารหมายเลข ${documentNumber} เรียบร้อยแล้ว`,
        });
      } else {
        // INSERT mode - สร้างเอกสารใหม่
        console.log('💾 Creating doc_receive record...');
        const { data: docReceiveData, error: docReceiveError } = await (supabase as any)
          .from('doc_receive')
          .insert({
            doc_number: documentNumber,
            subject: formData.subject,
            date: formData.date,
            author_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'ไม่ระบุชื่อ',
            author_position: profile.current_position || profile.job_position || profile.position || 'ไม่ระบุตำแหน่ง',
            user_id: profile.user_id,
            created_by: profile.user_id,
            pdf_draft_path: stampedPdfUrl,
            status: 'draft',
            current_signer_order: 1,
            signature_positions: [],
            signer_list_progress: [],
            form_data: {
              type: 'pdf_upload',
              original_filename: formData.pdfFile.name,
              subject_text: formData.subject,
              upload_date: new Date().toISOString(),
              stamped_info: {
                register_no: documentNumber,
                date: thaiDate,
                time: thaiTime,
                receiver: payload.receiver
              }
            }
          })
          .select()
          .single();

        if (docReceiveError) {
          await supabase.storage.from('documents').remove([filePath]);
          throw new Error(`Failed to create document: ${docReceiveError.message}`);
        }
        console.log('✅ doc_receive created with ID:', docReceiveData.id);

        toast({
          title: "อัพโหลดสำเร็จ",
          description: `ลงทะเบียนเอกสารหมายเลข ${documentNumber} เรียบร้อยแล้ว`,
        });
      }

      // Step 6: Redirect to /documents
      navigate('/documents');
    } catch (error) {
      console.error('❌ Error uploading PDF:', error);
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
        <DialogContent className="bg-card p-6 rounded-lg shadow-lg">
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
              className="flex items-center gap-2 hover:bg-muted border-border text-muted-foreground bg-card shadow-sm"
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
                  {isEditMode ? 'แก้ไขหนังสือรับ' : 'หนังสือรับ'}
                </h1>

                {/* Subtitle */}
                <p className="text-green-100 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                  {isEditMode
                    ? 'แก้ไขและอัพโหลดไฟล์ PDF ใหม่ตามข้อเสนอแนะที่ได้รับ'
                    : 'อัพโหลดไฟล์ PDF ที่มีอยู่แล้วเพื่อนำเข้าสู่ระบบจัดการเอกสาร'
                  }
                </p>

                {/* Status Badge for Edit Mode */}
                {isEditMode && (
                  <div className="mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-100 border border-yellow-500/30">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      โหมดแก้ไข
                    </span>
                  </div>
                )}
              </div>
              
              {/* Bottom Wave */}
              <div className="absolute bottom-0 left-0 right-0">
                <svg className="w-full h-6 text-white" fill="currentColor" viewBox="0 0 1200 120" preserveAspectRatio="none">
                  <path d="M0,0V7.23C0,65.52,268.63,112.77,600,112.77S1200,65.52,1200,7.23V0Z"></path>
                </svg>
              </div>
            </CardHeader>
          </Card>

          {/* Rejection Comment Alert */}
          {rejectionComment && (
            <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-950">
              <CardHeader className="bg-red-100 border-b border-red-200">
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  ข้อความตีกลับจากผู้อนุมัติ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Alert className="border-red-200 bg-card">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <div className="space-y-2">
                      <p className="font-medium">{rejectionComment.comment || 'ไม่ระบุเหตุผล'}</p>
                      <div className="text-sm text-red-600">
                        โดย: {rejectionComment.name || 'ไม่ระบุ'}
                        {rejectionComment.position && ` (${rejectionComment.position})`}
                        {rejectionComment.rejected_at && ` • ${new Date(rejectionComment.rejected_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}`}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {loadingDoc ? (
            <Card className="shadow-lg border-0 bg-card p-8 text-center">
              <svg className="animate-spin h-8 w-8 text-green-600 mx-auto mb-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-lg font-medium text-muted-foreground">กำลังโหลดข้อมูลเอกสาร...</p>
            </Card>
          ) : (
          <form onSubmit={handleSubmit}>
            <Card className="shadow-lg border-0 bg-card">
              <CardHeader className="bg-muted/50 border-b border-border rounded-t-lg">
                <CardTitle className="text-xl text-foreground font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-green-600" />
                  </div>
                  ข้อมูลเอกสาร PDF
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {/* PDF Upload Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    อัพโหลดไฟล์ PDF
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="pdf_file" className="text-sm font-medium text-foreground">
                        เลือกไฟล์ PDF *
                      </Label>
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-green-400 transition-colors">
                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                        <p className="text-sm text-muted-foreground mt-2">
                          รองรับไฟล์ PDF เท่านั้น (ขนาดไม่เกิน 10MB)
                        </p>
                      </div>
                      {formData.pdfFile && (
                        <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 rounded-lg">
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
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    ข้อมูลพื้นฐาน
                  </h3>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="date" className="text-sm font-medium text-foreground">
                        วันที่ *
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        value={formData.date}
                        onChange={(e) => handleInputChange('date', e.target.value)}
                        required
                        className="border-border focus:border-green-500 focus:ring-green-500/20 transition-all duration-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="docNumber" className="text-sm font-medium text-foreground">
                        เลขรับ *
                      </Label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-3 py-2 bg-muted border border-border rounded-md text-foreground font-medium whitespace-nowrap">
                          <span className="text-sm"> {new Date().getFullYear() + 543} /</span>
                        </div>
                        <Input
                          id="docNumber"
                          value={formData.docNumber}
                          onChange={(e) => handleInputChange('docNumber', e.target.value)}
                          placeholder={getSuggestedNumber() || '001'}
                          className="flex-1 border-border focus:border-green-500 focus:ring-green-500/20 transition-all duration-200"
                        />
                      </div>
                      {suggestedDocNumber && !formData.docNumber && (
                        <p className="text-xs text-green-600 font-medium">
                          ✓ ใช้เลขรับที่แนะนำ: {getSuggestedNumber()} (หรือพิมพ์เลขใหม่เพื่อแก้ไข)
                        </p>
                      )}
                      {formData.docNumber && (
                        <p className="text-xs text-blue-600 font-medium">
                          ✓ ใช้เลขรับ: {formData.docNumber}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-medium text-foreground">
                        เรื่อง *
                      </Label>
                      <Input
                        id="subject"
                        value={formData.subject}
                        onChange={(e) => handleInputChange('subject', e.target.value)}
                        required
                        placeholder="ระบุเรื่องของเอกสาร PDF"
                        className="border-border focus:border-green-500 focus:ring-green-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Author Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    ข้อมูลผู้อัพโหลด
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="author_name" className="text-sm font-medium text-foreground">
                        ชื่อผู้อัพโหลด *
                      </Label>
                      <Input
                        id="author_name"
                        value={profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''}
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author_position" className="text-sm font-medium text-foreground">
                        ตำแหน่งผู้อัพโหลด *
                      </Label>
                      <Input
                        id="author_position"
                        value={profile?.current_position || profile?.job_position || profile?.position || ''}
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Notice Section */}
                <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 rounded-lg">
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
                <div className="flex gap-4 pt-6 border-t border-border">
                  <Button
                    type="submit"
                    disabled={loading || !formData.pdfFile || !formData.subject.trim()}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-8 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? (isEditMode ? 'กำลังแก้ไข...' : 'กำลังอัพโหลด...')
                      : (isEditMode ? 'บันทึกการแก้ไข' : 'อัพโหลดเอกสาร')
                    }
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/documents')}
                    className="border-border text-foreground hover:bg-muted font-semibold px-8 py-2 rounded-lg transition-all duration-200"
                    disabled={loading}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
          )}
        </div>
      </div>
      <div className="h-10" />

    </div>
  );
};

export default PDFSignaturePage;