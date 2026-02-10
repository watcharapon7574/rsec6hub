
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, 
  FileText, 
  ClipboardList, 
  Bell, 
  Users,
  TrendingUp,
  CheckCircle,
  Clock
} from 'lucide-react';

const Dashboard = () => {
  const { profile, loading, isAuthenticated } = useEmployeeAuth();

  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="text-center p-8">
          <h2 className="text-xl font-semibold mb-2 text-foreground">กรุณาเข้าสู่ระบบ</h2>
          <p className="text-muted-foreground">เพื่อเข้าใช้งาน RSEC6 OfficeHub</p>
        </Card>
      </div>
    );
  }

  // Show dashboard even if profile is still loading
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : 'ผู้ใช้งาน';

  const getPositionText = (position: string) => {
    const positions: Record<string, string> = {
      'director': 'ผู้อำนวยการ',
      'deputy_director': 'รองผู้อำนวยการ',
      'assistant_director': 'หัวหน้าฝ่าย',
      'government_teacher': 'ข้าราชการครู',
      'government_employee': 'พนักงานราชการ',
      'contract_teacher': 'ครูอัตราจ้าง',
      'clerk_teacher': 'ครูธุรการ',
      'disability_aide': 'พี่เลี้ยงเด็กพิการ'
    };
    return positions[position] || position;
  };

  const isAdmin = profile?.position && ['director', 'deputy_director', 'assistant_director'].includes(profile.position);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Welcome Section */}
        <Card className="mb-6">
          <CardContent className="bg-blue-600 rounded-t-lg pt-6">
            <div className="flex items-center gap-4">
              <img
                src="/fastdocIcon.png"
                alt="RSEC6 OfficeHub Icon"
                className="h-10 w-10 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  ยินดีต้อนรับ, {displayName}
                </h1>
                <p className="text-sm text-blue-100">
                  {profile?.employee_id} • {profile?.job_position || profile?.current_position || getPositionText(profile?.position || '')} • {profile?.workplace || 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/leave-requests')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-orange-100">
                  <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">12</span>
              </div>
              <h3 className="font-semibold text-foreground text-sm">คำขอลา</h3>
              <p className="text-xs text-muted-foreground">เดือนนี้</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/documents')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-blue-100">
                  <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">8</span>
              </div>
              <h3 className="font-semibold text-foreground text-sm">เอกสาร</h3>
              <p className="text-xs text-muted-foreground">รอ 3 ฉบับ</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/daily-reports')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-teal-100">
                  <ClipboardList className="h-5 w-5 text-teal-600" />
                </div>
                <span className="text-2xl font-bold text-teal-600">25</span>
              </div>
              <h3 className="font-semibold text-foreground text-sm">รายงาน</h3>
              <p className="text-xs text-muted-foreground">เดือนนี้</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/notifications')}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-rose-100">
                  <Bell className="h-5 w-5 text-rose-600" />
                </div>
                <span className="text-2xl font-bold text-rose-600">5</span>
              </div>
              <h3 className="font-semibold text-foreground text-sm">แจ้งเตือน</h3>
              <p className="text-xs text-muted-foreground">ยังไม่อ่าน</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
          {/* Recent Activities */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                กิจกรรมล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900">
                  <div className="p-1.5 bg-green-500 rounded-full">
                    <CheckCircle className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">คำขอลาป่วยได้รับการอนุมัติ</p>
                    <p className="text-xs text-muted-foreground">2 ชั่วโมงที่แล้ว</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900">
                  <div className="p-1.5 bg-blue-500 rounded-full">
                    <FileText className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">ส่งหนังสือราชการเรื่องจัดซื้อ</p>
                    <p className="text-xs text-muted-foreground">1 วันที่แล้ว</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 border border-teal-100">
                  <div className="p-1.5 bg-teal-500 rounded-full">
                    <ClipboardList className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">ส่งรายงานการปฏิบัติงานประจำวัน</p>
                    <p className="text-xs text-muted-foreground">2 วันที่แล้ว</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                การดำเนินการด่วน
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">รอการอนุมัติคำขอลา</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">มี 2 คำขอรอการพิจารณา</p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/leave-requests')}>
                    ดูรายละเอียด
                  </Button>
                </div>
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">เอกสารใหม่</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">ได้รับหนังสือราชการ 1 ฉบับ</p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/documents')}>
                    เปิดดู
                  </Button>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">รายงานสำเร็จ</p>
                  <p className="text-xs text-green-600 dark:text-green-400 mb-2">ส่งรายงานครบถ้วนแล้ว</p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/daily-reports')}>
                    ตรวจสอบ
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                สำหรับผู้บริหาร
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-100 dark:border-amber-900">
                  <div className="bg-amber-500 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-white">7</span>
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">คำขอรอพิจารณา</h4>
                  <Button size="sm" variant="outline" onClick={() => navigate('/leave-requests')}>
                    จัดการ
                  </Button>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-900">
                  <div className="bg-blue-500 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-white">3</span>
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">เอกสารรอลงนาม</h4>
                  <Button size="sm" variant="outline" onClick={() => navigate('/documents')}>
                    ลงนาม
                  </Button>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900">
                  <div className="bg-green-500 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                    <span className="text-lg font-bold text-white">12</span>
                  </div>
                  <h4 className="font-semibold text-foreground mb-2">ประกาศทั้งหมด</h4>
                  <Button size="sm" variant="outline">
                    จัดการ
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
