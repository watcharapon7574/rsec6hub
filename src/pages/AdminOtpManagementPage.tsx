import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  UserPlus,
  AlertCircle,
  Shield,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import {
  getAdminRecipients,
  addAdminRecipient,
  toggleRecipientStatus,
  getAdminLoginLogs,
  type AdminOtpRecipient,
  type AdminLoginLog,
} from '@/services/adminOtpService';

const ADMIN_PHONE = '036776259';

export default function AdminOtpManagementPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, loading: authLoading } = useEmployeeAuth();

  const [recipients, setRecipients] = useState<AdminOtpRecipient[]>([]);
  const [loginLogs, setLoginLogs] = useState<AdminLoginLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [telegramChatId, setTelegramChatId] = useState('');
  const [recipientName, setRecipientName] = useState('');

  // Check admin permission
  useEffect(() => {
    if (!authLoading && profile && !profile.is_admin) {
      toast({
        title: 'ไม่มีสิทธิ์เข้าถึง',
        description: 'เฉพาะ Admin เท่านั้นที่สามารถเข้าถึงหน้านี้ได้',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [authLoading, profile, navigate, toast]);

  // Load recipients
  const loadRecipients = async () => {
    try {
      setLoading(true);
      const data = await getAdminRecipients(ADMIN_PHONE);
      setRecipients(data || []);
    } catch (err: any) {
      console.error('Error loading recipients:', err);
      setRecipients([]); // Set empty array on error to prevent white screen
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถโหลดรายชื่อ recipients ได้ (ตารางอาจยังไม่ถูกสร้าง)',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Load login logs
  const loadLoginLogs = async () => {
    try {
      setLogsLoading(true);
      const data = await getAdminLoginLogs(ADMIN_PHONE, 50);
      setLoginLogs(data || []);
    } catch (err: any) {
      console.error('Error loading login logs:', err);
      setLoginLogs([]); // Set empty array on error to prevent white screen
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถโหลด login logs ได้ (ตารางอาจยังไม่ถูกสร้าง)',
        variant: 'destructive',
      });
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.is_admin) {
      loadRecipients();
      loadLoginLogs();
    }
  }, [profile]);

  // Handle add recipient
  const handleAddRecipient = async () => {
    try {
      setError('');
      setIsSubmitting(true);

      if (!profile?.id) {
        throw new Error('ไม่พบข้อมูลผู้ใช้');
      }

      await addAdminRecipient(ADMIN_PHONE, telegramChatId, recipientName, profile.id);

      toast({
        title: 'สำเร็จ',
        description: `เพิ่ม ${recipientName} เรียบร้อยแล้ว`,
      });

      // Reset form and close dialog
      setTelegramChatId('');
      setRecipientName('');
      setIsAddDialogOpen(false);

      // Reload recipients
      loadRecipients();
    } catch (err: any) {
      console.error('Error adding recipient:', err);
      setError(err.message || 'ไม่สามารถเพิ่ม recipient ได้');
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถเพิ่ม recipient ได้',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle toggle status
  const handleToggleStatus = async (recipientId: string, currentStatus: boolean) => {
    try {
      await toggleRecipientStatus(recipientId, !currentStatus);

      toast({
        title: 'สำเร็จ',
        description: `${!currentStatus ? 'เปิด' : 'ปิด'}การใช้งานเรียบร้อยแล้ว`,
      });

      loadRecipients();
    } catch (err: any) {
      console.error('Error toggling status:', err);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถเปลี่ยนสถานะได้',
        variant: 'destructive',
      });
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (authLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!profile.is_admin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="border-l-4 border-blue-500 pl-4">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Shield className="h-8 w-8 text-blue-600" />
              จัดการ Admin OTP Recipients
            </h1>
            <p className="text-gray-600">
              จัดการรายชื่อคนที่จะรับ OTP เมื่อ Admin (036776259) เข้าสู่ระบบ
            </p>
          </div>
        </div>

        {/* Recipients Section */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                รายชื่อผู้รับ OTP
              </div>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                เพิ่ม Recipient
              </Button>
            </CardTitle>
            <CardDescription className="text-blue-50">
              จำนวนทั้งหมด: {recipients.length} คน (Active: {recipients.filter((r) => r.is_active).length} คน)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : recipients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">ยังไม่มีรายชื่อ recipients</p>
                <p className="text-sm">เริ่มต้นโดยการเพิ่ม recipient ใหม่</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อ-นามสกุล</TableHead>
                    <TableHead>Telegram Chat ID</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่เพิ่ม</TableHead>
                    <TableHead className="text-right">การจัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.map((recipient) => (
                    <TableRow key={recipient.id}>
                      <TableCell className="font-medium">{recipient.recipient_name}</TableCell>
                      <TableCell className="font-mono">{recipient.telegram_chat_id}</TableCell>
                      <TableCell>
                        {recipient.is_active ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {formatDate(recipient.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant={recipient.is_active ? 'destructive' : 'default'}
                          size="sm"
                          onClick={() => handleToggleStatus(recipient.id, recipient.is_active)}
                        >
                          {recipient.is_active ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Login History Section */}
        <Card className="shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-400 to-green-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                ประวัติการเข้าใช้งาน
              </div>
              <Button
                onClick={loadLoginLogs}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-green-500"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                รีเฟรช
              </Button>
            </CardTitle>
            <CardDescription className="text-green-50">
              แสดง 50 รายการล่าสุด
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              </div>
            ) : loginLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">ยังไม่มีประวัติการเข้าใช้งาน</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>วันเวลา</TableHead>
                    <TableHead>ชื่อผู้ใช้</TableHead>
                    <TableHead>Chat ID</TableHead>
                    <TableHead>OTP ที่ใช้</TableHead>
                    <TableHead>สถานะ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loginLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {formatDate(log.logged_in_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.recipient_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.telegram_chat_id}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.otp_code || '-'}
                      </TableCell>
                      <TableCell>
                        {log.login_success ? (
                          <Badge className="bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            สำเร็จ
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            ล้มเหลว
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add Recipient Dialog */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่ม Admin OTP Recipient</DialogTitle>
              <DialogDescription>
                เพิ่มคนที่จะรับ OTP เมื่อ Admin (036776259) login
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="chatId">Telegram Chat ID *</Label>
                <Input
                  id="chatId"
                  type="text"
                  placeholder="เช่น 123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  กรอกตัวเลข Chat ID ของ Telegram เท่านั้น
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setTelegramChatId('');
                  setRecipientName('');
                  setError('');
                }}
                disabled={isSubmitting}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleAddRecipient}
                disabled={isSubmitting || !telegramChatId || !recipientName}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    กำลังเพิ่ม...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    เพิ่ม Recipient
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
