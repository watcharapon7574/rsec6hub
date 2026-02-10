
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  FileText, 
  Calendar, 
  Printer, 
  Phone,
  Mail,
  Folder,
  Calculator
} from 'lucide-react';

const EmployeeTools: React.FC = () => {
  return (
    <Card className="bg-card shadow-lg">
      <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5" />
          เครื่องมือเจ้าหน้าที่
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 hover:border-blue-300 dark:border-blue-700"
          >
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="text-sm">เอกสารธุรการ</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 hover:border-blue-300 dark:border-blue-700"
          >
            <Calendar className="h-5 w-5 text-blue-600" />
            <span className="text-sm">ขอลางาน</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 hover:border-blue-300 dark:border-blue-700"
          >
            <Printer className="h-5 w-5 text-blue-600" />
            <span className="text-sm">พิมพ์เอกสาร</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 hover:border-blue-300 dark:border-blue-700"
          >
            <Phone className="h-5 w-5 text-blue-600" />
            <span className="text-sm">สมุดโทรศัพท์</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 hover:border-blue-300 dark:border-blue-700"
          >
            <Mail className="h-5 w-5 text-blue-600" />
            <span className="text-sm">จดหมายเวียน</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-blue-50 dark:hover:bg-blue-950 dark:bg-blue-950 hover:border-blue-300 dark:border-blue-700"
          >
            <Calculator className="h-5 w-5 text-blue-600" />
            <span className="text-sm">คำนวณเงินเดือน</span>
          </Button>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">สิทธิ์เจ้าหน้าที่</h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• จัดการเอกสารธุรการทั่วไป</li>
            <li>• ขอลางานและจัดการวันหยุด</li>
            <li>• เข้าถึงข้อมูลติดต่อภายใน</li>
            <li>• พิมพ์และจัดทำเอกสาร</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeTools;
