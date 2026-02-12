import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMemo } from '@/hooks/useMemo';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useAllMemos } from '@/hooks/useAllMemos';
import { MemoFormData } from '@/types/memo';
import { FileText, ArrowLeft, Sparkles, Eye, ChevronDown, ChevronUp, ClipboardCheck, AlertCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AnimatedProgress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { formatThaiDateFull } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { taskAssignmentService } from '@/services/taskAssignmentService';

interface TaskInfo {
  assignment_id: string;
  document_subject: string;
  document_type: string;
  memo_id?: string;
  doc_receive_id?: string;
  task_description?: string;
  assigned_by_name?: string;
  event_date?: string;
  location?: string;
}

const CreateReportMemoPage = () => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const editMemoId = searchParams.get('edit');
  const { profile } = useEmployeeAuth();
  const { createMemoDraft, loading } = useMemo();
  const { getMemoById, refetch } = useAllMemos();
  const { toast } = useToast();

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(!!editMemoId);
  const [originalMemo, setOriginalMemo] = useState<any>(null);
  const [rejectionInfo, setRejectionInfo] = useState<{
    name: string;
    comment: string;
    rejected_at: string;
    position?: string;
  } | null>(null);
  const [loadingMemo, setLoadingMemo] = useState(false);

  const [taskInfo, setTaskInfo] = useState<TaskInfo | null>(null);
  const [loadingTask, setLoadingTask] = useState(!editMemoId); // Only load task in create mode
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

  // Rate limiting
  const [grammarRequestCount, setGrammarRequestCount] = useState(0);
  const [grammarRequestResetTime, setGrammarRequestResetTime] = useState(Date.now() + 60000);

  // Preview PDF state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewFormDataHash, setPreviewFormDataHash] = useState<string>('');

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

  // Load memo for edit mode (same pattern as CreateMemoPage)
  useEffect(() => {
    const loadMemoForEdit = async () => {
      // Skip if no editMemoId or already loaded
      if (!editMemoId || originalMemo) return;

      setIsEditMode(true);
      setLoadingMemo(true);

      try {
        // Try to get from hook first
        let memo = getMemoById ? getMemoById(editMemoId) : null;

        // If not found, fetch directly
        if (!memo) {
          const { data, error } = await supabase
            .from('memos')
            .select('*')
            .eq('id', editMemoId)
            .single();

          if (error) throw error;
          memo = data as any;
        }

        if (!memo) {
          throw new Error('Memo not found');
        }

        setOriginalMemo(memo);

        // Parse attached_files (may be JSON string or array)
        let parsedAttachedFiles: string[] = [];
        if (memo.attached_files) {
          if (Array.isArray(memo.attached_files)) {
            parsedAttachedFiles = memo.attached_files;
          } else if (typeof memo.attached_files === 'string') {
            try {
              const parsed = JSON.parse(memo.attached_files);
              parsedAttachedFiles = Array.isArray(parsed) ? parsed : [];
            } catch {
              parsedAttachedFiles = [];
            }
          }
        }

        // Set form data from memo (same pattern as CreateMemoPage)
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
          attached_files: parsedAttachedFiles
        });

        // Load rejection info if any
        if (memo.rejected_name_comment) {
          try {
            let rejectedData;
            if (typeof memo.rejected_name_comment === 'string') {
              rejectedData = JSON.parse(memo.rejected_name_comment);
            } else {
              rejectedData = memo.rejected_name_comment;
            }
            setRejectionInfo({
              name: rejectedData.name || 'ไม่ระบุ',
              comment: rejectedData.comment || 'ไม่มีความคิดเห็น',
              rejected_at: rejectedData.rejected_at || new Date().toISOString(),
              position: rejectedData.position || ''
            });
          } catch (e) {
            console.error('Error parsing rejected_name_comment:', e);
          }
        }

      } catch (error) {
        console.error('Error loading memo for edit:', error);
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

    loadMemoForEdit();
  }, [editMemoId, getMemoById, originalMemo, navigate, toast, profile]);

  // Load task info (only in create mode)
  useEffect(() => {
    const loadTaskInfo = async () => {
      // Skip if in edit mode
      if (editMemoId) {
        setLoadingTask(false);
        return;
      }

      if (!taskId) {
        toast({
          title: 'ไม่พบข้อมูลงาน',
          description: 'กรุณาเลือกงานที่ต้องการรายงาน',
          variant: 'destructive'
        });
        navigate('/documents');
        return;
      }

      setLoadingTask(true);
      try {
        // Fetch task assignment details
        const { data: task, error } = await supabase
          .from('task_assignments')
          .select(`
            id,
            memo_id,
            doc_receive_id,
            document_type,
            task_description,
            event_date,
            location,
            assigned_by
          `)
          .eq('id', taskId)
          .single();

        if (error) throw error;

        // Fetch document subject
        let documentSubject = '';
        if (task.document_type === 'memo' && task.memo_id) {
          const { data: memo } = await supabase
            .from('memos')
            .select('subject')
            .eq('id', task.memo_id)
            .single();
          documentSubject = memo?.subject || '';
        } else if (task.document_type === 'doc_receive' && task.doc_receive_id) {
          const { data: docReceive } = await supabase
            .from('doc_receives')
            .select('subject')
            .eq('id', task.doc_receive_id)
            .single();
          documentSubject = docReceive?.subject || '';
        }

        // Fetch assigned_by name
        let assignedByName = '';
        if (task.assigned_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('user_id', task.assigned_by)
            .single();
          if (profile) {
            assignedByName = `${profile.first_name} ${profile.last_name}`;
          }
        }

        setTaskInfo({
          assignment_id: task.id,
          document_subject: documentSubject,
          document_type: task.document_type,
          memo_id: task.memo_id,
          doc_receive_id: task.doc_receive_id,
          task_description: task.task_description,
          assigned_by_name: assignedByName,
          event_date: task.event_date,
          location: task.location
        });

        // Pre-fill subject with the original document subject (no prefix, icon indicates report memo)
        setFormData(prev => ({
          ...prev,
          subject: documentSubject,
          introduction: task.task_description || ''
        }));

      } catch (error) {
        console.error('Error loading task:', error);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถโหลดข้อมูลงานได้',
          variant: 'destructive'
        });
        navigate('/documents');
      } finally {
        setLoadingTask(false);
      }
    };

    loadTaskInfo();
  }, [taskId, navigate, toast]);

  // Update form data when profile is loaded
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        author_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || '',
        author_position: profile.current_position || profile.job_position || profile.position || ''
      }));
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Edit mode - update existing memo
    if (isEditMode && originalMemo) {
      const submissionData = {
        ...formData,
        doc_number: formData.doc_number.trim() || ''
      };

      // Use pre-generated PDF if preview is still valid
      const validPreviewBlob = isPreviewValid() ? previewBlob : undefined;

      // Use createMemoDraft with memo_id to trigger update mode
      const result = await createMemoDraft({
        ...submissionData,
        memo_id: originalMemo.id,
        attachedFileObjects: selectedFiles,
        preGeneratedPdfBlob: validPreviewBlob
      } as any);

      if (result.success) {
        // Refetch memos
        if (refetch) {
          await refetch();
        }

        toast({
          title: 'แก้ไขสำเร็จ',
          description: 'บันทึกข้อความรายงานผลถูกแก้ไขเรียบร้อยแล้ว',
        });
        navigate('/documents');
      }
      return;
    }

    // Create mode - validate taskId and taskInfo
    if (!taskId || !taskInfo) {
      toast({
        title: 'ไม่พบข้อมูลงาน',
        description: 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive'
      });
      return;
    }

    const submissionData = {
      ...formData,
      doc_number: formData.doc_number.trim() || ''
    };

    // Use pre-generated PDF if preview is still valid
    const validPreviewBlob = isPreviewValid() ? previewBlob : undefined;
    if (validPreviewBlob) {
      console.log('Using pre-generated PDF from preview');
    }

    // Create the memo
    const result = await createMemoDraft({
      ...submissionData,
      attachedFileObjects: selectedFiles,
      preGeneratedPdfBlob: validPreviewBlob
    } as any);

    if (result.success && result.data?.id) {
      try {
        // Link memo to task assignment and mark as completed
        await taskAssignmentService.completeTaskWithReportMemo(taskId, result.data.id);

        toast({
          title: 'รายงานผลสำเร็จ',
          description: 'บันทึกข้อความรายงานถูกสร้างและเชื่อมโยงกับงานเรียบร้อยแล้ว',
        });
        navigate('/documents');
      } catch (error) {
        console.error('Error linking memo to task:', error);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'สร้างบันทึกข้อความสำเร็จ แต่ไม่สามารถเชื่อมโยงกับงานได้',
          variant: 'destructive'
        });
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

    const now = Date.now();
    if (now > grammarRequestResetTime) {
      setGrammarRequestCount(0);
      setGrammarRequestResetTime(now + 60000);
    }

    if (grammarRequestCount >= 10) {
      const secondsRemaining = Math.ceil((grammarRequestResetTime - now) / 1000);
      toast({
        title: "ใช้งานบ่อยเกินไป",
        description: `กรุณารอ ${secondsRemaining} วินาที`,
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
        description: "กรุณากรอกข้อมูลในแบบฟอร์มก่อน",
        variant: "destructive",
      });
      return;
    }

    setGrammarRequestCount(prev => prev + 1);
    setGrammarLoading(true);
    const allSuggestions: typeof grammarSuggestions = [];

    try {
      const EDGE_FUNCTION_URL = 'https://ikfioqvjrhquiyeylmsv.supabase.co/functions/v1/grammar-check';

      for (const { field, label } of fieldsToCorrect) {
        const content = formData[field as keyof MemoFormData]?.toString().trim();
        if (!content) continue;

        const response = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content, field_label: label })
        });

        if (!response.ok) throw new Error(`API request failed: ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Grammar check failed');

        if (data.changes && data.changes.length > 0) {
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
          description: "ไวยากรณ์ในเอกสารนี้ถูกต้องแล้ว",
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
        description: "ไม่สามารถตรวจสอบไวยากรณ์ได้",
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
    const escapedOriginal = suggestion.originalWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const updatedContent = content.replace(new RegExp(escapedOriginal, 'g'), suggestion.correctedWord);

    setFormData(prev => ({
      ...prev,
      [suggestion.field]: updatedContent
    }));

    setGrammarSuggestions(prev => prev.map((item, index) =>
      index === currentSuggestionIndex
        ? { ...item, applied: true }
        : item
    ));

    nextSuggestion();
  };

  const skipCorrection = () => nextSuggestion();
  const previousSuggestion = () => {
    if (currentSuggestionIndex > 0) setCurrentSuggestionIndex(currentSuggestionIndex - 1);
  };

  const nextSuggestion = () => {
    if (currentSuggestionIndex < grammarSuggestions.length - 1) {
      setCurrentSuggestionIndex(currentSuggestionIndex + 1);
    } else {
      setShowGrammarModal(false);
      setGrammarSuggestions([]);
      setCurrentSuggestionIndex(0);
      toast({ title: "เสร็จสิ้นการตรวจสอบ" });
    }
  };

  const getFormDataHash = () => {
    const { doc_number, date, subject, attachment_title, introduction, fact, proposal } = formData;
    return JSON.stringify({ doc_number, date, subject, attachment_title, introduction, fact, proposal });
  };

  const generatePreview = async () => {
    if (previewLoading) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewBlob(null);
    setPreviewFormDataHash('');
    setPreviewLoading(true);

    try {
      const previewData = {
        ...formData,
        date: formData.date ? formatThaiDateFull(formData.date) : formData.date,
        author_name: formData.author_name || (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '') || 'ไม่ระบุชื่อ',
        author_position: formData.author_position || profile?.current_position || profile?.job_position || profile?.position || 'ไม่ระบุตำแหน่ง'
      };

      const response = await fetch('https://pdf-memo-docx-production-25de.up.railway.app/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/pdf' },
        mode: 'cors',
        credentials: 'omit',
        body: JSON.stringify(previewData),
      });

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Received empty PDF');

      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setPreviewBlob(blob);
      setPreviewFormDataHash(getFormDataHash());

      toast({ title: "สร้างตัวอย่างสำเร็จ" });

    } catch (error) {
      console.error('Preview generation error:', error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถสร้างตัวอย่าง PDF ได้", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const isPreviewValid = () => previewBlob && previewFormDataHash === getFormDataHash();

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (loadingTask || loadingMemo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-teal-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <p className="text-lg font-medium">
              {isEditMode ? 'กำลังโหลดข้อมูลเอกสาร...' : 'กำลังโหลดข้อมูลงาน...'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Loading Modal */}
      <Dialog open={loading}>
        <DialogContent className="bg-card p-6 rounded-lg shadow-lg">
          <DialogTitle>กำลังสร้างรายงาน</DialogTitle>
          <DialogDescription>กรุณาอย่าปิดหน้านี้จนกว่ากระบวนการจะเสร็จสมบูรณ์</DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-8 w-8 text-teal-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="text-lg font-medium">ระบบกำลังบันทึกรายงาน...</div>
            <AnimatedProgress />
          </div>
        </DialogContent>
      </Dialog>

      {/* Grammar Modal */}
      <Dialog open={showGrammarModal} onOpenChange={setShowGrammarModal}>
        <DialogContent className="bg-card p-6 rounded-lg shadow-lg max-w-2xl">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-green-600" />
            ตรวจสอบไวยากรณ์
          </DialogTitle>
          <DialogDescription>
            พบข้อเสนอแนะ {grammarSuggestions.length} รายการ (รายการที่ {currentSuggestionIndex + 1}/{grammarSuggestions.length})
          </DialogDescription>

          {grammarSuggestions[currentSuggestionIndex] && (
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border ${
                grammarSuggestions[currentSuggestionIndex].applied
                  ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                  : 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
              }`}>
                <h4 className="font-medium mb-2">ช่อง: {grammarSuggestions[currentSuggestionIndex].fieldLabel}</h4>
                <div className="text-sm text-muted-foreground">บริบท: "{grammarSuggestions[currentSuggestionIndex].context}"</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <h5 className="font-medium text-red-700 dark:text-red-300 mb-2">คำเดิม</h5>
                  <p className="font-mono bg-red-100 dark:bg-red-900 p-2 rounded">
                    "{grammarSuggestions[currentSuggestionIndex].originalWord}"
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <h5 className="font-medium text-green-700 dark:text-green-300 mb-2">คำที่แนะนำ</h5>
                  <p className="font-mono bg-green-100 dark:bg-green-900 p-2 rounded">
                    "{grammarSuggestions[currentSuggestionIndex].correctedWord}"
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={previousSuggestion} variant="outline" disabled={currentSuggestionIndex === 0}>
                  ← ย้อน
                </Button>
                <Button
                  onClick={applyCorrection}
                  disabled={grammarSuggestions[currentSuggestionIndex].applied}
                  className="bg-green-600 hover:bg-green-700 text-white flex-1"
                >
                  {grammarSuggestions[currentSuggestionIndex].applied ? '✓ แก้ไขแล้ว' : '✓ ใช้การแก้ไข'}
                </Button>
                <Button onClick={skipCorrection} variant="outline" className="flex-1">
                  → ข้ามไป
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => navigate('/documents')}
              className="flex items-center gap-2 hover:bg-muted border-border"
            >
              <ArrowLeft className="h-4 w-4" />
              ย้อนกลับ
            </Button>
          </div>

          {/* Rejection Info Card (Edit Mode) */}
          {isEditMode && rejectionInfo && (
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

          {/* Task Info Card (Create Mode Only) */}
          {!isEditMode && taskInfo && (
            <Card className="mb-6 border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950">
              <CardHeader className="bg-teal-100 dark:bg-teal-900 border-b border-teal-200 dark:border-teal-800">
                <CardTitle className="text-teal-800 dark:text-teal-200 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  ข้อมูลงานที่รายงาน
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-sm">
                <div><span className="font-medium">เอกสาร:</span> {taskInfo.document_subject}</div>
                {taskInfo.task_description && (
                  <div><span className="font-medium">รายละเอียดงาน:</span> {taskInfo.task_description}</div>
                )}
                {taskInfo.assigned_by_name && (
                  <div><span className="font-medium">มอบหมายโดย:</span> {taskInfo.assigned_by_name}</div>
                )}
                {taskInfo.event_date && (
                  <div><span className="font-medium">กำหนดการ:</span> {formatThaiDateFull(taskInfo.event_date)}</div>
                )}
                {taskInfo.location && (
                  <div><span className="font-medium">สถานที่:</span> {taskInfo.location}</div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Header Card */}
          <Card className="mb-8 overflow-hidden shadow-xl border-0">
            <CardHeader className="relative bg-gradient-to-br from-teal-400 via-teal-500 to-teal-600 text-white py-12">
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
                  {isEditMode ? 'แก้ไขบันทึกข้อความรายงานผล' : 'บันทึกข้อความรายงานผล'}
                </h1>

                <p className="text-teal-100 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
                  {isEditMode
                    ? 'แก้ไขเอกสารตามข้อเสนอแนะและส่งใหม่'
                    : 'สร้างบันทึกข้อความรายงานผลการปฏิบัติงานอย่างเป็นทางการ'}
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
                  <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                    <FileText className="w-4 h-4 text-teal-600" />
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
                        className="border-border focus:border-teal-500"
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
                    className="border-border focus:border-teal-500"
                  />
                </div>

                {/* Additional Info */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b border-border">ข้อมูลเพิ่มเติม</h3>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="attachment_title">สิ่งที่ส่งมาด้วย</Label>
                        <Input
                          id="attachment_title"
                          value={formData.attachment_title}
                          onChange={(e) => handleInputChange('attachment_title', e.target.value)}
                          placeholder="ระบุเอกสารแนบ (ถ้ามี)"
                          className="border-border focus:border-teal-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="attached_files">อัปโหลดไฟล์แนบ</Label>
                        <input
                          id="attached_files"
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            setSelectedFiles(files);
                            setFormData(prev => ({ ...prev, attached_files: files.map(f => f.name) }));
                          }}
                          className="block w-full text-sm text-muted-foreground
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-lg file:border-0
                            file:text-sm file:font-medium
                            file:cursor-pointer
                            file:bg-teal-500 file:text-white
                            hover:file:bg-teal-600
                            cursor-pointer
                            border border-border rounded-lg p-2
                            focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {Array.isArray(formData.attached_files) && formData.attached_files.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">ไฟล์ที่เลือก:</p>
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
                      <Label htmlFor="introduction">ต้นเรื่อง</Label>
                      <Textarea
                        id="introduction"
                        value={formData.introduction}
                        onChange={(e) => handleInputChange('introduction', e.target.value)}
                        rows={3}
                        placeholder="ข้อความเปิดหรือบริบทของรายงาน"
                        className="border-border focus:border-teal-500 resize-none"
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
                        className="border-border focus:border-teal-500 resize-none"
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
                        className="border-border focus:border-teal-500 resize-none"
                      />
                    </div>

                    {/* Special Character Help */}
                    <div className="text-sm text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950 rounded-md p-3 border border-teal-200 dark:border-teal-800">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowSpecialCharHelp(!showSpecialCharHelp)}
                      >
                        <span>
                          <span className="font-semibold">เครื่องหมายพิเศษ:</span>{' '}
                          พิมพ์ <code className="bg-teal-200 dark:bg-teal-800 px-1.5 py-0.5 rounded font-bold">!</code> เพื่อขึ้นบรรทัดใหม่
                        </span>
                        {showSpecialCharHelp ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                      {showSpecialCharHelp && (
                        <div className="mt-3 pt-3 border-t border-teal-200 dark:border-teal-800 space-y-1">
                          <p><code className="bg-teal-200 dark:bg-teal-800 px-1.5 py-0.5 rounded font-bold">!!</code> = ขึ้นบรรทัดใหม่ 2 ครั้ง</p>
                          <p><code className="bg-teal-200 dark:bg-teal-800 px-1.5 py-0.5 rounded font-bold">!!!</code> = ขึ้นบรรทัดใหม่ 3 ครั้ง</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 pt-6 border-t border-border">
                  <Button
                    type="submit"
                    disabled={loading || grammarLoading}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-8 py-2 rounded-lg shadow-md"
                  >
                    {loading
                      ? (isEditMode ? 'กำลังบันทึก...' : 'กำลังส่งรายงาน...')
                      : (isEditMode ? 'บันทึกการแก้ไข' : 'ส่งรายงาน')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={correctGrammar}
                    disabled={loading || grammarLoading || previewLoading}
                    className="border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950"
                  >
                    {grammarLoading ? (
                      <><svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>กำลังตรวจ...</>
                    ) : (
                      <><Sparkles className="h-4 w-4 mr-2" />ปรับไวยากรณ์</>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generatePreview}
                    disabled={loading || grammarLoading || previewLoading}
                    className="border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950"
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
                    disabled={loading || grammarLoading}
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
              <CardHeader className="bg-teal-50 dark:bg-teal-950 border-b border-teal-100 dark:border-teal-900 rounded-t-lg">
                <CardTitle className="text-xl font-semibold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
                      <Eye className="w-4 h-4 text-teal-600" />
                    </div>
                    ตัวอย่าง PDF
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ปิดตัวอย่าง
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="bg-muted rounded-lg overflow-hidden">
                  <iframe src={previewUrl} className="w-full h-[800px] border-0" title="PDF Preview" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="h-32" />
    </div>
  );
};

export default CreateReportMemoPage;
