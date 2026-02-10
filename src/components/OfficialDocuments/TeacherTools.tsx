
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  GraduationCap, 
  FileText, 
  Calendar, 
  Users, 
  BookOpen,
  Award,
  ClipboardList,
  UserPlus
} from 'lucide-react';

const TeacherTools: React.FC = () => {
  return (
    <Card className="bg-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5" />
          เครื่องมือครู
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950 hover:border-green-300 dark:border-green-700"
          >
            <FileText className="h-5 w-5 text-green-600" />
            <span className="text-sm">แผนการสอน</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950 hover:border-green-300 dark:border-green-700"
          >
            <Calendar className="h-5 w-5 text-green-600" />
            <span className="text-sm">ขอลาการสอน</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950 hover:border-green-300 dark:border-green-700"
          >
            <Users className="h-5 w-5 text-green-600" />
            <span className="text-sm">รายชื่อนักเรียน</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950 hover:border-green-300 dark:border-green-700"
          >
            <BookOpen className="h-5 w-5 text-green-600" />
            <span className="text-sm">หลักสูตร</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950 hover:border-green-300 dark:border-green-700"
          >
            <Award className="h-5 w-5 text-green-600" />
            <span className="text-sm">การประเมิน</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-green-50 dark:hover:bg-green-950 dark:bg-green-950 hover:border-green-300 dark:border-green-700"
          >
            <ClipboardList className="h-5 w-5 text-green-600" />
            <span className="text-sm">รายงานผล</span>
          </Button>
        </div>
        
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">สิทธิ์ครู</h4>
          <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
            <li>• สร้างและจัดการแผนการสอน</li>
            <li>• ขอลาการสอนและหาครูทดแทน</li>
            <li>• จัดการข้อมูลนักเรียน</li>
            <li>• รายงานผลการเรียนรู้</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeacherTools;
