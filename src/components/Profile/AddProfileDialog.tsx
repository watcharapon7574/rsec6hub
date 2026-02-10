import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Loader2, AlertCircle, UserPlus, X } from 'lucide-react';
import { createProfileWithAuth, getNextEmployeeId, isPhoneDuplicate } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';

interface AddProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddProfileDialog: React.FC<AddProfileDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nextEmployeeId, setNextEmployeeId] = useState('');
  const [loadingEmployeeId, setLoadingEmployeeId] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    prefix: '',
    first_name: '',
    last_name: '',
    phone: '',
    position: '',
    job_position: '',
    academic_rank: '',
    org_structure_role: '',
  });

  // Load next employee_id when dialog opens
  useEffect(() => {
    if (open) {
      loadNextEmployeeId();
    }
  }, [open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData({
        prefix: '',
        first_name: '',
        last_name: '',
        phone: '',
        position: '',
        job_position: '',
        academic_rank: '',
        org_structure_role: '',
      });
      setError('');
      setNextEmployeeId('');
    }
  }, [open]);

  const loadNextEmployeeId = async () => {
    try {
      setLoadingEmployeeId(true);
      const nextId = await getNextEmployeeId();
      setNextEmployeeId(nextId);
    } catch (error: any) {
      console.error('Error loading next employee_id:', error);
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถสร้างรหัสบุคลากรถัดไปได้',
        variant: 'destructive',
      });
    } finally {
      setLoadingEmployeeId(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(''); // Clear error when user types
  };

  const validateForm = async (): Promise<boolean> => {
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
    if (!formData.phone.trim()) {
      setError('กรุณากรอกเบอร์โทร');
      return false;
    }
    if (!formData.position) {
      setError('กรุณาเลือกตำแหน่ง');
      return false;
    }

    // Phone validation
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('เบอร์โทรไม่ถูกต้อง (ต้องเป็น 10 หลัก เริ่มต้นด้วย 0)');
      return false;
    }

    // Check phone duplicate
    const isDuplicate = await isPhoneDuplicate(formData.phone);
    if (isDuplicate) {
      setError('เบอร์โทรนี้มีในระบบแล้ว');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setLoading(true);

      // Validate
      const isValid = await validateForm();
      if (!isValid) {
        setLoading(false);
        return;
      }

      // Create profile with Auth account
      const newProfile = await createProfileWithAuth(formData);

      // Success
      toast({
        title: 'สำเร็จ',
        description: `เพิ่มโปรไฟล์ ${formData.prefix} ${formData.first_name} ${formData.last_name} (${newProfile.employee_id}) พร้อม Auth account เรียบร้อยแล้ว`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error creating profile:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการเพิ่มโปรไฟล์');
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: err.message || 'ไม่สามารถเพิ่มโปรไฟล์ได้',
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
          <DialogTitle>เพิ่มโปรไฟล์ใหม่</DialogTitle>
          <DialogDescription>
            เพิ่มบุคลากรใหม่และสร้าง Supabase Auth account อัตโนมัติ
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

          {/* Next Employee ID Preview */}
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              {loadingEmployeeId ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังสร้างรหัสบุคลากร...
                </div>
              ) : (
                <div>
                  <strong>รหัสบุคลากรที่จะสร้าง:</strong>{' '}
                  <span className="font-mono font-bold text-lg">{nextEmployeeId}</span>
                </div>
              )}
            </AlertDescription>
          </Alert>

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
            <Label htmlFor="phone">เบอร์โทร *</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="0812345678"
              type="tel"
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              รูปแบบ: 10 หลัก เริ่มต้นด้วย 0 (เช่น 0812345678) • จะถูกใช้สร้าง Auth account
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

          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
              <strong>หมายเหตุ:</strong> ระบบจะสร้าง Supabase Auth account โดยอัตโนมัติพร้อมกับโปรไฟล์ •
              รหัสบุคลากร (employee_id) จะถูกสร้างอัตโนมัติและไม่สามารถแก้ไขได้ •
              ฟิลด์ที่มี * จำเป็นต้องกรอก
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            ยกเลิก
          </Button>
          <Button onClick={handleSubmit} disabled={loading || loadingEmployeeId}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                กำลังสร้างโปรไฟล์...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                เพิ่มโปรไฟล์
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
