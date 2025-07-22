import React, { useState } from 'react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Calendar, MapPin, Plus, Image } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const DailyReportsPage = () => {
  const { profile } = useEmployeeAuth();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    report_date: new Date().toISOString().split('T')[0],
    description: '',
    location: ''
  });

  // Mock data for demonstration
  const [dailyReports, setDailyReports] = useState([
    {
      id: '1',
      report_date: '2025-01-20',
      description: 'ประชุมวางแผนงานประจำปี 2568 และจัดเตรียมเอกสารสำหรับการตรวจประเมินคุณภาพการศึกษา',
      location: 'ห้องประชุมใหญ่ ศูนย์การศึกษาพิเศษ',
      created_at: '2025-01-20'
    },
    {
      id: '2',
      report_date: '2025-01-19',
      description: 'จัดกิจกรรมการเรียนการสอนเด็กพิเศษ กลุ่มสาระการเรียนรู้คณิตศาสตร์',
      location: 'ห้องเรียน A-101',
      created_at: '2025-01-19'
    },
    {
      id: '3',
      report_date: '2025-01-18',
      description: 'ติดตามและประเมินผลการเรียนของนักเรียน จัดทำรายงานความก้าวหน้า',
      location: 'ห้องปรึกษาการเรียน',
      created_at: '2025-01-18'
    }
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.description.trim()) {
      toast({
        title: "กรุณากรอกรายละเอียดงาน",
        variant: "destructive"
      });
      return;
    }

    const newReport = {
      id: (dailyReports.length + 1).toString(),
      ...formData,
      created_at: new Date().toISOString().split('T')[0]
    };

    setDailyReports([newReport, ...dailyReports]);
    setFormData({
      report_date: new Date().toISOString().split('T')[0],
      description: '',
      location: ''
    });
    setIsDialogOpen(false);
    
    toast({
      title: "บันทึกรายงานสำเร็จ",
      description: "รายงานประจำวันของคุณได้ถูกบันทึกแล้ว"
    });
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-xl shadow-blue-500/10 p-8 border border-blue-100/20">
            <div className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-16 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 rounded-t-2xl opacity-90"></div>
              <div className="pt-20 flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-gray-800 mb-3 leading-tight flex items-center gap-3">
                    <ClipboardList className="h-10 w-10 text-blue-600" />
                    รายงานประจำวัน
                  </h1>
                  <p className="text-gray-600 text-lg">บันทึกและติดตามการทำงานประจำวัน</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="btn-material flex items-center gap-2 text-lg px-6 py-3">
                      <Plus className="h-5 w-5" />
                      เพิ่มรายงานใหม่
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                      <DialogTitle>บันทึกรายงานประจำวัน</DialogTitle>
                      <DialogDescription>
                        กรอกรายละเอียดการทำงานของคุณในวันนี้
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="report_date">วันที่</Label>
                        <Input
                          id="report_date"
                          type="date"
                          value={formData.report_date}
                          onChange={(e) => setFormData({...formData, report_date: e.target.value})}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">รายละเอียดงาน</Label>
                        <Textarea
                          id="description"
                          placeholder="อธิบายงานที่ทำในวันนี้..."
                          value={formData.description}
                          onChange={(e) => setFormData({...formData, description: e.target.value})}
                          rows={4}
                          className="resize-none"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="location">สถานที่ (ไม่บังคับ)</Label>
                        <Input
                          id="location"
                          placeholder="เช่น ห้องเรียน A-101, ห้องประชุม"
                          value={formData.location}
                          onChange={(e) => setFormData({...formData, location: e.target.value})}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <button type="button" className="btn-material bg-gray-500 hover:bg-gray-600" onClick={() => setIsDialogOpen(false)}>
                          ยกเลิก
                        </button>
                        <button type="submit" className="btn-material">
                          บันทึกรายงาน
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-xl shadow-blue-500/5 border border-blue-100/30 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group">
              <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 w-full"></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <ClipboardList className="h-8 w-8 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-3xl font-bold text-blue-600">{dailyReports.length}</span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg">รายงานเดือนนี้</h3>
                <p className="text-sm text-gray-600">รายงานที่บันทึกแล้ว</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-green-500/5 border border-green-100/30 overflow-hidden hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 group">
              <div className="bg-gradient-to-r from-green-400 to-green-600 h-3 w-full"></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Calendar className="h-8 w-8 text-green-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-3xl font-bold text-green-600">7</span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg">รายงานสัปดาห์นี้</h3>
                <p className="text-sm text-gray-600">รายงานล่าสุด</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-orange-500/5 border border-orange-100/30 overflow-hidden hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300 group">
              <div className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 w-full"></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <MapPin className="h-8 w-8 text-orange-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-sm font-medium text-gray-900">วันนี้</span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg">อัพเดทล่าสุด</h3>
                <p className="text-sm text-gray-600">การปรับปรุงล่าสุด</p>
              </div>
            </div>
          </div>

          {/* Reports Table */}
          <div className="bg-white rounded-2xl shadow-xl shadow-blue-500/5 border border-blue-100/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <ClipboardList className="h-6 w-6" />
                ประวัติรายงานประจำวัน
              </h2>
              <p className="text-blue-100 mt-1">รายการรายงานการทำงานประจำวันทั้งหมดของคุณ</p>
            </div>
            <div className="p-6">
              {dailyReports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีรายงานประจำวัน</p>
                  <p className="text-sm">คลิก "เพิ่มรายงานใหม่" เพื่อเริ่มต้น</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>วันที่</TableHead>
                      <TableHead>รายละเอียดงาน</TableHead>
                      <TableHead>สถานที่</TableHead>
                      <TableHead>วันที่บันทึก</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {new Date(report.report_date).toLocaleDateString('th-TH')}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <p className="line-clamp-2">{report.description}</p>
                        </TableCell>
                        <TableCell>
                          {report.location ? (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <MapPin className="h-3 w-3" />
                              {report.location}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">ไม่ระบุ</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(report.created_at).toLocaleDateString('th-TH')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="h-10" />
    </div>
  );
};

export default DailyReportsPage;
