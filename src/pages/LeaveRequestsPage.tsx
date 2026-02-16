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
    pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    approved: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    rejected: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    in_progress: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="space-y-6">
          {/* Header */}
          <Card>
            <CardContent className="bg-orange-500 rounded-t-lg pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-orange-100" />
                    คำขอลา
                  </h1>
                  <p className="text-sm text-orange-100">จัดการคำขอลาของคุณ</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      ขอลาใหม่
                    </Button>
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
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
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
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          ยกเลิก
                        </Button>
                        <Button type="submit">
                          ส่งคำขอ
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 dark:text-amber-600" />
                  </div>
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 dark:text-amber-600">
                    {leaveRequests.filter(req => req.status === 'pending').length}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">รอพิจารณา</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                    <CalendarDays className="h-4 w-4 text-green-600 dark:text-green-400 dark:text-green-600" />
                  </div>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400 dark:text-green-600">
                    {leaveRequests.filter(req => req.status === 'approved').length}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">อนุมัติแล้ว</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                    <FileText className="h-4 w-4 text-red-600 dark:text-red-400 dark:text-red-600" />
                  </div>
                  <span className="text-2xl font-bold text-red-600 dark:text-red-400 dark:text-red-600">
                    {leaveRequests.filter(req => req.status === 'rejected').length}
                  </span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">ไม่อนุมัติ</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                    <CalendarDays className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">{leaveRequests.length}</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">รวมทั้งหมด</h3>
              </CardContent>
            </Card>
          </div>

          {/* Leave Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                ประวัติคำขอลา
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>ยังไม่มีคำขอลา</p>
                  <p className="text-sm">คลิก "ขอลาใหม่" เพื่อเริ่มต้น</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestsPage;
