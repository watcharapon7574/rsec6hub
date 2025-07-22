import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface WorkflowNavigationProps {
  currentStep: number;
  canProceedToNextStep: boolean;
  loading: boolean;
  onPreviousStep: () => void;
  onNextStep: () => void;
  onSubmit: () => void;
}

const WorkflowNavigation: React.FC<WorkflowNavigationProps> = ({
  currentStep,
  canProceedToNextStep,
  loading,
  onPreviousStep,
  onNextStep,
  onSubmit
}) => {
  return (
    <div className="flex justify-between">
      <Button
        variant="outline"
        onClick={onPreviousStep}
        disabled={currentStep === 1}
      >
        ย้อนกลับ
      </Button>
      
      {currentStep < 4 ? (
        <Button
          onClick={onNextStep}
          disabled={!canProceedToNextStep}
        >
          ถัดไป
        </Button>
      ) : (
        <Button 
          onClick={onSubmit} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          {loading ? 'กำลังสร้าง...' : 'ดาวน์โหลดเอกสาร'}
        </Button>
      )}
    </div>
  );
};

export default WorkflowNavigation;