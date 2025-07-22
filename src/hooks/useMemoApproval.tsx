import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfiles } from '@/hooks/useProfiles';
import { useToast } from '@/hooks/use-toast';
import { MemoApprovalData, ApprovalStep } from '@/types/memoApproval';
import { callPDFSignatureAPI } from '@/services/pdfSignatureChainService';

// Mock approval workflow - in real app this would come from database
const mockApprovalSteps: ApprovalStep[] = [
  {
    id: '1',
    user_id: 'user1',
    name: 'นายสมชาย ใจดี',
    position: 'หัวหน้ากลุ่มงาน',
    signature_url: null,
    comment: '',
    status: 'pending',
    approved_at: null,
    step_order: 1
  },
  {
    id: '2',
    user_id: 'user2',
    name: 'นางสาววิภาดา ขยันดี',
    position: 'ครูผู้ช่วย',
    signature_url: null,
    comment: '',
    status: 'pending',
    approved_at: null,
    step_order: 2
  },
  {
    id: '3',
    user_id: 'user3',
    name: 'นายมนตรี ก้าวหน้า',
    position: 'ผู้อำนวยการ',
    signature_url: null,
    comment: '',
    status: 'pending',
    approved_at: null,
    step_order: 3
  }
];

export const useMemoApproval = (documentTitle: string, documentContent: string) => {
  const { toast } = useToast();
  const { profiles } = useProfiles();
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [memoData, setMemoData] = useState<MemoApprovalData | null>(null);
  const [approvalSteps] = useState<ApprovalStep[]>(mockApprovalSteps);

  useEffect(() => {
    loadCurrentUser();
    loadMemoData();
  }, [documentTitle, documentContent]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && profiles.length > 0) {
        const userProfile = profiles.find(p => p.user_id === user.id);
        setCurrentUser(userProfile);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadMemoData = () => {
    // Mock data - in real app this would load from database
    setMemoData({
      id: 'memo-001',
      document_title: documentTitle,
      content: documentContent,
      created_at: new Date().toISOString(),
      approvals: approvalSteps,
      status: 'pending'
    });
  };

  const handleApproval = async (action: 'approve' | 'reject', comment: string) => {
    if (!currentUser || !comment.trim()) {
      toast({
        title: "ข้อมูลไม่ครบถ้วน",
        description: "กรุณาใส่ความเห็น",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Find current user's step
      const currentStep = approvalSteps.find(step => 
        step.name === currentUser.first_name + ' ' + currentUser.last_name
      );

      if (!currentStep) {
        throw new Error('ไม่พบขั้นตอนการอนุมัติของคุณ');
      }

      // Update step status
      currentStep.status = action === 'approve' ? 'approved' : 'rejected';
      currentStep.comment = comment;
      currentStep.approved_at = new Date().toISOString();

      // Save to database (mock)

      // Check if this is the Director (last step) and approved
      const isDirector = currentStep.step_order === Math.max(...approvalSteps.map(s => s.step_order));
      const allApproved = approvalSteps.every(step => 
        step.step_order <= currentStep.step_order ? step.status === 'approved' : true
      );

      if (isDirector && action === 'approve' && allApproved && memoData) {
        // Collect all signature data and call API
        await callPDFSignatureAPI(memoData, approvalSteps);
        toast({
          title: "สำเร็จ",
          description: "สร้างเอกสาร PDF พร้อมลายเซ็นเรียบร้อยแล้ว",
        });
      } else {
        toast({
          title: "บันทึกสำเร็จ",
          description: `${action === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}เอกสารเรียบร้อยแล้ว`,
        });
      }

      // Refresh data
      loadMemoData();

    } catch (error) {
      console.error('Approval error:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  const getCurrentUserStep = () => {
    if (!currentUser) return null;
    return approvalSteps.find(step => 
      step.name === currentUser.first_name + ' ' + currentUser.last_name
    );
  };

  const canCurrentUserApprove = () => {
    const userStep = getCurrentUserStep();
    return userStep && userStep.status === 'pending';
  };

  return {
    loading,
    currentUser,
    memoData,
    approvalSteps,
    handleApproval,
    getCurrentUserStep,
    canCurrentUserApprove
  };
};