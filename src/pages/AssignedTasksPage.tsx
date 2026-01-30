import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Card } from '@/components/ui/card';
import AssignedTasksList from '@/components/TaskAssignment/AssignedTasksList';

const AssignedTasksPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 pt-20 pb-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-white rounded-2xl shadow-primary">
              <ClipboardList className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">งานที่ได้รับมอบหมาย</h1>
              <p className="text-muted-foreground">
                รายการงานที่คุณได้รับมอบหมายจากธุรการ
              </p>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        <AssignedTasksList />
      </div>
    </div>
  );
};

export default AssignedTasksPage;
