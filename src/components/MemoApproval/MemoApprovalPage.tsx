
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { useProfiles } from '@/hooks/useProfiles';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Calendar,
  FileText,
  MessageSquare
} from 'lucide-react';

interface MemoWorkflow {
  id: string;
  document_number: string;
  subject: string;
  content: any;
  document_date: string;
  status: string;
  current_step: number;
  created_by: string;
  signature_positions: any;
  created_at: string;
  updated_at: string;
}

interface ApprovalStep {
  id: string;
  workflow_id: string;
  step_order: number;
  approver_id: string;
  approver_name: string;
  approver_position: string;
  status: string;
  approved_at?: string;
  comment?: string;
  signature_position: any;
  created_at: string;
}

const MemoApprovalPage = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const { getProfileByEmployeeId } = useProfiles();
  const { toast } = useToast();

  const [workflow, setWorkflow] = useState<MemoWorkflow | null>(null);
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (workflowId) {
      fetchWorkflowData();
    }
  }, [workflowId]);

  const fetchWorkflowData = async () => {
    try {
      setLoading(true);

      // Fetch workflow
      const { data: workflowData, error: workflowError } = await supabase
        .from('memo_workflows')
        .select('*')
        .eq('id', workflowId)
        .single();

      if (workflowError) throw workflowError;

      // Fetch approval steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('memo_approval_steps')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('step_order', { ascending: true });

      if (stepsError) throw stepsError;

      setWorkflow(workflowData);
      setApprovalSteps(stepsData || []);
    } catch (error: any) {
      console.error('Error fetching workflow:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถโหลดข้อมูลเอกสารได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (approved: boolean) => {
    if (!workflow || !profile) return;

    setSubmitting(true);
    try {
      // Find current user's approval step
      const currentStep = approvalSteps.find(
        step => step.approver_id === profile.user_id && step.status === 'pending'
      );

      if (!currentStep) {
        throw new Error('ไม่พบขั้นตอนการอนุมัติสำหรับผู้ใช้นี้');
      }

      // Update approval step
      const { error: stepError } = await supabase
        .from('memo_approval_steps')
        .update({
          status: approved ? 'approved' : 'rejected',
          approved_at: new Date().toISOString(),
          comment: comment || null,
        })
        .eq('id', currentStep.id);

      if (stepError) throw stepError;

      // Check if this is the last step or if rejected
      let newWorkflowStatus = workflow.status;
      let newCurrentStep = workflow.current_step;

      if (!approved) {
        newWorkflowStatus = 'rejected';
      } else {
        const nextStep = workflow.current_step + 1;
        const hasNextStep = approvalSteps.some(step => step.step_order === nextStep);
        
        if (hasNextStep) {
          newCurrentStep = nextStep;
          newWorkflowStatus = 'pending';
        } else {
          newWorkflowStatus = 'approved';
        }
      }

      // Update workflow
      const { error: workflowError } = await supabase
        .from('memo_workflows')
        .update({
          status: newWorkflowStatus,
          current_step: newCurrentStep,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workflowId);

      if (workflowError) throw workflowError;

      toast({
        title: approved ? 'อนุมัติสำเร็จ' : 'ปฏิเสธสำเร็จ',
        description: `เอกสารได้รับการ${approved ? 'อนุมัติ' : 'ปฏิเสธ'}แล้ว`,
      });

      // Refresh data
      await fetchWorkflowData();
      
      // Navigate back after a delay
      setTimeout(() => {
        navigate('/documents');
      }, 2000);

    } catch (error: any) {
      console.error('Error processing approval:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">ไม่พบเอกสาร</h2>
          <Button onClick={() => navigate('/documents')}>
            กลับไปหน้าเอกสาร
          </Button>
        </div>
      </div>
    );
  }

  const canApprove = profile && approvalSteps.some(
    step => step.approver_id === profile.user_id && 
           step.status === 'pending' && 
           step.step_order === workflow.current_step
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 dark:text-green-200">อนุมัติแล้ว</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 dark:text-red-200">ปฏิเสธ</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:text-yellow-200">รอการอนุมัติ</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">การอนุมัติเอกสาร</h1>
            <p className="text-muted-foreground mt-1">เลขที่เอกสาร: {workflow.document_number}</p>
          </div>
          {getStatusBadge(workflow.status)}
        </div>

        {/* Document Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>รายละเอียดเอกสาร</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">เรื่อง</Label>
              <p className="text-lg font-medium">{workflow.subject}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">วันที่เอกสาร</Label>
                <p>{new Date(workflow.document_date).toLocaleDateString('th-TH')}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">วันที่สร้าง</Label>
                <p>{new Date(workflow.created_at).toLocaleDateString('th-TH')}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">เนื้อหา</Label>
              <div className="bg-muted p-4 rounded-lg mt-2">
                {workflow.content && typeof workflow.content === 'object' ? (
                  <div dangerouslySetInnerHTML={{ __html: workflow.content.html || 'ไม่มีเนื้อหา' }} />
                ) : (
                  <p>{workflow.content || 'ไม่มีเนื้อหา'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>ขั้นตอนการอนุมัติ</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {approvalSteps.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {step.status === 'approved' ? (
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                    ) : step.status === 'rejected' ? (
                      <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    ) : step.step_order === workflow.current_step ? (
                      <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400 animate-pulse" />
                    ) : (
                      <Clock className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{step.approver_name}</h4>
                        <p className="text-sm text-muted-foreground">{step.approver_position}</p>
                      </div>
                      {getStatusBadge(step.status)}
                    </div>
                    
                    {step.approved_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {new Date(step.approved_at).toLocaleString('th-TH')}
                      </p>
                    )}
                    
                    {step.comment && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        <MessageSquare className="h-3 w-3 inline mr-1" />
                        {step.comment}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Approval Actions */}
        {canApprove && workflow.status === 'pending' && (
          <Card>
            <CardHeader>
              <CardTitle>การอนุมัติ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="comment">ความคิดเห็น (ไม่บังคับ)</Label>
                <Textarea
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="เพิ่มความคิดเห็นหรือหมายเหตุ..."
                  rows={3}
                />
              </div>
              
              <div className="flex space-x-4">
                <Button
                  onClick={() => handleApproval(true)}
                  disabled={submitting}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  อนุมัติ
                </Button>
                <Button
                  onClick={() => handleApproval(false)}
                  disabled={submitting}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  ปฏิเสธ
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back Button */}
        <div className="text-center">
          <Button 
            variant="outline" 
            onClick={() => navigate('/documents')}
          >
            กลับไปหน้าเอกสาร
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MemoApprovalPage;
