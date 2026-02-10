
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ApprovalProcess: React.FC = () => {
  const steps = [
    {
      step: 1,
      title: 'เจ้าหน้าที่ธุรการ',
      description: 'ตรวจสอบเอกสาร',
      color: 'blue'
    },
    {
      step: 2,
      title: 'ผู้ช่วยผู้อำนวยการ',
      description: 'พิจารณาเบื้องต้น',
      color: 'green'
    },
    {
      step: 3,
      title: 'รองผู้อำนวยการ',
      description: 'อนุมัติระดับกลาง',
      color: 'gray'
    },
    {
      step: 4,
      title: 'ผู้อำนวยการ',
      description: 'อนุมัติสุดท้าย',
      color: 'purple'
    }
  ];

  const getStepColors = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          circle: 'bg-blue-500',
          hover: 'hover:bg-blue-100'
        };
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          circle: 'bg-green-500',
          hover: 'hover:bg-green-100'
        };
      case 'gray':
        return {
          bg: 'bg-muted',
          border: 'border-border',
          circle: 'bg-muted0',
          hover: 'hover:bg-accent'
        };
      case 'purple':
        return {
          bg: 'bg-purple-50',
          border: 'border-purple-200',
          circle: 'bg-purple-500',
          hover: 'hover:bg-purple-100'
        };
      default:
        return {
          bg: 'bg-muted',
          border: 'border-border',
          circle: 'bg-muted0',
          hover: 'hover:bg-accent'
        };
    }
  };

  return (
    <div className="w-full">
      <Card className="bg-card shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <CardTitle className="text-white text-lg">ขั้นตอนการอนุมัติ</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step) => {
              const colors = getStepColors(step.color);
              return (
                <div
                  key={step.step}
                  className={`text-center p-4 rounded-lg border transition-all duration-200 ${colors.bg} ${colors.border} ${colors.hover}`}
                >
                  <div className={`w-12 h-12 ${colors.circle} rounded-full flex items-center justify-center mx-auto mb-3`}>
                    <span className="text-white font-bold text-lg">{step.step}</span>
                  </div>
                  <h4 className="font-semibold text-muted-foreground mb-2 text-sm">{step.title}</h4>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-foreground">
                <span className="font-medium text-blue-800">หมายเหตุ:</span> หลังจากผ่านการอนุมัติแล้ว เอกสารจะได้รับเลขที่อ้างอิงอัตโนมัติ
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ApprovalProcess;
