import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMemo } from '@/hooks/useMemo';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useMemoErrorHandler } from '@/hooks/useMemoErrorHandler';
import { MemoFormData } from '@/types/memo';
import { FileText, ArrowLeft, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAllMemos } from '@/hooks/useAllMemos';
import { useToast } from '@/hooks/use-toast';

const CreateMemoPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editMemoId = searchParams.get('edit');
  const { profile, getPermissions } = useEmployeeAuth();
  const { createMemoDraft, loading } = useMemo();
  const { getMemoById } = useAllMemos();
  const { toast } = useToast();
  const { handleMemoError, showSuccessMessage } = useMemoErrorHandler();
  const permissions = getPermissions();
  
  const [isEditMode, setIsEditMode] = useState(!!editMemoId);
  const [originalMemo, setOriginalMemo] = useState<any>(null);
  const [rejectionComments, setRejectionComments] = useState<any[]>([]);
  const [loadingMemo, setLoadingMemo] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  const [formData, setFormData] = useState<MemoFormData>({
    doc_number: '', // ธุรการจะเป็นคนใส่
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

  // Load memo data for editing
  useEffect(() => {
    const loadMemoForEdit = async () => {
      if (editMemoId && getMemoById && !originalMemo) {
        setLoadingMemo(true);
        try {
          const memo = getMemoById(editMemoId);
          if (memo) {
            setOriginalMemo(memo);
            setFormData({
              doc_number: memo.doc_number || '',
              date: memo.date || new Date().toISOString().split('T')[0],
              subject: memo.subject || '',
              attachment_title: memo.attachment_title || '',
              introduction: memo.introduction || '',
              author_name: memo.author_name || (profile ? `${profile.first_name} ${profile.last_name}` : ''),
              author_position: memo.author_position || profile?.current_position || profile?.job_position || profile?.position || '',
              fact: memo.fact || '',
              proposal: memo.proposal || '',
              attached_files: memo.attached_files || []
            });
            
            // Load rejection comments if any from rejected_name_comment
            if ((memo as any).rejected_name_comment) {
              try {
                let rejectedData;
                if (typeof (memo as any).rejected_name_comment === 'string') {
                  rejectedData = JSON.parse((memo as any).rejected_name_comment);
                } else {
                  rejectedData = (memo as any).rejected_name_comment;
                }
                
                setRejectionComments([{
                  comment: rejectedData.comment || 'ไม่มีความคิดเห็น',
                  rejected_by: rejectedData.name || 'ไม่ระบุ',
                  rejected_at: rejectedData.rejected_at || new Date().toISOString(),
                  position: rejectedData.position || '',
                  type: 'rejection'
                }]);
              } catch (error) {
                console.error('Error parsing rejected_name_comment:', error);
                // Fallback to old rejection_reason if exists
                if ((memo as any).rejection_reason) {
                  setRejectionComments([{
                    comment: (memo as any).rejection_reason,
                    rejected_by: (memo as any).rejected_by_name || 'ระบบ',
                    rejected_at: (memo as any).rejected_at || new Date().toISOString(),
                    type: 'rejection'
                  }]);
                }
              }
            } else if ((memo as any).rejection_reason) {
              // Fallback to old rejection_reason format
              setRejectionComments([{
                comment: (memo as any).rejection_reason,
                rejected_by: (memo as any).rejected_by_name || 'ระบบ',
                rejected_at: (memo as any).rejected_at || new Date().toISOString(),
                type: 'rejection'
              }]);
            }
          }
        } catch (error) {
          console.error('Error loading memo for edit:', error);
        }
        setLoadingMemo(false);
      }
    };
    
    loadMemoForEdit();
  }, [editMemoId, getMemoById, originalMemo, profile]);

  // Update form data when profile is loaded
  useEffect(() => {
    if (profile && !isEditMode) {
      setFormData(prev => ({
        ...prev,
        author_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || '',
        author_position: profile.current_position || profile.job_position || profile.position || ''
      }));
    }
  }, [profile, isEditMode]);

  // Allow all authenticated users to create memos

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate doc_number if empty (for API compatibility)
    const submissionData = {
      ...formData,
      doc_number: formData.doc_number.trim() || `AUTO-${Date.now()}` // Auto generate if empty
    };
    
    if (isEditMode && originalMemo) {
      // For edit mode - call API /pdf to generate new PDF and delete old files
      const result = await createMemoDraft({
        ...submissionData,
        memo_id: originalMemo.id, // Send memo_id for update mode
        attachedFileObjects: selectedFiles
      } as any);
      
      if (result.success) {
        // Check if only attached files were changed
        const contentFields = ['doc_number', 'subject', 'date', 'attachment_title', 'introduction', 'author_name', 'author_position', 'fact', 'proposal'];
        const hasContentChanges = contentFields.some(field => {
          const originalValue = originalMemo[field] || '';
          const newValue = formData[field] || '';
          return originalValue !== newValue;
        });

        if (!hasContentChanges && selectedFiles.length > 0) {
          toast({
            title: "อัพเดตไฟล์แนบสำเร็จ",
            description: "ไฟล์แนบได้ถูกอัพเดตแล้ว (ไม่ได้สร้าง PDF ใหม่)",
          });
        } else {
          toast({
            title: "อัพเดตบันทึกข้อความสำเร็จ",
            description: "บันทึกข้อความได้ถูกอัพเดตและสร้าง PDF ใหม่แล้ว",
          });
        }
        navigate('/documents');
      }
    } else {
      // Normal create mode
      const result = await createMemoDraft({
        ...submissionData,
        attachedFileObjects: selectedFiles
      } as any);
      if (result.success) {
        navigate('/documents');
      }
    }
  };

  const handleInputChange = (field: keyof MemoFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Loading Modal */}
      <Dialog open={loading}>
        <DialogContent className="bg-white p-6 rounded-lg shadow-lg">
          <DialogTitle>กำลังสร้างไฟล์</DialogTitle>
          <DialogDescription>
            กรุณาอย่าปิดหน้านี้จนกว่ากระบวนการจะเสร็จสมบูรณ์
          </DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="text-lg font-medium">ระบบกำลังบันทึกไฟล์...</div>
            <Progress value={100} />
          </div>
        </DialogContent>
      </Dialog>
      {/* End Loading Modal */}

      {/* Loading Memo for Edit */}
      {loadingMemo && (
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Card className="glass-card border-card-glass-border shadow-glass-lg">
              <CardContent className="p-8 text-center">
                <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                <p className="text-lg font-medium">กำลังโหลดข้อมูลบันทึก...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!loadingMemo && (
        <>
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

          {/* Rejection Comments Card */}
          {rejectionComments.length > 0 && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardHeader className="bg-red-100 border-b border-red-200">
                <CardTitle className="text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  ข้อความตีกลับจากผู้อนุมัติ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {rejectionComments.map((comment, index) => (
                  <Alert key={index} className="border-red-200 bg-white">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <div className="space-y-2">
                        <p className="font-medium">{comment.comment}</p>
                        <div className="text-sm text-red-600">
                          โดย: {comment.rejected_by}
                          {comment.position && ` (${comment.position})`} • {new Date(comment.rejected_at).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Header Card */}
          <Card className="mb-8 overflow-hidden shadow-xl border-0">
            <CardHeader className="relative bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 text-white py-12">
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
                  <FileText className="w-10 h-10 text-white" />
                </div>
                
                {/* Title */}
                <h1 className="text-3xl font-bold mb-3 tracking-tight">
                  {isEditMode ? 'แก้ไขบันทึกข้อความ' : 'สร้างบันทึกข้อความ'}
                </h1>
                
                {/* Subtitle */}
                <p className="text-blue-100 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                  {isEditMode 
                    ? 'แก้ไขและปรับปรุงบันทึกข้อความตามข้อเสนอแนะที่ได้รับ' 
                    : 'สร้างบันทึกข้อความใหม่สำหรับส่งให้ผู้เกี่ยวข้องพิจารณาและลงนาม'
                  }
                </p>
                
                {/* Status Badge for Edit Mode */}
                {isEditMode && (
                  <div className="mt-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-100 border border-yellow-500/30">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
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

          <form onSubmit={handleSubmit}>
            <Card className="shadow-lg border-0 bg-white">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-100 rounded-t-lg">
                <CardTitle className="text-xl text-gray-800 font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  ข้อมูลเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {/* Basic Information Section */}
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
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Subject Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    เรื่อง
                  </h3>
                  <div className="space-y-2">
                    
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      required
                      placeholder="ระบุเรื่องที่ต้องการสื่อสาร"
                      className="border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    ข้อมูลเพิ่มเติม
                  </h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="attachment_title" className="text-sm font-medium text-gray-700">
                          สิ่งที่ส่งมาด้วย
                        </Label>
                        <Input
                          id="attachment_title"
                          value={formData.attachment_title}
                          onChange={(e) => handleInputChange('attachment_title', e.target.value)}
                          placeholder="ระบุเอกสารหรือสิ่งที่แนบมาด้วย (ถ้ามี)"
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="attached_files" className="text-sm font-medium text-gray-700">
                          อัปโหลดไฟล์แนบ
                        </Label>
                        <Input
                          id="attached_files"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setSelectedFiles(files);
                            const fileNames = files.map(file => file.name);
                            setFormData(prev => ({
                              ...prev,
                              attached_files: fileNames
                            }));
                          }}
                          className="border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          รองรับไฟล์: PDF, Word, รูปภาพ (JPG, PNG) ขนาดไม่เกิน 10MB ต่อไฟล์
                        </p>
                      </div>
                    </div>

                    {formData.attached_files && formData.attached_files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium text-gray-700">ไฟล์ที่เลือก:</p>
                        {formData.attached_files.map((fileName, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
                            <span className="flex-1">{fileName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const newFiles = selectedFiles.filter((_, i) => i !== index);
                                setSelectedFiles(newFiles);
                                setFormData(prev => ({
                                  ...prev,
                                  attached_files: prev.attached_files?.filter((_, i) => i !== index) || []
                                }));
                              }}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              ลบ
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="introduction" className="text-sm font-medium text-gray-700">
                        ต้นเรื่อง
                      </Label>
                      <Textarea
                        id="introduction"
                        value={formData.introduction}
                        onChange={(e) => handleInputChange('introduction', e.target.value)}
                        rows={3}
                        placeholder="ข้อความเปิดหรือบริบทของเรื่อง"
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Author Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    ข้อมูลผู้เขียน
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="author_name" className="text-sm font-medium text-gray-700">
                        ชื่อผู้เขียน *
                      </Label>
                      <Input
                        id="author_name"
                        value={formData.author_name}
                        disabled
                        className="bg-gray-50 text-gray-600 cursor-not-allowed border-gray-200"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author_position" className="text-sm font-medium text-gray-700">
                        ตำแหน่งผู้เขียน *
                      </Label>
                      <Input
                        id="author_position"
                        value={formData.author_position}
                        disabled
                        className="bg-gray-50 text-gray-600 cursor-not-allowed border-gray-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">
                    เนื้อหา
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="fact" className="text-sm font-medium text-gray-700">
                        ข้อเท็จจริง
                      </Label>
                      <Textarea
                        id="fact"
                        value={formData.fact}
                        onChange={(e) => handleInputChange('fact', e.target.value)}
                        rows={4}
                        placeholder="ระบุข้อเท็จจริงที่เกิดขึ้น"
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proposal" className="text-sm font-medium text-gray-700">
                        ข้อเสนอและพิจารณา
                      </Label>
                      <Textarea
                        id="proposal"
                        value={formData.proposal}
                        onChange={(e) => handleInputChange('proposal', e.target.value)}
                        rows={4}
                        placeholder="ระบุข้อเสนอแนะหรือแนวทางดำเนินการ"
                        className="border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-gray-200">
                  <Button 
                    type="submit" 
                    disabled={loading || loadingMemo}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (isEditMode ? 'กำลังอัปเดต...' : 'กำลังสร้าง...') : (isEditMode ? 'อัปเดตบันทึก' : 'ส่งบันทึก')}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => navigate('/documents')}
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-8 py-2 rounded-lg transition-all duration-200"
                    disabled={loading || loadingMemo}
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
        </>
      )}
    </div>
  );
};

export default CreateMemoPage;