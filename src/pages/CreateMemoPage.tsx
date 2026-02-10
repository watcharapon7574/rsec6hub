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
import { FileText, ArrowLeft, AlertCircle, Sparkles, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAllMemos } from '@/hooks/useAllMemos';
import { useToast } from '@/hooks/use-toast';
import { formatThaiDateFull } from '@/utils/dateUtils';

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
  const [grammarLoading, setGrammarLoading] = useState(false);
  const [showGrammarModal, setShowGrammarModal] = useState(false);
  const [grammarSuggestions, setGrammarSuggestions] = useState<Array<{
    field: string,
    fieldLabel: string,
    originalWord: string,
    correctedWord: string,
    context: string,
    wordIndex: number,
    applied?: boolean
  }>>([]);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [showSpecialCharHelp, setShowSpecialCharHelp] = useState(false);

  // Rate limiting: 10 requests per minute per user
  const [grammarRequestCount, setGrammarRequestCount] = useState(0);
  const [grammarRequestResetTime, setGrammarRequestResetTime] = useState(Date.now() + 60000);

  // Preview PDF state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFormDataHash, setPreviewFormDataHash] = useState<string>('');

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

    // Use the doc_number as is, without auto-generation
    const submissionData = {
      ...formData,
      doc_number: formData.doc_number.trim() || '' // Leave empty if not provided
    };

    // Use pre-generated PDF if preview is still valid (form data hasn't changed)
    const validPreviewBlob = isPreviewValid() ? previewBlob : undefined;
    if (validPreviewBlob) {
      console.log('📄 Using pre-generated PDF from preview (skipping API call)');
    }

    if (isEditMode && originalMemo) {
      // For edit mode - call API /pdf to generate new PDF and delete old files
      const result = await createMemoDraft({
        ...submissionData,
        memo_id: originalMemo.id, // Send memo_id for update mode
        attachedFileObjects: selectedFiles,
        preGeneratedPdfBlob: validPreviewBlob
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
        attachedFileObjects: selectedFiles,
        preGeneratedPdfBlob: validPreviewBlob
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

  const correctGrammar = async () => {
    if (grammarLoading) return;

    // Check rate limit (10 requests per minute)
    const now = Date.now();
    if (now > grammarRequestResetTime) {
      // Reset counter after 1 minute
      setGrammarRequestCount(0);
      setGrammarRequestResetTime(now + 60000);
    }

    if (grammarRequestCount >= 10) {
      const secondsRemaining = Math.ceil((grammarRequestResetTime - now) / 1000);
      toast({
        title: "ใช้งานบ่อยเกินไป",
        description: `กรุณารอ ${secondsRemaining} วินาที ก่อนใช้งานคุณสมบัตินี้อีกครั้ง (จำกัด 10 ครั้ง/นาที)`,
        variant: "destructive",
      });
      return;
    }

    const fieldsToCorrect = [
      { field: 'subject', label: 'เรื่อง' },
      { field: 'attachment_title', label: 'สิ่งที่ส่งมาด้วย' },
      { field: 'introduction', label: 'ต้นเรื่อง' },
      { field: 'fact', label: 'ข้อเท็จจริง' },
      { field: 'proposal', label: 'ข้อเสนอและพิจารณา' }
    ];

    const hasContent = fieldsToCorrect.some(({ field }) =>
      formData[field as keyof MemoFormData]?.toString().trim()
    );

    if (!hasContent) {
      toast({
        title: "ไม่มีเนื้อหาให้ตรวจ",
        description: "กรุณากรอกข้อมูลในแบบฟอร์มก่อนใช้งานฟีเจอร์นี้",
        variant: "destructive",
      });
      return;
    }

    // Increment request count
    setGrammarRequestCount(prev => prev + 1);

    setGrammarLoading(true);
    const allSuggestions: Array<{
      field: string,
      fieldLabel: string,
      originalWord: string,
      correctedWord: string,
      context: string,
      wordIndex: number,
      applied?: boolean
    }> = [];

    try {
      // ใช้ Vertex AI Gemini ผ่าน Edge Function
      const EDGE_FUNCTION_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/grammar-check';

      for (const { field, label } of fieldsToCorrect) {
        const content = formData[field as keyof MemoFormData]?.toString().trim();
        if (!content) continue;

        // Call Edge Function
        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: content,
            field_label: label
          })
        });

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Grammar check failed');
        }

        // Process changes from Edge Function response
        if (data.changes && data.changes.length > 0) {
          console.log('✅ Grammar corrections found for', label, ':', data.changes);
          data.changes.forEach((correction: any, index: number) => {
            if (correction.original && correction.corrected && correction.original !== correction.corrected) {
              allSuggestions.push({
                field,
                fieldLabel: label,
                originalWord: correction.original.trim(),
                correctedWord: correction.corrected.trim(),
                context: correction.reason || '',
                wordIndex: index,
                applied: false
              });
            }
          });
        }
      }

      if (allSuggestions.length === 0) {
        toast({
          title: "ไม่พบข้อผิดพลาด",
          description: "ไวยากรณ์และการสะกดคำในเอกสารนี้ถูกต้องแล้ว",
        });
      } else {
        setGrammarSuggestions(allSuggestions);
        setCurrentSuggestionIndex(0);
        setShowGrammarModal(true);
      }

    } catch (error) {
      console.error('Grammar correction error:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถตรวจสอบไวยากรณ์ได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    } finally {
      setGrammarLoading(false);
    }
  };

  const applyCorrection = () => {
    const suggestion = grammarSuggestions[currentSuggestionIndex];
    if (!suggestion || suggestion.applied) return;

    const content = formData[suggestion.field as keyof MemoFormData]?.toString() || '';
    console.log('Before correction:', content);
    console.log('Original word:', suggestion.originalWord);
    console.log('Corrected word:', suggestion.correctedWord);
    
    // Use more precise replacement - escape special regex characters
    const escapedOriginal = suggestion.originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const updatedContent = content.replace(new RegExp(escapedOriginal, 'g'), suggestion.correctedWord);
    
    console.log('After correction:', updatedContent);
    
    setFormData(prev => ({
      ...prev,
      [suggestion.field]: updatedContent
    }));

    // Mark as applied
    setGrammarSuggestions(prev => prev.map((item, index) => 
      index === currentSuggestionIndex 
        ? { ...item, applied: true }
        : item
    ));

    nextSuggestion();
  };

  const skipCorrection = () => {
    nextSuggestion();
  };

  const previousSuggestion = () => {
    if (currentSuggestionIndex > 0) {
      setCurrentSuggestionIndex(currentSuggestionIndex - 1);
    }
  };

  const nextSuggestion = () => {
    if (currentSuggestionIndex < grammarSuggestions.length - 1) {
      setCurrentSuggestionIndex(currentSuggestionIndex + 1);
    } else {
      // เสร็จสิ้นทั้งหมด
      setShowGrammarModal(false);
      setGrammarSuggestions([]);
      setCurrentSuggestionIndex(0);
      toast({
        title: "เสร็จสิ้นการตรวจสอบ",
        description: "ตรวจสอบและแก้ไขไวยากรณ์เสร็จสิ้น",
      });
    }
  };

  const closeGrammarModal = () => {
    setShowGrammarModal(false);
    setGrammarSuggestions([]);
    setCurrentSuggestionIndex(0);
  };

  // Create hash of form data to detect changes
  const getFormDataHash = () => {
    const { doc_number, date, subject, attachment_title, introduction, fact, proposal } = formData;
    return JSON.stringify({ doc_number, date, subject, attachment_title, introduction, fact, proposal });
  };

  // Generate PDF preview
  const generatePreview = async () => {
    if (previewLoading) return;

    // Clear previous preview (prevent memory leak and file clutter)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewFormDataHash('');

    setPreviewLoading(true);

    try {
      // Format data for API (include author info like useMemo does)
      const previewData = {
        ...formData,
        date: formData.date ? formatThaiDateFull(formData.date) : formData.date,
        author_name: formData.author_name || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '') || 'ไม่ระบุชื่อ',
        author_position: formData.author_position || profile?.current_position || profile?.job_position || profile?.position || 'ไม่ระบุตำแหน่ง'
      };

      console.log('📄 Preview data:', previewData);

      const response = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/pdf',
        },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify(previewData),
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error('Received empty PDF');
      }

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewBlob(blob);
      setPreviewFormDataHash(getFormDataHash());

      toast({
        title: "สร้างตัวอย่างสำเร็จ",
        description: "คุณสามารถดูตัวอย่าง PDF ได้ด้านล่าง",
      });

    } catch (error) {
      console.error('Preview generation error:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างตัวอย่าง PDF ได้",
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Check if preview is still valid (form data hasn't changed)
  const isPreviewValid = () => {
    return previewBlob && previewFormDataHash === getFormDataHash();
  };

  // Cleanup preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Loading Modal */}
      <Dialog open={loading}>
        <DialogContent className="bg-card p-6 rounded-lg shadow-lg">
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
            <Card>
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
              className="flex items-center gap-2 hover:bg-muted border-border text-muted-foreground bg-card shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              ย้อนกลับ
            </Button>
          </div>

          {/* Rejection Comments Card */}
          {rejectionComments.length > 0 && (
            <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950">
              <CardHeader className="bg-red-100 border-b border-red-200 dark:border-red-800">
                <CardTitle className="text-red-800 dark:text-red-200 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  ข้อความตีกลับจากผู้อนุมัติ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {rejectionComments.map((comment, index) => (
                  <Alert key={index} className="border-red-200 dark:border-red-800 bg-card">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-800 dark:text-red-200">
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

          {/* Grammar Correction Modal */}
          <Dialog open={showGrammarModal} onOpenChange={setShowGrammarModal}>
            <DialogContent className="bg-card p-6 rounded-lg shadow-lg max-w-2xl">
              <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Sparkles className="h-5 w-5 text-green-600" />
                ตรวจสอบไวยากรณ์
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mb-4">
                พบข้อเสนอแนะการแก้ไข {grammarSuggestions.length} รายการ (รายการที่ {currentSuggestionIndex + 1}/{grammarSuggestions.length})
              </DialogDescription>
              
              {grammarSuggestions[currentSuggestionIndex] && (
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg border ${
                    grammarSuggestions[currentSuggestionIndex].applied 
                      ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                      : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`font-medium ${
                        grammarSuggestions[currentSuggestionIndex].applied 
                          ? 'text-green-800 dark:text-green-200' 
                          : 'text-blue-800 dark:text-blue-200'
                      }`}>
                        ช่อง: {grammarSuggestions[currentSuggestionIndex].fieldLabel}
                      </h4>
                      {grammarSuggestions[currentSuggestionIndex].applied && (
                        <span className="text-xs bg-green-200 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                          ✓ แก้ไขแล้ว
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                      บริบท: "{grammarSuggestions[currentSuggestionIndex].context}"
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                      <h5 className="font-medium text-red-700 mb-2">คำเดิม</h5>
                      <p className={`font-mono bg-red-100 p-2 rounded ${
                        grammarSuggestions[currentSuggestionIndex].applied 
                          ? 'text-red-500 line-through' 
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        "{grammarSuggestions[currentSuggestionIndex].originalWord}"
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <h5 className="font-medium text-green-700 mb-2">
                        {grammarSuggestions[currentSuggestionIndex].applied ? 'คำที่ใช้แล้ว' : 'คำที่แนะนำ'}
                      </h5>
                      <p className={`font-mono bg-green-100 p-2 rounded ${
                        grammarSuggestions[currentSuggestionIndex].applied 
                          ? 'text-green-800 dark:text-green-200 font-bold' 
                          : 'text-green-800 dark:text-green-200'
                      }`}>
                        "{grammarSuggestions[currentSuggestionIndex].correctedWord}"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      onClick={previousSuggestion}
                      variant="outline"
                      disabled={currentSuggestionIndex === 0}
                      className="flex items-center justify-center gap-2 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ← ย้อน
                    </Button>
                    <Button 
                      onClick={applyCorrection}
                      disabled={grammarSuggestions[currentSuggestionIndex].applied}
                      className="bg-green-600 hover:bg-green-700 text-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {grammarSuggestions[currentSuggestionIndex].applied ? '✓ แก้ไขแล้ว' : '✓ ใช้การแก้ไข'}
                    </Button>
                    <Button 
                      onClick={skipCorrection}
                      variant="outline"
                      className="flex-1 flex items-center justify-center gap-2 hover:bg-muted"
                    >
                      → ข้ามไป
                    </Button>
                  </div>
                  
                  <div className="text-center text-xs text-muted-foreground mt-2">
                    กด "ใช้การแก้ไข" เพื่อแก้คำนี้ หรือ "ข้ามไป" เพื่อไม่แก้ไข • "ย้อน" เพื่อกลับไปรายการก่อนหน้า
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

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
            <Card className="shadow-lg border-0 bg-card">
              <CardHeader className="bg-muted/50 border-b border-border rounded-t-lg">
                <CardTitle className="text-xl text-foreground font-semibold flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  ข้อมูลเอกสาร
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {/* Basic Information Section */}
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
                        className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                {/* Subject Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    เรื่อง
                  </h3>
                  <div className="space-y-2">
                    
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => handleInputChange('subject', e.target.value)}
                      required
                      placeholder="ระบุเรื่องที่ต้องการสื่อสาร"
                      className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    ข้อมูลเพิ่มเติม
                  </h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="attachment_title" className="text-sm font-medium text-foreground">
                          สิ่งที่ส่งมาด้วย
                        </Label>
                        <Input
                          id="attachment_title"
                          value={formData.attachment_title}
                          onChange={(e) => handleInputChange('attachment_title', e.target.value)}
                          placeholder="ระบุเอกสารหรือสิ่งที่แนบมาด้วย (ถ้ามี)"
                          className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="attached_files" className="text-sm font-medium text-foreground">
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
                          className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:bg-blue-950 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          รองรับไฟล์: PDF, Word, รูปภาพ (JPG, PNG) ขนาดไม่เกิน 10MB ต่อไฟล์
                        </p>
                      </div>
                    </div>

                    {formData.attached_files && formData.attached_files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-sm font-medium text-foreground">ไฟล์ที่เลือก:</p>
                        {formData.attached_files.map((fileName, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
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
                      <Label htmlFor="introduction" className="text-sm font-medium text-foreground">
                        ต้นเรื่อง
                      </Label>
                      <Textarea
                        id="introduction"
                        value={formData.introduction}
                        onChange={(e) => handleInputChange('introduction', e.target.value)}
                        rows={3}
                        placeholder="ข้อความเปิดหรือบริบทของเรื่อง"
                        className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Author Information Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    ข้อมูลผู้เขียน
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="author_name" className="text-sm font-medium text-foreground">
                        ชื่อผู้เขียน *
                      </Label>
                      <Input
                        id="author_name"
                        value={formData.author_name}
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="author_position" className="text-sm font-medium text-foreground">
                        ตำแหน่งผู้เขียน *
                      </Label>
                      <Input
                        id="author_position"
                        value={formData.author_position}
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">
                    เนื้อหา
                  </h3>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="fact" className="text-sm font-medium text-foreground">
                        ข้อเท็จจริง
                      </Label>
                      <Textarea
                        id="fact"
                        value={formData.fact}
                        onChange={(e) => handleInputChange('fact', e.target.value)}
                        rows={4}
                        placeholder="ระบุข้อเท็จจริงที่เกิดขึ้น"
                        className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proposal" className="text-sm font-medium text-foreground">
                        ข้อเสนอและพิจารณา
                      </Label>
                      <Textarea
                        id="proposal"
                        value={formData.proposal}
                        onChange={(e) => handleInputChange('proposal', e.target.value)}
                        rows={4}
                        placeholder="ระบุข้อเสนอแนะหรือแนวทางดำเนินการ"
                        className="border-border focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 resize-none"
                      />
                    </div>

                    {/* Special Character Help (Collapsible) */}
                    <div className="text-sm text-blue-700 bg-blue-50 dark:bg-blue-950 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowSpecialCharHelp(!showSpecialCharHelp)}
                      >
                        <span>
                          <span className="font-semibold">💡 เครื่องหมายพิเศษ:</span>{' '}
                          พิมพ์ <code className="bg-blue-200 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded font-bold">!</code> เพื่อขึ้นบรรทัดใหม่ย่อหน้า
                        </span>
                        {showSpecialCharHelp ? (
                          <ChevronUp className="h-5 w-5 flex-shrink-0 ml-2" />
                        ) : (
                          <ChevronDown className="h-5 w-5 flex-shrink-0 ml-2" />
                        )}
                      </div>
                      {showSpecialCharHelp && (
                        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800 space-y-1.5">
                          <p className="text-blue-600 font-medium">ตัวอย่าง ถ้า ! มากกว่า 1:</p>
                          <div className="pl-3 space-y-1">
                            <p><code className="bg-blue-200 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded font-bold">!!</code> = ขึ้นบรรทัดใหม่ย่อหน้า 2 ครั้ง</p>
                            <p><code className="bg-blue-200 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded font-bold">!!!</code> = ขึ้นบรรทัดใหม่ย่อหน้า 3 ครั้ง</p>
                            <p><code className="bg-blue-200 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded font-bold">!!!!</code> = ขึ้นบรรทัดใหม่ย่อหน้า 4 ครั้ง</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-border">
                  <Button 
                    type="submit" 
                    disabled={loading || loadingMemo || grammarLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (isEditMode ? 'กำลังอัปเดต...' : 'กำลังสร้าง...') : (isEditMode ? 'อัปเดตบันทึก' : 'ส่งบันทึก')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={correctGrammar}
                    disabled={loading || loadingMemo || grammarLoading || previewLoading}
                    className="border-green-300 dark:border-green-700 text-green-700 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950 font-semibold px-6 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {grammarLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        กำลังตรวจ...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        ปรับไวยากรณ์
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generatePreview}
                    disabled={loading || loadingMemo || grammarLoading || previewLoading}
                    className="border-blue-300 dark:border-blue-700 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 font-semibold px-6 py-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {previewLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        กำลังสร้าง...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        ดูตัวอย่าง
                      </>
                    )}
                  </Button>
                  <div className="flex-1"></div>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => navigate('/documents')}
                    className="border-border text-foreground hover:bg-muted font-semibold px-8 py-2 rounded-lg transition-all duration-200"
                    disabled={loading || loadingMemo || grammarLoading}
                  >
                    ยกเลิก
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          {/* PDF Preview Section */}
          {previewUrl && (
            <Card className="mt-8 shadow-lg border-0 bg-card">
              <CardHeader className="bg-blue-50 dark:bg-blue-950 border-b border-blue-100 dark:border-blue-900 rounded-t-lg">
                <CardTitle className="text-xl text-foreground font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Eye className="w-4 h-4 text-blue-600" />
                    </div>
                    ตัวอย่าง PDF
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ปิดตัวอย่าง
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="bg-muted rounded-lg overflow-hidden">
                  <iframe
                    src={previewUrl}
                    className="w-full h-[800px] border-0"
                    title="PDF Preview"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  💡 ตรวจสอบการตัดบรรทัดและแก้ไขในฟอร์มด้านบน แล้วกด "ดูตัวอย่าง" อีกครั้งเพื่อดูผลลัพธ์
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <div className="h-10" />
        </>
      )}
    </div>
  );
};

export default CreateMemoPage;