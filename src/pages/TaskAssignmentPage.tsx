import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Users, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { taskAssignmentService, DocumentType } from '@/services/taskAssignmentService';
import { SelectionInfo } from '@/components/TaskAssignment/Step2SelectUsers';
import { supabase } from '@/integrations/supabase/client';
import { extractPdfUrl } from '@/utils/fileUpload';
import StepIndicator from '@/components/TaskAssignment/StepIndicator';
import Step1DocumentPreview from '@/components/TaskAssignment/Step1DocumentPreview';
import Step2SelectUsers from '@/components/TaskAssignment/Step2SelectUsers';
import Step3TaskDetails from '@/components/TaskAssignment/Step3TaskDetails';
import Step4Review from '@/components/TaskAssignment/Step4Review';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface DocumentData {
  id: string;
  subject: string;
  doc_number: string | null;
  author_name: string;
  document_type: DocumentType;
  pdf_url: string | null;
  signer_list_progress: any[];
}

const TaskAssignmentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const documentId = searchParams.get('documentId');
  const documentType = searchParams.get('documentType') as DocumentType;

  const [document, setDocument] = useState<DocumentData | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDocument, setLoadingDocument] = useState(true);
  const [directorComment, setDirectorComment] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(1);

  // New states for Step3 task details
  const [taskDescription, setTaskDescription] = useState('');
  const [eventDate, setEventDate] = useState<Date | null>(new Date()); // Default to today
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');

  // Selection info for team management
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo>({ source: null });

  const stepLabels = ['ดูเอกสาร', 'เลือกผู้รับ', 'รายละเอียดงาน', 'ตรวจสอบ'];

  // โหลดข้อมูลเอกสาร
  useEffect(() => {
    const loadDocument = async () => {
      if (!documentId || !documentType) {
        toast({
          title: 'ข้อมูลไม่ครบถ้วน',
          description: 'ไม่พบข้อมูลเอกสาร',
          variant: 'destructive',
        });
        navigate('/documents');
        return;
      }

      setLoadingDocument(true);

      try {
        const tableName = documentType === 'memo' ? 'memos' : 'doc_receive';
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('id', documentId)
          .single();

        if (error || !data) {
          throw new Error('ไม่พบเอกสาร');
        }

        // ทั้ง memos และ doc_receive ใช้ pdf_draft_path หรือ pdf_final_path
        // ใช้ extractPdfUrl เพื่อ parse URL ที่อาจเป็น JSON object
        const rawPdfUrl = data.pdf_draft_path || data.pdf_final_path;
        const pdfUrl = extractPdfUrl(rawPdfUrl);

        console.log('📄 Document loaded:', { documentType, pdfUrl, data });

        setDocument({
          id: data.id,
          subject: data.subject,
          doc_number: data.doc_number,
          author_name: data.author_name,
          document_type: documentType,
          pdf_url: pdfUrl,
          signer_list_progress: data.signer_list_progress || []
        });

        // ดึง comment จากผู้อำนวยการ (current_signer_order = 5)
        const signerProgress = data.signer_list_progress || [];
        const directorSigner = signerProgress.find((s: any) => s.order === 5);
        if (directorSigner?.comment) {
          setDirectorComment(directorSigner.comment);
        }
      } catch (error: any) {
        console.error('Error loading document:', error);
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: error.message || 'ไม่สามารถโหลดข้อมูลเอกสารได้',
          variant: 'destructive',
        });
        navigate('/documents');
      } finally {
        setLoadingDocument(false);
      }
    };

    loadDocument();
  }, [documentId, documentType, navigate]);

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 2 && selectedUsers.length === 0) {
      toast({
        title: 'กรุณาเลือกผู้รับมอบหมาย',
        description: 'คุณยังไม่ได้เลือกผู้ที่จะรับมอบหมายงาน',
        variant: 'destructive',
      });
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // มอบหมายงาน
  const handleAssignTasks = async () => {
    if (selectedUsers.length === 0) {
      toast({
        title: 'กรุณาเลือกผู้รับมอบหมาย',
        description: 'คุณยังไม่ได้เลือกผู้ที่จะรับมอบหมายงาน',
        variant: 'destructive',
      });
      return;
    }

    if (!documentId || !documentType) {
      return;
    }

    setLoading(true);

    try {
      // Filter out users without valid user_id
      const userIds = selectedUsers
        .map(u => u.user_id)
        .filter(id => id != null && id !== '');

      if (userIds.length === 0) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่พบข้อมูลผู้ใช้ที่ถูกต้อง กรุณาเลือกผู้รับมอบหมายใหม่',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      await taskAssignmentService.createMultipleTaskAssignments(
        documentId,
        documentType,
        userIds,
        {
          note: note || undefined,
          taskDescription: taskDescription || undefined,
          eventDate: eventDate,
          eventTime: eventTime || undefined,
          location: location || undefined,
          selectionInfo: selectionInfo
        }
      );

      toast({
        title: '✅ มอบหมายงานสำเร็จ',
        description: `มอบหมายงานให้ ${selectedUsers.length} คนเรียบร้อยแล้ว`,
      });

      // Navigate back to documents page
      setTimeout(() => {
        navigate('/documents');
      }, 1500);
    } catch (error: any) {
      console.error('Error assigning tasks:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message || 'ไม่สามารถมอบหมายงานได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingDocument) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-24 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <div className="text-lg text-muted-foreground">กำลังโหลดข้อมูลเอกสาร...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/documents')}
            className="mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Button>

          <div className="flex items-center space-x-3 mb-2">
            <div className="p-3 bg-card rounded-2xl shadow-lg">
              <Users className="h-6 w-6 text-pink-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-muted-foreground">มอบหมายงาน</h1>
              <p className="text-muted-foreground">ทำตามขั้นตอนเพื่อมอบหมายงานให้ผู้รับผิดชอบ</p>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <StepIndicator
          currentStep={currentStep}
          totalSteps={4}
          stepLabels={stepLabels}
        />

        {/* Step Content */}
        <div className="mb-8 overflow-visible relative z-10">
          {currentStep === 1 && (
            <Step1DocumentPreview
              subject={document.subject}
              docNumber={document.doc_number}
              authorName={document.author_name}
              pdfUrl={document.pdf_url}
              directorComment={directorComment}
            />
          )}

          {currentStep === 2 && (
            <Step2SelectUsers
              selectedUsers={selectedUsers}
              onUsersChange={setSelectedUsers}
              selectionInfo={selectionInfo}
              onSelectionInfoChange={setSelectionInfo}
            />
          )}

          {currentStep === 3 && (
            <Step3TaskDetails
              selectedUsers={selectedUsers}
              taskDescription={taskDescription}
              onTaskDescriptionChange={setTaskDescription}
              eventDate={eventDate}
              onEventDateChange={setEventDate}
              eventTime={eventTime}
              onEventTimeChange={setEventTime}
              location={location}
              onLocationChange={setLocation}
              note={note}
              onNoteChange={setNote}
            />
          )}

          {currentStep === 4 && (
            <Step4Review
              subject={document.subject}
              docNumber={document.doc_number}
              selectedUsers={selectedUsers}
              note={note}
              taskDescription={taskDescription}
              eventDate={eventDate}
              eventTime={eventTime}
              location={location}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between gap-4 relative z-0">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1 || loading}
            className="px-6 border-pink-300 hover:bg-pink-50 relative z-0"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            ย้อนกลับ
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/documents')}
              disabled={loading}
              className="px-6 border-gray-300 hover:bg-gray-50 relative z-0"
            >
              ยกเลิก
            </Button>

            {currentStep < 4 ? (
              <Button
                onClick={handleNext}
                disabled={loading}
                className="px-6 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all relative z-0"
              >
                ถัดไป
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleAssignTasks}
                disabled={loading || selectedUsers.length === 0}
                className="px-6 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white shadow-md hover:shadow-lg transition-all relative z-0"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    กำลังมอบหมาย...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    มอบหมายงาน
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Modal */}
      <Dialog open={loading}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>กำลังมอบหมายงาน</DialogTitle>
          <DialogDescription>
            กรุณารอสักครู่... ระบบกำลังมอบหมายงานให้กับผู้ที่คุณเลือก
          </DialogDescription>
          <div className="flex flex-col items-center gap-4 mt-4">
            <svg className="animate-spin h-12 w-12 text-pink-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="text-lg font-medium text-foreground">กำลังส่งการแจ้งเตือน...</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaskAssignmentPage;
