import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, CheckCircle, Save } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  uploadPayslipPdf,
  processPayslipPdf,
  createBatch,
  deleteBatchPayslips,
  insertPayslips,
  updateBatchStatus,
  getAllProfiles,
  matchProfiles,
  type ProfileSummary,
  type PayslipBatch,
} from '@/services/payslipService';
import PayslipMatchTable, { type MatchedRow } from './PayslipMatchTable';
import { useToast } from '@/hooks/use-toast';

const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const currentYear = new Date().getFullYear() + 543; // พ.ศ.
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

interface Props {
  profileId: string;
  batches: PayslipBatch[];
  onComplete: () => void;
}

const PayslipUploadSection = ({ profileId, batches, onComplete }: Props) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  const [processing, setProcessing] = useState(false);
  const [pagesDone, setPagesDone] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [matchRows, setMatchRows] = useState<MatchedRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'กรุณาเลือกไฟล์ PDF เท่านั้น', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setMatchRows([]);
    setCurrentBatchId(null);
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear) - 543; // แปลงเป็น ค.ศ.

    setProcessing(true);
    setPagesDone(0);
    setTotalPages(0);

    try {
      // 1. Upload to storage
      const { fileUrl, storagePath } = await uploadPayslipPdf(selectedFile, profileId, month, year);

      // 2. Create/upsert batch record
      const batch = await createBatch({
        uploadedBy: profileId,
        month,
        year,
        fileUrl,
        storagePath,
        pageCount: 0, // updated after OCR
      });
      setCurrentBatchId(batch.id);

      // 3. Load all profiles for matching
      const allProfiles = await getAllProfiles();
      setProfiles(allProfiles);

      // 4. OCR all pages
      const ocrResults = await processPayslipPdf(selectedFile, batch.id, (done, total) => {
        setPagesDone(done);
        setTotalPages(total);
      });

      // 5. Match names + employee_code
      const allItems = ocrResults.flatMap(r => [
        { name: r.top.name },
        { name: r.bottom.name },
      ]);
      const matchMap = matchProfiles(allItems, allProfiles);

      // 6. Build match rows — แสดงทุก row ทุกหน้า (OCR ที่ fail ให้ผู้นำเข้าระบุเอง)
      const rows: MatchedRow[] = ocrResults.flatMap(r => [
        {
          pageNumber: r.pageNumber, half: 'top' as const, data: r.top, rawText: r.rawText,
          profileId: matchMap.get(r.top.name)?.profileId ?? null,
          matchScore: matchMap.get(r.top.name)?.score ?? 0,
          matchType: matchMap.get(r.top.name)?.matchType ?? 'none',
        },
        {
          pageNumber: r.pageNumber, half: 'bottom' as const, data: r.bottom, rawText: r.rawText,
          profileId: matchMap.get(r.bottom.name)?.profileId ?? null,
          matchScore: matchMap.get(r.bottom.name)?.score ?? 0,
          matchType: matchMap.get(r.bottom.name)?.matchType ?? 'none',
        },
      ]);

      setMatchRows(rows);
    } catch (err: any) {
      toast({ title: 'OCR ไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  }, [selectedFile, selectedMonth, selectedYear, profileId]);

  const handleChangeMatch = useCallback((pageNumber: number, half: 'top' | 'bottom', profileId: string | null) => {
    setMatchRows(prev => prev.map(r =>
      r.pageNumber === pageNumber && r.half === half ? { ...r, profileId } : r
    ));
  }, []);

  const handleSave = async () => {
    if (!currentBatchId || matchRows.length === 0) return;
    setSaving(true);
    try {
      await deleteBatchPayslips(currentBatchId);
      await insertPayslips(currentBatchId, matchRows.map(r => ({
        profileId: r.profileId,
        employeeName: r.data.name,
        employeePosition: r.data.position,
        pageNumber: r.pageNumber,
        half: r.half,
        incomeItems: r.data.income_items,
        deductionItems: r.data.deduction_items,
        totalIncome: r.data.total_income,
        totalDeductions: r.data.total_deductions,
        netPay: r.data.net_pay,
        rawOcrText: r.rawText,
      })));

      const matched = matchRows.filter(r => r.profileId).length;
      const pageCount = new Set(matchRows.map(r => r.pageNumber)).size;
      await updateBatchStatus(currentBatchId, {
        status: 'completed',
        total_records: matchRows.length,
        matched_records: matched,
        page_count: pageCount,
      });

      toast({ title: `บันทึกสำเร็จ ${matchRows.length} รายการ (จับคู่ได้ ${matched} คน)` });
      setMatchRows([]);
      setSelectedFile(null);
      setCurrentBatchId(null);
      onComplete();
    } catch (err: any) {
      toast({ title: 'บันทึกไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const matchedCount = matchRows.filter(r => r.profileId).length;

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-600" />
            อัพโหลดสลิปเงินเดือน
          </h3>

          <div className="flex flex-wrap gap-3 items-end">
            {/* Month */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">เดือน</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THAI_MONTHS.slice(1).map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">ปี (พ.ศ.)</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* File picker */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">ไฟล์ PDF</label>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-9 gap-1.5">
                <FileText className="h-4 w-4" />
                {selectedFile ? selectedFile.name : 'เลือกไฟล์'}
              </Button>
            </div>

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || processing}
              className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700"
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />กำลัง OCR...</>
              ) : (
                <><Upload className="h-4 w-4" />อัพโหลด + OCR</>
              )}
            </Button>
          </div>

          {/* Progress */}
          {processing && totalPages > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>กำลังประมวลผล...</span>
                <span>{pagesDone}/{totalPages} หน้า</span>
              </div>
              <Progress value={(pagesDone / totalPages) * 100} className="h-2" />
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
        </CardContent>
      </Card>

      {/* Match table */}
      {matchRows.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                ผลการ OCR ({matchRows.length} รายการ)
              </h3>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-green-700 border-green-400">
                  จับคู่ได้ {matchedCount}/{matchRows.length}
                </Badge>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-1.5 bg-green-600 hover:bg-green-700"
                >
                  {saving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" />กำลังบันทึก...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" />บันทึกทั้งหมด</>
                  )}
                </Button>
              </div>
            </div>
            <PayslipMatchTable rows={matchRows} profiles={profiles} onChangeMatch={handleChangeMatch} />
          </CardContent>
        </Card>
      )}

      {/* Batch history */}
      {batches.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-3">ประวัติการอัพโหลด</h3>
            <div className="space-y-2">
              {batches.map(b => {
                const statusLabel = b.status === 'completed'
                  ? 'สำเร็จ'
                  : b.status === 'error'
                    ? 'ผิดพลาด'
                    : b.total_records > 0
                      ? 'รอบันทึก'
                      : 'กำลัง OCR';
                const statusVariant = b.status === 'completed'
                  ? 'default' as const
                  : b.status === 'error'
                    ? 'destructive' as const
                    : 'secondary' as const;
                const updatedDate = b.updated_at
                  ? new Date(b.updated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '';
                return (
                  <div key={b.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/40">
                    <div>
                      <span className="font-medium">
                        {THAI_MONTHS[b.month]} {b.year + 543}
                      </span>
                      {updatedDate && (
                        <span className="text-muted-foreground text-xs ml-2">อัพเดท {updatedDate}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {b.total_records > 0 && (
                        <span className="text-muted-foreground text-xs">
                          จับคู่ {b.matched_records}/{b.total_records} คน
                          {b.page_count > 0 && ` · ${b.page_count} หน้า`}
                        </span>
                      )}
                      <Badge variant={statusVariant} className="text-xs">
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayslipUploadSection;
