
import React from 'react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-2 text-gray-800">กรุณาเข้าสู่ระบบ</h2>
          <p className="text-gray-600">เพื่อเข้าใช้งาน RSEC6 OfficeHub</p>
        </div>
      </div>
    );
  }

  // Show dashboard even if profile is still loading
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : 'ผู้ใช้งาน';

  const getPositionText = (position: string) => {
    const positions: Record<string, string> = {
      'director': 'ผู้อำนวยการ',
      'deputy_director': 'รองผู้อำนวยการ',
      'assistant_director': 'ผู้ช่วยผู้อำนวยการ',
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Welcome Section */}
        <div className="mb-8 bg-white rounded-2xl shadow-xl shadow-blue-500/10 p-8 border border-blue-100/20">
          <div className="relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 rounded-t-2xl opacity-90"></div>
            <div className="pt-20">
              <h1 className="text-4xl font-bold text-gray-800 mb-3 leading-tight">
                ยินดีต้อนรับ, {displayName}
              </h1>
              <p className="text-gray-600 text-lg">
                {profile?.employee_id} • {profile?.current_position || getPositionText(profile?.position || '')} • {profile?.workplace || 'ศูนย์การศึกษาพิเศษ เขตการศึกษา 6'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-white rounded-2xl shadow-xl shadow-blue-500/5 border border-blue-100/30 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group">
            <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 w-full"></div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Calendar className="h-8 w-8 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-3xl font-bold text-blue-600">12</span>
              </div>
              <h3 className="font-bold text-gray-800 mb-2 text-lg">คำขอลาทั้งหมด</h3>
              <p className="text-sm text-gray-600">รวมคำขอลาในระบบเดือนนี้</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-green-500/5 border border-green-100/30 overflow-hidden hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 group">
            <div className="bg-gradient-to-r from-green-400 to-green-600 h-3 w-full"></div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <FileText className="h-8 w-8 text-green-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-3xl font-bold text-green-600">8</span>
              </div>
              <h3 className="font-bold text-gray-800 mb-2 text-lg">เอกสารราชการ</h3>
              <p className="text-sm text-gray-600">รอการอนุมัติ 3 ฉบับ ทั้งหมด</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-orange-500/5 border border-orange-100/30 overflow-hidden hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300 group">
            <div className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 w-full"></div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <ClipboardList className="h-8 w-8 text-orange-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-3xl font-bold text-orange-600">25</span>
              </div>
              <h3 className="font-bold text-gray-800 mb-2 text-lg">รายงานประจำวัน</h3>
              <p className="text-sm text-gray-600">บันทึกการทำงานเดือนนี้</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-red-500/5 border border-red-100/30 overflow-hidden hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-300 group">
            <div className="bg-gradient-to-r from-red-400 to-red-600 h-3 w-full"></div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Bell className="h-8 w-8 text-red-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-3xl font-bold text-red-600">5</span>
              </div>
              <h3 className="font-bold text-gray-800 mb-2 text-lg">การแจ้งเตือน</h3>
              <p className="text-sm text-gray-600">ยังไม่ได้อ่าน ใหม่</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
          {/* Recent Activities */}
          <div className="bg-white rounded-2xl shadow-xl shadow-blue-500/5 border border-blue-100/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Clock className="h-6 w-6" />
                กิจกรรมล่าสุด
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200/50 hover:shadow-md transition-all duration-200">
                  <div className="p-2 bg-green-500 rounded-full">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">คำขอลาป่วยได้รับการอนุมัติ</p>
                    <p className="text-xs text-gray-500">2 ชั่วโมงที่แล้ว</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200/50 hover:shadow-md transition-all duration-200">
                  <div className="p-2 bg-blue-500 rounded-full">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">ส่งหนังสือราชการเรื่องจัดซื้อ</p>
                    <p className="text-xs text-gray-500">1 วันที่แล้ว</p>
                  </div>
                </div>
                <div className="flex items-center space-x-4 p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl border border-orange-200/50 hover:shadow-md transition-all duration-200">
                  <div className="p-2 bg-orange-500 rounded-full">
                    <ClipboardList className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">ส่งรายงานการปฏิบัติงานประจำวัน</p>
                    <p className="text-xs text-gray-500">2 วันที่แล้ว</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl shadow-xl shadow-purple-500/5 border border-purple-100/20 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-400 to-purple-600 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <TrendingUp className="h-6 w-6" />
                การดำเนินการด่วน
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                  <p className="text-sm font-semibold text-yellow-800 mb-1">รอการอนุมัติคำขอลา</p>
                  <p className="text-xs text-yellow-600 mb-3">มี 2 คำขอรอการพิจารณา</p>
                  <button className="btn-material text-xs px-3 py-1.5">
                    ดูรายละเอียด
                  </button>
                </div>
                <div className="p-5 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                  <p className="text-sm font-semibold text-blue-800 mb-1">เอกสารใหม่</p>
                  <p className="text-xs text-blue-600 mb-3">ได้รับหนังสือราชการ 1 ฉบับ</p>
                  <button className="btn-material text-xs px-3 py-1.5">
                    เปิดดู
                  </button>
                </div>
                <div className="p-5 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                  <p className="text-sm font-semibold text-green-800 mb-1">รายงานสำเร็จ</p>
                  <p className="text-xs text-green-600 mb-3">ส่งรายงานครบถ้วนแล้ว</p>
                  <button className="btn-material text-xs px-3 py-1.5">
                    ตรวจสอบ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-white rounded-2xl shadow-xl shadow-indigo-500/5 border border-indigo-100/20 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-400 to-indigo-600 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <Users className="h-6 w-6" />
                สำหรับผู้บริหาร
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl shadow-lg border border-orange-200/50 hover:shadow-xl transition-all duration-300 group">
                  <div className="bg-orange-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                    <span className="text-2xl font-bold text-white">7</span>
                  </div>
                  <h4 className="font-bold text-gray-800 mb-2 text-lg">คำขอรอพิจารณา</h4>
                  <button className="btn-material text-sm mt-3">
                    จัดการ
                  </button>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-red-50 to-red-100 rounded-2xl shadow-lg border border-red-200/50 hover:shadow-xl transition-all duration-300 group">
                  <div className="bg-red-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                    <span className="text-2xl font-bold text-white">3</span>
                  </div>
                  <h4 className="font-bold text-gray-800 mb-2 text-lg">เอกสารรอลงนาม</h4>
                  <button className="btn-material text-sm mt-3">
                    ลงนาม
                  </button>
                </div>
                <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-lg border border-green-200/50 hover:shadow-xl transition-all duration-300 group">
                  <div className="bg-green-500 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
                    <span className="text-2xl font-bold text-white">12</span>
                  </div>
                  <h4 className="font-bold text-gray-800 mb-2 text-lg">ประกาศทั้งหมด</h4>
                  <button className="btn-material text-sm mt-3">
                    จัดการ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="h-10" />
    </div>
  );
};

export default Dashboard;
