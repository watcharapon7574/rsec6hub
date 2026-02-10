
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { memoWorkflowService } from '@/services/memoWorkflowService';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { supabase } from '@/integrations/supabase/client';
import MemoApprovalPreview from './MemoApprovalPreview';

const MemoApprovalPage = () => {
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();
  
  const [workflow, setWorkflow] = useState<any>(null);
  const [approvalSteps, setApprovalSteps] = useState<any[]>([]);
  const [currentUserStep, setCurrentUserStep] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (workflowId) {
      loadWorkflowData();
    }
  }, [workflowId]);

  const loadWorkflowData = async () => {
    try {
      setLoading(true);
      const { workflow: workflowData, steps } = await memoWorkflowService.getWorkflowById(workflowId!);
      
      setWorkflow(workflowData);
      setApprovalSteps(steps);
      
      // หาขั้นตอนของผู้ใช้ปัจจุบัน (สำหรับ demo)
      const currentStep = steps.find(step => 
        step.status === 'pending' && step.step_order === workflowData.current_step
      );
      setCurrentUserStep(currentStep);
      
    } catch (error) {
      console.error('Error loading workflow:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลเอกสารได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!currentUserStep || !workflow) return;

    setProcessing(true);
    try {
      // อัปเดตสถานะของขั้นตอนปัจจุบัน
      const { error: updateError } = await supabase
        .from('memo_approval_steps')
        .update({
          status: 'approved',
          comment: comment,
          approved_at: new Date().toISOString()
        })
        .eq('id', currentUserStep.id);

      if (updateError) throw updateError;

      // ตรวจสอบว่าเป็นขั้นตอนสุดท้ายหรือไม่
      const maxStepOrder = Math.max(...approvalSteps.map(s => s.step_order));
      const isLastStep = currentUserStep.step_order === maxStepOrder;
      
      const newStatus = isLastStep ? 'completed' : 'in_progress';
      const newCurrentStep = isLastStep ? currentUserStep.step_order : currentUserStep.step_order + 1;

      // อัปเดตสถานะ workflow
      const { error: workflowError } = await supabase
        .from('memo_workflows')
        .update({
          status: newStatus,
          current_step: newCurrentStep
        })
        .eq('id', workflow.id);

      if (workflowError) throw workflowError;

      toast({
        title: "ลงนามสำเร็จ",
        description: isLastStep ? "เอกสารได้รับการอนุมัติครบถ้วนแล้ว" : "ส่งต่อไปยังผู้ลงนามคนต่อไป",
      });

      // รีเฟรชข้อมูล
      await loadWorkflowData();

    } catch (error) {
      console.error('Error approving:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลงนามได้",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!currentUserStep || !workflow) return;

    setProcessing(true);
    try {
      // อัปเดตสถานะของขั้นตอนปัจจุบัน
      const { error: updateError } = await supabase
        .from('memo_approval_steps')
        .update({
          status: 'rejected',
          comment: comment,
          approved_at: new Date().toISOString()
        })
        .eq('id', currentUserStep.id);

      if (updateError) throw updateError;

      // อัปเดตสถานะ workflow เป็น rejected
      const { error: workflowError } = await supabase
        .from('memo_workflows')
        .update({
          status: 'rejected'
        })
        .eq('id', workflow.id);

      if (workflowError) throw workflowError;

      toast({
        title: "ตีกลับเอกสารสำเร็จ",
        description: "เอกสารถูกส่งกลับให้ผู้สร้างแก้ไข",
      });

      // รีเฟรชข้อมูล
      await loadWorkflowData();

    } catch (error) {
      console.error('Error rejecting:', error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถตีกลับเอกสารได้",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBack = () => {
    navigate('/documents');
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
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-muted-foreground mb-2">ไม่พบเอกสาร</h2>
          <Button onClick={handleBack}>กลับ</Button>
        </div>
      </div>
    );
  }

  const canApprove = currentUserStep && currentUserStep.status === 'pending';
  const isWaitingForPrevious = !canApprove && workflow.status !== 'completed' && workflow.status !== 'rejected';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="bg-card rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับ
            </Button>
            <div className="border-l-4 border-blue-500 pl-4 flex-1">
              <h1 className="text-3xl font-bold text-muted-foreground mb-2">ลงนามบันทึกข้อความ</h1>
              <p className="text-muted-foreground">เลขที่: {workflow.document_number}</p>
              <p className="text-muted-foreground">เรื่อง: {workflow.subject}</p>
            </div>
            <div className="flex items-center gap-2">
              {workflow.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">เสร็จสิ้น</span>
                </div>
              )}
              {workflow.status === 'in_progress' && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">อยู่ระหว่างดำเนินการ</span>
                </div>
              )}
              {workflow.status === 'rejected' && (
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="h-5 w-5" />
                  <span className="font-medium">ถูกตีกลับ</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document Preview */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>ตัวอย่างเอกสาร</CardTitle>
              </CardHeader>
              <CardContent>
                <MemoApprovalPreview 
                  workflow={workflow} 
                  approvalSteps={approvalSteps}
                  currentUserStep={currentUserStep}
                />
              </CardContent>
            </Card>
          </div>

          {/* Approval Panel */}
          <div className="space-y-6">
            {/* Status Card */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">สถานะการลงนาม</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {approvalSteps.map((step) => (
                    <div key={step.id} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step.status === 'approved' 
                          ? 'bg-green-100 text-green-700 dark:text-green-300'
                          : step.status === 'rejected'
                          ? 'bg-red-100 text-red-700 dark:text-red-300'
                          : step.status === 'pending' && step.step_order === workflow.current_step
                          ? 'bg-blue-100 text-blue-700 dark:text-blue-300'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.step_order}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{step.approver_position}</p>
                        <p className="text-sm text-muted-foreground">{step.approver_name}</p>
                        {step.comment && (
                          <p className="text-xs text-muted-foreground mt-1">"{step.comment}"</p>
                        )}
                      </div>
                      <div>
                        {step.status === 'approved' && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {step.status === 'rejected' && (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        {step.status === 'pending' && step.step_order === workflow.current_step && (
                          <Clock className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Approval Actions */}
            {canApprove && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">การลงนาม</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">ความเห็น</label>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="ใส่ความเห็นของท่าน (ถ้ามี)"
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={processing}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {processing ? 'กำลังลงนาม...' : 'อนุมัติ'}
                    </Button>
                    <Button
                      onClick={handleReject}
                      disabled={processing}
                      variant="destructive"
                      className="flex-1"
                    >
                      {processing ? 'กำลังตีกลับ...' : 'ตีกลับ'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isWaitingForPrevious && (
              <Card className="shadow-lg border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">รอผู้ลงนามลำดับก่อนหน้า</h3>
                  </div>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    กรุณารอให้ผู้ลงนามลำดับที่ {workflow.current_step - 1} ลงนามก่อน
                  </p>
                </CardContent>
              </Card>
            )}

            {workflow.status === 'completed' && (
              <Card className="shadow-lg border-green-200 dark:border-green-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-800 dark:text-green-200">เอกสารเสร็จสิ้น</h3>
                  </div>
                  <p className="text-green-700 dark:text-green-300 mb-4">
                    เอกสารได้รับการลงนามครบถ้วนแล้ว
                  </p>
                  <Button variant="outline" className="w-full">
                    ดาวน์โหลด PDF
                  </Button>
                </CardContent>
              </Card>
            )}

            {workflow.status === 'rejected' && (
              <Card className="shadow-lg border-red-200 dark:border-red-800">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <XCircle className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold text-red-800 dark:text-red-200">เอกสารถูกตีกลับ</h3>
                  </div>
                  <p className="text-red-700 dark:text-red-300">
                    เอกสารถูกตีกลับและส่งกลับให้ผู้สร้างแก้ไข
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoApprovalPage;
