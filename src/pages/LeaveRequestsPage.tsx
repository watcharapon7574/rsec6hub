import React, { useState } from 'react';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, FileText, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const LeaveRequestsPage = () => {
  const { profile } = useEmployeeAuth();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: ''
  });

  // Mock data for demonstration
  const [leaveRequests, setLeaveRequests] = useState([
    {
      id: '1',
      leave_type: 'sick_leave',
      start_date: '2025-01-15',
      end_date: '2025-01-16',
      days_count: 2,
      reason: 'ป่วยเป็นไข้',
      status: 'pending',
      created_at: '2025-01-10'
    },
    {
      id: '2',
      leave_type: 'personal_leave',
      start_date: '2025-01-20',
      end_date: '2025-01-20',
      days_count: 1,
      reason: 'ธุระส่วนตัว',
      status: 'approved',
      created_at: '2025-01-05'
    }
  ]);

  const leaveTypeLabels = {
    sick_leave: 'ลาป่วย',
    personal_leave: 'ลากิจ',
    annual_leave: 'ลาพักผ่อน',
    maternity_leave: 'ลาคลอด',
    ordination_leave: 'ลาบวช'
  };

  const statusLabels = {
    pending: 'รอพิจารณา',
    approved: 'อนุมัติ',
    rejected: 'ไม่อนุมัติ',
    in_progress: 'กำลังพิจารณา'
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    in_progress: 'bg-blue-100 text-blue-800'
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.leave_type || !formData.start_date || !formData.end_date || !formData.reason) {
      toast({
        title: "กรุณากรอกข้อมูลให้ครบถ้วน",
        variant: "destructive"
      });
      return;
    }

    const days = calculateDays(formData.start_date, formData.end_date);
    
    const newRequest = {
      id: (leaveRequests.length + 1).toString(),
      ...formData,
      days_count: days,
      status: 'pending' as const,
      created_at: new Date().toISOString().split('T')[0]
    };

    setLeaveRequests([newRequest, ...leaveRequests]);
    setFormData({ leave_type: '', start_date: '', end_date: '', reason: '' });
    setIsDialogOpen(false);
    
    toast({
      title: "ส่งคำขอลาสำเร็จ",
      description: "คำขอลาของคุณได้ถูกส่งเพื่อรอการพิจารณาแล้ว"
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
                    <CalendarDays className="h-10 w-10 text-blue-600" />
                    คำขอลา
                  </h1>
                  <p className="text-gray-600 text-lg">จัดการคำขอลาของคุณ</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="btn-material flex items-center gap-2 text-lg px-6 py-3">
                      <Plus className="h-5 w-5" />
                      ขอลาใหม่
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>ยื่นคำขอลา</DialogTitle>
                      <DialogDescription>
                        กรอกข้อมูลคำขอลาของคุณให้ครบถ้วน
                      </DialogDescription>
                    </DialogHeader>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="leave_type">ประเภทการลา</Label>
                        <Select value={formData.leave_type} onValueChange={(value) => setFormData({...formData, leave_type: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกประเภทการลา" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sick_leave">ลาป่วย</SelectItem>
                            <SelectItem value="personal_leave">ลากิจ</SelectItem>
                            <SelectItem value="annual_leave">ลาพักผ่อน</SelectItem>
                            <SelectItem value="maternity_leave">ลาคลอด</SelectItem>
                            <SelectItem value="ordination_leave">ลาบวช</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start_date">วันที่เริ่มลา</Label>
                          <Input
                            id="start_date"
                            type="date"
                            value={formData.start_date}
                            onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end_date">วันที่สิ้นสุด</Label>
                          <Input
                            id="end_date"
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          />
                        </div>
                      </div>

                      {formData.start_date && formData.end_date && (
                        <div className="text-sm text-gray-600 flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          จำนวนวันลา: {calculateDays(formData.start_date, formData.end_date)} วัน
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="reason">เหตุผลการลา</Label>
                        <Textarea
                          id="reason"
                          placeholder="กรอกเหตุผลการลา..."
                          value={formData.reason}
                          onChange={(e) => setFormData({...formData, reason: e.target.value})}
                          rows={3}
                        />
                      </div>

                      <div className="flex justify-end gap-2">
                        <button type="button" className="btn-material bg-gray-500 hover:bg-gray-600" onClick={() => setIsDialogOpen(false)}>
                          ยกเลิก
                        </button>
                        <button type="submit" className="btn-material">
                          ส่งคำขอ
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl shadow-xl shadow-yellow-500/5 border border-yellow-100/30 overflow-hidden hover:shadow-2xl hover:shadow-yellow-500/10 transition-all duration-300 group">
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-3 w-full"></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Clock className="h-8 w-8 text-yellow-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-3xl font-bold text-yellow-600">
                    {leaveRequests.filter(req => req.status === 'pending').length}
                  </span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg">รอพิจารณา</h3>
                <p className="text-sm text-gray-600">คำขอที่รอการอนุมัติ</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-green-500/5 border border-green-100/30 overflow-hidden hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 group">
              <div className="bg-gradient-to-r from-green-400 to-green-600 h-3 w-full"></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <CalendarDays className="h-8 w-8 text-green-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-3xl font-bold text-green-600">
                    {leaveRequests.filter(req => req.status === 'approved').length}
                  </span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg">อนุมัติแล้ว</h3>
                <p className="text-sm text-gray-600">คำขอที่ได้รับอนุมัติ</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-red-500/5 border border-red-100/30 overflow-hidden hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-300 group">
              <div className="bg-gradient-to-r from-red-400 to-red-600 h-3 w-full"></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <FileText className="h-8 w-8 text-red-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-3xl font-bold text-red-600">
                    {leaveRequests.filter(req => req.status === 'rejected').length}
                  </span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg">ไม่อนุมัติ</h3>
                <p className="text-sm text-gray-600">คำขอที่ไม่ได้รับอนุมัติ</p>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl shadow-blue-500/5 border border-blue-100/30 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 group">
              <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 w-full"></div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <CalendarDays className="h-8 w-8 text-blue-600 group-hover:scale-110 transition-transform duration-200" />
                  <span className="text-3xl font-bold text-blue-600">{leaveRequests.length}</span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg">รวมทั้งหมด</h3>
                <p className="text-sm text-gray-600">คำขอลาทั้งหมด</p>
              </div>
            </div>
          </div>

          {/* Leave Requests Table */}
          <div className="bg-white rounded-2xl shadow-xl shadow-blue-500/5 border border-blue-100/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-400 to-blue-600 p-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-3">
                <FileText className="h-6 w-6" />
                ประวัติคำขอลา
              </h2>
              <p className="text-blue-100 mt-1">รายการคำขอลาทั้งหมดของคุณ</p>
            </div>
            <div className="p-6">
              {leaveRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีคำขอลา</p>
                  <p className="text-sm">คลิก "ขอลาใหม่" เพื่อเริ่มต้น</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ประเภทการลา</TableHead>
                      <TableHead>วันที่ลา</TableHead>
                      <TableHead>จำนวนวัน</TableHead>
                      <TableHead>เหตุผล</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>วันที่ยื่น</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaveRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell className="font-medium">
                          {leaveTypeLabels[request.leave_type as keyof typeof leaveTypeLabels]}
                        </TableCell>
                        <TableCell>
                          {new Date(request.start_date).toLocaleDateString('th-TH')} - {new Date(request.end_date).toLocaleDateString('th-TH')}
                        </TableCell>
                        <TableCell>{request.days_count} วัน</TableCell>
                        <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                            {statusLabels[request.status as keyof typeof statusLabels]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(request.created_at).toLocaleDateString('th-TH')}
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

export default LeaveRequestsPage;
