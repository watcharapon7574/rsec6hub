import React from 'react';
import { Label } from '@/components/ui/label';
import { ApprovalStep } from '@/types/memoApproval';
import { getStatusIcon, getStatusText } from '@/utils/approvalUtils';

interface ApprovalStepsProps {
  approvalSteps: ApprovalStep[];
}

const ApprovalSteps: React.FC<ApprovalStepsProps> = ({ approvalSteps }) => {
  return (
    <div className="space-y-4">
      <Label className="text-base font-medium">ขั้นตอนการอนุมัติ</Label>
      <div className="space-y-3">
        {approvalSteps.map((step, index) => (
          <div key={step.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                {index + 1}
              </div>
              <div>
                <div className="font-medium">{step.name}</div>
                <div className="text-sm text-muted-foreground">{step.position}</div>
                {step.comment && (
                  <div className="text-sm text-muted-foreground mt-1">
                    ความเห็น: {step.comment}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(step.status)}
              <span className="text-sm">{getStatusText(step.status)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApprovalSteps;