import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Loader2, Banknote, TrendingUp, TrendingDown } from 'lucide-react';
import type { PayslipWithBatch, PayslipItem } from '@/services/payslipService';
import { cropPayslipPDF } from '@/services/payslipService';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const THAI_MONTHS = [
  '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  payslip: PayslipWithBatch;
}

const FOOTER_KEYWORDS = [
  'ลงชื่อ', 'ผู้มีหน้าที่จ่ายเงิน', 'วัน เดือน ปี', 'ที่ออกหนังสือรับรอง',
  'หนังสือรับรอง', 'ผู้จ่ายเงิน', 'ออกหนังสือ',
];

const isFooterItem = (label: string) =>
  FOOTER_KEYWORDS.some(kw => label.includes(kw));

const ItemRow = ({ item }: { item: PayslipItem }) => (
  <div className="flex justify-between text-sm py-0.5">
    <span className="text-muted-foreground truncate pr-2">{item.label}</span>
    <span className={`font-medium shrink-0 ${item.amount == null ? 'text-muted-foreground/50' : ''}`}>
      {item.amount == null ? '-' : fmt(item.amount)}
    </span>
  </div>
);

const PayslipCard = ({ payslip }: Props) => {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const { batch } = payslip;
  const thaiYear = batch.year + 543;
  const monthLabel = `${THAI_MONTHS[batch.month]} ${thaiYear}`;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await cropPayslipPDF(batch.file_url, payslip.page_number, payslip.half);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${batch.month}_${batch.year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'ดาวน์โหลดไม่สำเร็จ', description: err?.message, variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-white/80" />
            <span className="text-white font-semibold">สลิปเงินเดือน</span>
            <Badge variant="secondary" className="text-xs bg-white/20 text-white border-0">
              {monthLabel}
            </Badge>
          </div>
          <p className="text-blue-100 text-sm mt-0.5">
            {payslip.employee_name}
            {payslip.employee_position && (
              <span className="text-blue-200 text-xs ml-1">· {payslip.employee_position}</span>
            )}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownload}
          disabled={downloading}
          className="bg-white/15 text-white border-0 hover:bg-white/25 gap-1.5"
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          PDF
        </Button>
      </div>

      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Income */}
          <div>
            <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-semibold text-sm mb-2">
              <TrendingUp className="h-4 w-4" />
              รายรับ
            </div>
            <div className="space-y-0.5">
              {payslip.income_items.filter(it => it.label.trim() && !isFooterItem(it.label)).map((item, i) => <ItemRow key={i} item={item} />)}
            </div>
            <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-sm text-green-700 dark:text-green-400">
              <span>รวมรับ</span>
              <span>{fmt(payslip.total_income)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold text-sm mb-2">
              <TrendingDown className="h-4 w-4" />
              รายหัก
            </div>
            <div className="space-y-0.5">
              {payslip.deduction_items.filter(it => it.label.trim() && !isFooterItem(it.label)).map((item, i) => <ItemRow key={i} item={item} />)}
            </div>
            <div className="border-t mt-2 pt-2 flex justify-between font-semibold text-sm text-red-600 dark:text-red-400">
              <span>รวมหัก</span>
              <span>{fmt(payslip.total_deductions)}</span>
            </div>
          </div>
        </div>

        {/* Net pay */}
        <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 px-4 py-3 flex justify-between items-center">
          <span className="font-semibold text-blue-800 dark:text-blue-200">เงินสุทธิ</span>
          <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
            ฿{fmt(payslip.net_pay)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default PayslipCard;
