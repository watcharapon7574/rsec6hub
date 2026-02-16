import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Hash, CalendarDays, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';

interface RegisterFormProps {
  registerType: 'internal' | 'external';
  onSaved: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ registerType, onSaved }) => {
  const { toast } = useToast();
  const { profile } = useEmployeeAuth();

  const currentBuddhistYear = new Date().getFullYear() + 543;
  const yearShort = currentBuddhistYear.toString().slice(-2);

  const [loading, setLoading] = useState(false);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [loadingNumber, setLoadingNumber] = useState(true);

  // Form state
  const [docReference, setDocReference] = useState('ศธ ๐๔๐๐๗.๖๐๐/');
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromOrg, setFromOrg] = useState('');
  const [toPerson, setToPerson] = useState('ผอ.ศูนย์การศึกษาพิเศษ เขตการศึกษา 6');
  const [subject, setSubject] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [remarks, setRemarks] = useState('');

  const fetchNextNumber = useCallback(async () => {
    setLoadingNumber(true);
    try {
      let maxNumber = 0;

      if (registerType === 'internal') {
        const { data: memoData } = await supabase
          .from('memos')
          .select('doc_number')
          .not('doc_number_status', 'is', null)
          .is('doc_del', null);

        if (memoData) {
          for (const m of memoData) {
            const match = (m.doc_number as string)?.match(/(\d+)\//);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxNumber) maxNumber = num;
            }
          }
        }

        const { data: manualData } = await (supabase as any)
          .from('document_register_manual')
          .select('register_number')
          .eq('register_type', 'internal')
          .eq('year', currentBuddhistYear)
          .order('register_number', { ascending: false })
          .limit(1);

        if (manualData && manualData.length > 0 && manualData[0].register_number > maxNumber) {
          maxNumber = manualData[0].register_number;
        }
      } else {
        const { data: docData } = await (supabase as any)
          .from('doc_receive')
          .select('doc_number')
          .not('doc_number_status', 'is', null)
          .is('doc_del', null);

        if (docData) {
          for (const d of docData) {
            const match = (d.doc_number as string)?.match(/(\d+)\//);
            if (match) {
              const num = parseInt(match[1]);
              if (num > maxNumber) maxNumber = num;
            }
          }
        }

        const { data: manualData } = await (supabase as any)
          .from('document_register_manual')
          .select('register_number')
          .eq('register_type', 'external')
          .eq('year', currentBuddhistYear)
          .order('register_number', { ascending: false })
          .limit(1);

        if (manualData && manualData.length > 0 && manualData[0].register_number > maxNumber) {
          maxNumber = manualData[0].register_number;
        }
      }

      setNextNumber(maxNumber + 1);
    } catch (err) {
      console.error('Error fetching next number:', err);
    } finally {
      setLoadingNumber(false);
    }
  }, [registerType, currentBuddhistYear]);

  useEffect(() => {
    fetchNextNumber();
  }, [fetchNextNumber]);

  const resetForm = () => {
    setDocReference('ศธ ๐๔๐๐๗.๖๐๐/');
    setDocDate(new Date().toISOString().split('T')[0]);
    setFromOrg('');
    setToPerson('ผอ.ศูนย์การศึกษาพิเศษ เขตการศึกษา 6');
    setSubject('');
    setActionTaken('');
    setRemarks('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      toast({
        title: 'กรุณากรอกข้อมูล',
        description: 'เรื่อง เป็นข้อมูลจำเป็น',
        variant: 'destructive',
      });
      return;
    }

    if (!fromOrg.trim()) {
      toast({
        title: 'กรุณากรอกข้อมูล',
        description: 'จาก เป็นข้อมูลจำเป็น',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const paddedNumber = String(nextNumber).padStart(4, '0');

      const { error } = await (supabase as any).from('document_register_manual').insert({
        register_type: registerType,
        register_number: nextNumber,
        doc_reference: docReference,
        doc_date: docDate,
        from_org: fromOrg,
        to_person: toPerson,
        subject: subject,
        action_taken: actionTaken || null,
        remarks: remarks || null,
        year: currentBuddhistYear,
        created_by: profile?.user_id,
        doc_number: `${paddedNumber}/${yearShort}`,
      });

      if (error) throw error;

      toast({
        title: 'บันทึกสำเร็จ',
        description: `เพิ่มรายการเลขทะเบียนรับ ${paddedNumber}/${yearShort} แล้ว`,
      });

      resetForm();
      fetchNextNumber();
      onSaved();
    } catch (err: any) {
      console.error('Error saving manual entry:', err);
      toast({
        title: 'บันทึกไม่สำเร็จ',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isInternal = registerType === 'internal';
  const accentColor = isInternal ? 'orange' : 'purple';

  return (
    <div className="space-y-4">
      {/* Auto-fill info banner */}
      <div className={`rounded-lg border p-4 ${isInternal ? 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800' : 'bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800'}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${isInternal ? 'bg-orange-100 dark:bg-orange-900/40' : 'bg-purple-100 dark:bg-purple-900/40'}`}>
            <FileText className={`h-5 w-5 ${isInternal ? 'text-orange-600 dark:text-orange-400' : 'text-purple-600 dark:text-purple-400'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">เพิ่มรายการทะเบียน{isInternal ? 'รับภายใน' : 'รับภายนอก'}ด้วยตนเอง</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              สำหรับหนังสือที่ไม่ได้อยู่ในระบบ เลขทะเบียนรับจะรันต่อเนื่องกับเลขในระบบอัตโนมัติ
            </p>
          </div>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Row 1: เลขทะเบียนรับ (auto) + ที่ + ลงวันที่ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="register_number" className="text-sm font-medium flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  เลขทะเบียนรับ
                </Label>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Input
                    id="register_number"
                    type="number"
                    min={1}
                    value={nextNumber ?? ''}
                    onChange={(e) => setNextNumber(e.target.value ? Number(e.target.value) : null)}
                    placeholder={loadingNumber ? 'กำลังโหลด...' : 'เลขที่'}
                    disabled={loadingNumber}
                    className="font-mono font-bold text-center"
                  />
                  <span className="text-sm font-mono font-bold text-muted-foreground whitespace-nowrap">/{yearShort}</span>
                </div>
              </div>
              <div>
                <Label htmlFor="doc_reference" className="text-sm font-medium flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  ที่
                </Label>
                <Input
                  id="doc_reference"
                  value={docReference}
                  onChange={(e) => setDocReference(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="doc_date" className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  ลงวันที่
                </Label>
                <Input
                  id="doc_date"
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Row 2: จาก + ถึง */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from_org" className="text-sm font-medium">
                  จาก <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="from_org"
                  value={fromOrg}
                  onChange={(e) => setFromOrg(e.target.value)}
                  placeholder="ชื่อหน่วยงาน/บุคคล"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="to_person" className="text-sm font-medium">
                  ถึง
                </Label>
                <Input
                  id="to_person"
                  value={toPerson}
                  onChange={(e) => setToPerson(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Row 3: เรื่อง */}
            <div>
              <Label htmlFor="subject" className="text-sm font-medium">
                เรื่อง <span className="text-red-500">*</span>
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="เรื่องของหนังสือ"
                className="mt-1.5"
              />
            </div>

            {/* Row 4: การปฏิบัติ + หมายเหตุ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="action_taken" className="text-sm font-medium">
                  การปฏิบัติ <span className="text-xs text-muted-foreground font-normal">(ไม่บังคับ)</span>
                </Label>
                <Input
                  id="action_taken"
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="remarks" className="text-sm font-medium">
                  หมายเหตุ <span className="text-xs text-muted-foreground font-normal">(ไม่บังคับ)</span>
                </Label>
                <Input
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-2 border-t">
              <Button
                type="submit"
                disabled={loading || loadingNumber}
                className={`gap-2 shadow-md ${isInternal ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' : 'bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600'} text-white`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                บันทึกรายการ
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegisterForm;
