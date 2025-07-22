import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Upload, Signature, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CreateDocumentPage = () => {
  const navigate = useNavigate();

  const documentOptions = [
    {
      id: 'memo',
      title: 'สร้างบันทึกข้อความ',
      description: 'สร้างบันทึกข้อความใหม่จากแบบฟอร์ม',
      icon: FileText,
      color: 'bg-blue-500 hover:bg-blue-600',
      path: '/create-memo'
    },
    {
      id: 'pdf-sign',
      title: 'ลงนาม PDF',
      description: 'อัปโหลด PDF และเพิ่มลายเซ็น',
      icon: Signature,
      color: 'bg-green-500 hover:bg-green-600',
      path: '/pdf-signature'
    },
    {
      id: 'workflow',
      title: 'เวิร์กโฟลว์อนุมัติ',
      description: 'สร้างเอกสารที่ต้องผ่านการอนุมัติ',
      icon: Upload,
      color: 'bg-purple-500 hover:bg-purple-600',
      path: '/documents?tab=workflow'
    },
    {
      id: 'templates',
      title: 'เทมเพลตเอกสาร',
      description: 'เลือกจากเทมเพลตที่มีอยู่',
      icon: Download,
      color: 'bg-orange-500 hover:bg-orange-600',
      path: '/documents?tab=templates'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              สร้างเอกสารใหม่
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              เลือกประเภทเอกสารที่ต้องการสร้าง
            </p>
          </div>

          {/* Document Options Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {documentOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <Card 
                  key={option.id}
                  className="hover:shadow-lg transition-all duration-200 cursor-pointer group"
                  onClick={() => navigate(option.path)}
                >
                  <CardHeader className="text-center">
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${option.color} text-white mb-4 mx-auto group-hover:scale-110 transition-transform duration-200`}>
                      <IconComponent className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-xl text-gray-800">
                      {option.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center pb-8">
                    <p className="text-gray-600 mb-6">
                      {option.description}
                    </p>
                    <Button 
                      className={`w-full ${option.color} text-white shadow-lg group-hover:shadow-xl transition-all duration-200`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(option.path);
                      }}
                    >
                      เริ่มต้น
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Access */}
          <div className="mt-12">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-center text-gray-800">
                  การเข้าถึงด่วน
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-1"
                    onClick={() => navigate('/documents')}
                  >
                    <FileText className="h-5 w-5" />
                    <span className="text-xs">เอกสารทั้งหมด</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-1"
                    onClick={() => navigate('/documents?status=pending')}
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-xs">รออนุมัติ</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-1"
                    onClick={() => navigate('/documents?status=approved')}
                  >
                    <Download className="h-5 w-5" />
                    <span className="text-xs">อนุมัติแล้ว</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-1"
                    onClick={() => navigate('/dashboard')}
                  >
                    <Signature className="h-5 w-5" />
                    <span className="text-xs">หน้าหลัก</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="h-10" />
        </div>
      </div>
    </div>
  );
};

export default CreateDocumentPage;