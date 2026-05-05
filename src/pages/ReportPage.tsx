import { useNavigate } from 'react-router-dom';
import { ClipboardList, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ReportPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white pb-32">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/newsfeed')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          กลับ
        </Button>

        <div className="bg-white rounded-2xl shadow-lg border border-border/40 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <ClipboardList className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">รายงานปฏิบัติงาน</h1>
          <p className="text-gray-500">หน้านี้กำลังพัฒนา — ฟอร์มรายงานจะพร้อมใช้งานเร็ว ๆ นี้</p>
        </div>
      </div>
    </div>
  );
};

export default ReportPage;
