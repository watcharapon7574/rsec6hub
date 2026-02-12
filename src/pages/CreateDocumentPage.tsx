import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Signature } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';

const CreateDocumentPage = () => {
  const navigate = useNavigate();
  const { getPermissions } = useEmployeeAuth();
  const permissions = getPermissions();

  const documentOptions = [
    {
      id: 'memo',
      title: 'สร้างบันทึกข้อความ',
      description: 'สร้างบันทึกข้อความใหม่จากแบบฟอร์ม',
      icon: FileText,
      color: 'bg-blue-500 hover:bg-blue-600',
      path: '/create-memo'
    },
    // แสดงหนังสือรับเฉพาะ Admin หรือธุรการเท่านั้น
    ...((permissions.isAdmin || permissions.isClerk) ? [{
      id: 'pdf-sign',
      title: 'หนังสือรับ',
      description: 'หนังสือรับมาเป็น PDF เพื่อเกษียนหนังสือภายในสถานศึกษา',
      icon: Signature,
      color: 'bg-green-500 hover:bg-green-600',
      path: '/create-doc-receive'
    }] : [])
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-muted-foreground mb-4">
              สร้างเอกสารใหม่
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
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
                    <CardTitle className="text-xl text-foreground">
                      {option.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center pb-8">
                    <p className="text-muted-foreground mb-6">
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

          {/* Spacer for FloatingNavbar */}
          <div className="h-32" />
        </div>
      </div>
    </div>
  );
};

export default CreateDocumentPage;