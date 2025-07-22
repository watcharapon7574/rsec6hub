
import React from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface WorkflowData {
  id: string;
  document_number: string;
  subject: string;
  content: any;
  document_date: string;
  status: string;
  current_step: number;
  signature_positions: any;
}

interface ApprovalStep {
  id: string;
  step_order: number;
  approver_name: string;
  approver_position: string;
  signature_position: any;
  status: string;
  comment?: string;
  approved_at?: string;
}

interface MemoApprovalPreviewProps {
  workflow: WorkflowData;
  approvalSteps: ApprovalStep[];
  currentUserStep: ApprovalStep | null;
}

const MemoApprovalPreview: React.FC<MemoApprovalPreviewProps> = ({
  workflow,
  approvalSteps,
  currentUserStep
}) => {
  const formatThaiDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd MMMM yyyy', { locale: th });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border border-gray-300 shadow-lg relative">
      {/* A4 Paper Simulation */}
      <div className="aspect-[210/297] p-12 text-sm leading-relaxed relative overflow-hidden">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-lg font-bold mb-2">บันทึกข้อความ</h1>
          <div className="flex justify-between text-sm">
            <span>ส่วนราชการ: โรงเรียนสิรินธรราชวิทยาลัย สระแก้ว</span>
            <span>วันที่: {formatThaiDate(workflow.document_date)}</span>
          </div>
          <div className="text-right text-sm mt-2">
            <span>เลขที่: {workflow.document_number}</span>
          </div>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <span className="font-semibold">เรื่อง </span>
          <span>{workflow.subject}</span>
        </div>

        {/* Content */}
        <div className="space-y-4 mb-8">
          {workflow.content.introduction && (
            <div>
              <p className="mb-2"><span className="font-semibold">1. ต้นเรื่อง</span></p>
              <p className="indent-8">{workflow.content.introduction}</p>
            </div>
          )}

          {workflow.content.facts && (
            <div>
              <p className="mb-2"><span className="font-semibold">2. ข้อเท็จจริง</span></p>
              <p className="indent-8">{workflow.content.facts}</p>
            </div>
          )}

          {workflow.content.recommendation && (
            <div>
              <p className="mb-2"><span className="font-semibold">3. ข้อเสนอและพิจารณา</span></p>
              <p className="indent-8">{workflow.content.recommendation}</p>
            </div>
          )}
        </div>

        {/* Signature Section */}
        <div className="absolute bottom-12 left-12 right-12">
          {/* Show approval steps with signatures */}
          {approvalSteps.map((step) => (
            <div
              key={step.id}
              className="absolute text-center"
              style={{
                left: `${step.signature_position.x}px`,
                top: `${step.signature_position.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              {/* Signature placeholder */}
              <div className={`w-24 h-12 border-2 flex items-center justify-center text-xs mb-2 ${
                step.status === 'approved'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : step.id === currentUserStep?.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-dashed border-gray-300 bg-gray-50 text-gray-500'
              }`}>
                {step.status === 'approved' 
                  ? '✓ ลงนามแล้ว'
                  : step.id === currentUserStep?.id
                  ? 'รอลงนาม'
                  : 'รอดำเนินการ'
                }
              </div>
              
              {/* Name and position */}
              <div className="text-xs">
                <p className="font-medium">({step.approver_name})</p>
                <p>{step.approver_position}</p>
                {step.approved_at && (
                  <p className="text-gray-500 mt-1">
                    {formatThaiDate(step.approved_at)}
                  </p>
                )}
              </div>

              {/* Comment */}
              {step.comment && (
                <div className="mt-2 text-xs text-gray-600 max-w-32">
                  <p className="font-medium">ความเห็น:</p>
                  <p className="text-wrap">{step.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemoApprovalPreview;
