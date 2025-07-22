
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Settings, 
  Users, 
  FileText, 
  BarChart, 
  Shield,
  Archive,
  UserCheck,
  Calendar
} from 'lucide-react';

const ManagementTools: React.FC = () => {
  return (
    <Card className="bg-white shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-lg">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" />
          เครื่องมือผู้บริหาร
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-purple-50 hover:border-purple-300"
          >
            <Users className="h-5 w-5 text-purple-600" />
            <span className="text-sm">จัดการผู้ใช้</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-purple-50 hover:border-purple-300"
          >
            <BarChart className="h-5 w-5 text-purple-600" />
            <span className="text-sm">รายงานสถิติ</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-purple-50 hover:border-purple-300"
          >
            <Shield className="h-5 w-5 text-purple-600" />
            <span className="text-sm">จัดการสิทธิ์</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-purple-50 hover:border-purple-300"
          >
            <Archive className="h-5 w-5 text-purple-600" />
            <span className="text-sm">เอกสารเก่า</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-purple-50 hover:border-purple-300"
          >
            <UserCheck className="h-5 w-5 text-purple-600" />
            <span className="text-sm">อนุมัติรายการ</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="flex flex-col h-20 gap-2 hover:bg-purple-50 hover:border-purple-300"
          >
            <Calendar className="h-5 w-5 text-purple-600" />
            <span className="text-sm">กำหนดการ</span>
          </Button>
        </div>
        
        <div className="mt-6 p-4 bg-purple-50 rounded-lg">
          <h4 className="font-semibold text-purple-800 mb-2">สิทธิ์ผู้บริหาร</h4>
          <ul className="text-sm text-purple-700 space-y-1">
            <li>• อนุมัติเอกสารทุกประเภท</li>
            <li>• จัดการผู้ใช้และสิทธิ์การเข้าถึง</li>
            <li>• ดูรายงานและสถิติระบบ</li>
            <li>• จัดการเอกสารเก่าและการเก็บถาวร</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ManagementTools;
