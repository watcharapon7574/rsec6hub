import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface WorkflowProgressBarProps {
  currentStep: number;
}

const WorkflowProgressBar: React.FC<WorkflowProgressBarProps> = ({ currentStep }) => {
  const progressValue = (currentStep / 4) * 100;

  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-muted-foreground">ขั้นตอนที่ {currentStep} จาก 4</span>
          <span className="text-sm text-muted-foreground">{Math.round(progressValue)}%</span>
        </div>
        <Progress value={progressValue} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>อัปโหลด PDF</span>
          <span>เลือกผู้ลงนาม</span>
          <span>จัดตำแหน่ง</span>
          <span>ดาวน์โหลด</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowProgressBar;