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
            <CardContent className="bg-teal-600 rounded-t-lg pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-teal-100" />
                    รายงานประจำวัน
                  </h1>
                  <p className="text-sm text-teal-100">บันทึกและติดตามการทำงานประจำวัน</p>
                </div>
                
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      เพิ่มรายงานใหม่
                    </Button>
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
                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                          ยกเลิก
                        </Button>
                        <Button type="submit">
                          บันทึกรายงาน
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Statistics Cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-teal-100">
                    <ClipboardList className="h-4 w-4 text-teal-600" />
                  </div>
                  <span className="text-2xl font-bold text-teal-600">{dailyReports.length}</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">เดือนนี้</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-green-100">
                    <Calendar className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-2xl font-bold text-green-600">7</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">สัปดาห์นี้</h3>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <MapPin className="h-4 w-4 text-orange-600" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">วันนี้</span>
                </div>
                <h3 className="font-semibold text-foreground text-sm">ล่าสุด</h3>
              </CardContent>
            </Card>
          </div>

          {/* Reports Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
                ประวัติรายงานประจำวัน
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dailyReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
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
                            <span className="text-muted-foreground text-sm">ไม่ระบุ</span>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DailyReportsPage;
