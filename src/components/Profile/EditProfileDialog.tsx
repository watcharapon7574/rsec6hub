import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Save, X } from 'lucide-react';
import { updateProfile, isPhoneDuplicate } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';

interface ProfileSummary {
  id: string;
  employee_id: string;
  prefix: string;
  first_name: string;
  last_name: string;
  phone: string;
  position: string;
  job_position: string;
  academic_rank: string;
  org_structure_role: string;
  workplace: string;
  telegram_chat_id?: string;
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ProfileSummary;
  onSuccess: () => void;
}

export const EditProfileDialog: React.FC<EditProfileDialogProps> = ({
  open,
  onOpenChange,
  profile,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Form state with lazy initialization
  const [formData, setFormData] = useState(() => ({
    prefix: profile.prefix || '',
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    phone: profile.phone || '',
    position: profile.position || '',
    job_position: profile.job_position || '',
    academic_rank: profile.academic_rank || '',
    org_structure_role: profile.org_structure_role || '',
    workplace: profile.workplace || '',
    telegram_chat_id: profile.telegram_chat_id || '',
  }));

  // Check if profile has telegram_chat_id
  const hasTelegramChatId = Boolean(profile.telegram_chat_id && profile.telegram_chat_id.trim());

  // Reset form when profile changes
  useEffect(() => {
    setFormData({
      prefix: profile.prefix || '',
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || '',
      position: profile.position || '',
      job_position: profile.job_position || '',
      academic_rank: profile.academic_rank || '',
      org_structure_role: profile.org_structure_role || '',
      telegram_chat_id: profile.telegram_chat_id || '',
    });
    setError('');
  }, [profile]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  const validateForm = async (): Promise<boolean> => {
    // ถ้าเลือก "ว่าง" ไม่ต้อง validate fields อื่น
    if (formData.position === 'vacant') {
      return true;
    }

    // Required fields
    if (!formData.prefix.trim()) {
      setError('กรุณากรอกคำนำหน้าชื่อ');
      return false;
    }
    if (!formData.first_name.trim()) {
      setError('กรุณากรอกชื่อ');
      return false;
    }
    if (!formData.last_name.trim()) {
      setError('กรุณากรอกนามสกุล');
      return false;
    }
    if (!formData.position) {
      setError('กรุณาเลือกตำแหน่ง');
      return false;
    }

    // Phone validation (optional but must be valid if provided)
    if (formData.phone.trim()) {
      const phoneRegex = /^0\d{9}$/;
      if (!phoneRegex.test(formData.phone)) {
        setError('เบอร์โทรไม่ถูกต้อง (ต้องเป็น 10 หลัก เริ่มต้นด้วย 0)');
        return false;
      }

      // Check phone duplicate (exclude current profile)
      const isDuplicate = await isPhoneDuplicate(formData.phone, profile.id);
      if (isDuplicate) {
        setError('เบอร์โทรนี้มีในระบบแล้ว');
        return false;
      }
    }

    return true;
  };

  const handleConfirmSubmit = () => {
    setShowConfirmDialog(true);
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setLoading(true);
      setShowConfirmDialog(false);

      // Validate
      const isValid = await validateForm();
      if (!isValid) {
        setLoading(false);
        return;
      }

      // ถ้าเลือก "ว่าง" ให้ล้างข้อมูลทั้งหมดตอนบันทึก
      const dataToSave = formData.position === 'vacant'
        ? {
            position: 'vacant',
            prefix: '',
            first_name: '',
            last_name: '',
            phone: '',
            job_position: '',
            academic_rank: '',
            org_structure_role: '',
            workplace: '',
            telegram_chat_id: '',
          }
        : formData;

      // Update profile
      await updateProfile(profile.id, dataToSave);

      // Success
      const successMsg = formData.position === 'vacant'
        ? `ล้างข้อมูล profile ${profile.employee_id} เรียบร้อยแล้ว (พร้อมใส่คนใหม่)`
        : `อัพเดทข้อมูล ${formData.prefix} ${formData.first_name} ${formData.last_name} เรียบร้อยแล้ว`;

      toast({
        title: 'สำเร็จ',
        description: successMsg,
      });

      onSuccess();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล');
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถอัพเดทข้อมูลได้',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลโปรไฟล์</DialogTitle>
          <DialogDescription>
            รหัสบุคลากร: <span className="font-mono font-bold">{profile.employee_id}</span>
            {' • '}
            แก้ไขข้อมูลส่วนตัวและตำแหน่งของบุคลากร
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Row 1: Prefix + First Name + Last Name */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prefix">คำนำหน้า *</Label>
              <Select value={formData.prefix} onValueChange={(v) => handleChange('prefix', v)}>
                <SelectTrigger id="prefix">
                  <SelectValue placeholder="เลือก" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="นาย">นาย</SelectItem>
                  <SelectItem value="นาง">นาง</SelectItem>
                  <SelectItem value="นางสาว">นางสาว</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1 space-y-2">
              <Label htmlFor="first_name">ชื่อ *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => handleChange('first_name', e.target.value)}
                placeholder="ชื่อจริง"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="last_name">นามสกุล *</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => handleChange('last_name', e.target.value)}
                placeholder="นามสกุล"
              />
            </div>
          </div>

          {/* Row 2: Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">เบอร์โทร</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="0812345678"
              type="tel"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              รูปแบบ: 10 หลัก เริ่มต้นด้วย 0 (เช่น 0812345678)
            </p>
          </div>

          {/* Row 3: Position */}
          <div className="space-y-2">
            <Label htmlFor="position">ตำแหน่ง *</Label>
            <Select value={formData.position} onValueChange={(v) => handleChange('position', v)}>
              <SelectTrigger id="position">
                <SelectValue placeholder="เลือกตำแหน่ง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant" className="text-orange-600 dark:text-orange-400 font-medium">🔸 ว่าง (ล้างข้อมูลทั้งหมด)</SelectItem>
                <SelectItem value="director">ผู้อำนวยการ</SelectItem>
                <SelectItem value="deputy_director">รองผู้อำนวยการ</SelectItem>
                <SelectItem value="assistant_director">หัวหน้าฝ่าย (ระบุใน "บทบาทในโครงสร้าง")</SelectItem>
                <SelectItem value="government_teacher">ข้าราชการครู</SelectItem>
                <SelectItem value="government_employee">พนักงานราชการ</SelectItem>
                <SelectItem value="contract_teacher">ครูอัตราจ้าง</SelectItem>
                <SelectItem value="clerk_teacher">ครูธุรการ</SelectItem>
                <SelectItem value="disability_aide">พี่เลี้ยงเด็กพิการ</SelectItem>
              </SelectContent>
            </Select>
            {formData.position === 'vacant' && (
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                ⚠️ เมื่อกดบันทึก จะล้างข้อมูลทั้งหมดของ profile นี้ เพื่อรอใส่คนใหม่
              </p>
            )}
          </div>

          {/* Row 4: Job Position */}
          <div className="space-y-2">
            <Label htmlFor="job_position">ตำแหน่งงาน</Label>
            <Input
              id="job_position"
              value={formData.job_position}
              onChange={(e) => handleChange('job_position', e.target.value)}
              placeholder="เช่น ครูผู้สอน, ครูผู้ช่วย, ฯลฯ"
            />
          </div>

          {/* Row 5: Academic Rank */}
          <div className="space-y-2">
            <Label htmlFor="academic_rank">วิทยฐานะ</Label>
            <Input
              id="academic_rank"
              value={formData.academic_rank}
              onChange={(e) => handleChange('academic_rank', e.target.value)}
              placeholder="เช่น ครูชำนาญการพิเศษ, ครูผู้ช่วย, ฯลฯ"
            />
          </div>

          {/* Row 6: Org Structure Role */}
          <div className="space-y-2">
            <Label htmlFor="org_structure_role">บทบาทในโครงสร้าง</Label>
            <Input
              id="org_structure_role"
              value={formData.org_structure_role}
              onChange={(e) => handleChange('org_structure_role', e.target.value)}
              placeholder="เช่น หัวหน้ากลุ่มสาระ, หัวหน้าระดับชั้น, ฯลฯ"
            />
          </div>

          {/* Row 7: Workplace */}
          <div className="space-y-2">
            <Label htmlFor="workplace">สถานที่ทำงาน (ห้องเรียน/หน่วยฯ)</Label>
            <Input
              id="workplace"
              value={formData.workplace}
              onChange={(e) => handleChange('workplace', e.target.value)}
              placeholder="เช่น ห้องเรียนคู่ขนานบ้านหมี่, หน่วยบริการพัฒนานิคม"
            />
          </div>

          {/* Row 8: Telegram Chat ID (แสดงเฉพาะเมื่อมีค่าอยู่แล้ว) */}
          {hasTelegramChatId && (
            <div className="space-y-2">
              <Label htmlFor="telegram_chat_id" className="flex items-center gap-2">
                Telegram Chat ID
                <span className="text-xs text-blue-600 dark:text-blue-400 dark:text-blue-600 font-normal">(แก้ไขได้เฉพาะคนที่มี Chat ID)</span>
              </Label>
              <Input
                id="telegram_chat_id"
                value={formData.telegram_chat_id}
                onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
                placeholder="เช่น 123456789"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Chat ID สำหรับรับการแจ้งเตือนผ่าน Telegram Bot
              </p>
            </div>
          )}

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 dark:text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
              <strong>หมายเหตุ:</strong> รหัสบุคลากร (employee_id) ไม่สามารถแก้ไขได้ • ฟิลด์ที่มี * จำเป็นต้องกรอก
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="border-border hover:bg-muted"
          >
            <X className="h-4 w-4 mr-2" />
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirmSubmit}
            disabled={loading}
            className="!bg-blue-600 hover:!bg-blue-700 !text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                บันทึกการแก้ไข
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการแก้ไขข้อมูล</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการบันทึกการแก้ไขข้อมูลของ{' '}
              <strong>
                {formData.prefix} {formData.first_name} {formData.last_name}
              </strong>{' '}
              (รหัสบุคลากร: <strong>{profile.employee_id}</strong>) หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border hover:bg-muted">
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmit}
              className="!bg-blue-600 hover:!bg-blue-700 !text-white"
            >
              ยืนยันการบันทึก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};
