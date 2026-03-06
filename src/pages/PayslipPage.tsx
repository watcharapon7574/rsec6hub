import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { usePayslips } from '@/hooks/usePayslips';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, ArrowLeft, ChevronDown } from 'lucide-react';
import PayslipCard from '@/components/Payslip/PayslipCard';
import PayslipUploadSection from '@/components/Payslip/PayslipUploadSection';
import type { PayslipWithBatch } from '@/services/payslipService';

const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const PayslipPage = () => {
  const navigate = useNavigate();
  const { profile } = useEmployeeAuth();
  const [selectedBatchKey, setSelectedBatchKey] = useState<string>('all');

  const {
    myPayslips,
    batches,
    canUpload,
    loading,
    refetch,
  } = usePayslips({
    profileId: profile?.id,
    employeeId: profile?.employee_id,
    isAdmin: profile?.is_admin ?? false,
  });

  // Derive unique batch keys from myPayslips for the dropdown
  const batchOptions = Array.from(
    new Map(myPayslips.map(p => [`${p.batch.month}-${p.batch.year}`, p.batch])).values()
  ).sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month);

  // Filter displayed payslips
  const displayedPayslips: PayslipWithBatch[] =
    selectedBatchKey === 'all'
      ? myPayslips
      : myPayslips.filter(p => `${p.batch.month}-${p.batch.year}` === selectedBatchKey);

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/profile')} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900">
              <Banknote className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold">สลิปเงินเดือน</h1>
              <p className="text-sm text-muted-foreground">
                {profile.first_name} {profile.last_name}
              </p>
            </div>
          </div>
        </div>

        {/* Upload section — uploader/admin only */}
        {canUpload && (
          <PayslipUploadSection
            profileId={profile.id}
            batches={batches}
            onComplete={refetch}
          />
        )}

        {/* My Payslips section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">สลิปของฉัน</h2>
            {batchOptions.length > 1 && (
              <Select value={selectedBatchKey} onValueChange={setSelectedBatchKey}>
                <SelectTrigger className="w-44 h-8 text-sm gap-1">
                  <SelectValue placeholder="เลือกเดือน" />
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  {batchOptions.map(b => (
                    <SelectItem key={`${b.month}-${b.year}`} value={`${b.month}-${b.year}`}>
                      {THAI_MONTHS[b.month]} {b.year + 543}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-32 bg-muted rounded-lg animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : displayedPayslips.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Banknote className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">ยังไม่มีข้อมูลสลิปเงินเดือน</p>
                <p className="text-xs text-muted-foreground mt-1">
                  สลิปจะปรากฏที่นี่เมื่อผู้รับผิดชอบอัพโหลดข้อมูลแล้ว
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayedPayslips.map(p => (
                <PayslipCard key={p.id} payslip={p} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default PayslipPage;
