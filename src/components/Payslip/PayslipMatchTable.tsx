import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';
import type { PayslipData, ProfileSummary, MatchResult } from '@/services/payslipService';

export interface MatchedRow {
  pageNumber: number;
  half: 'top' | 'bottom';
  data: PayslipData;
  profileId: string | null;
  matchScore: number;
  matchType: MatchResult['matchType'];
  rawText?: string;
}

interface Props {
  rows: MatchedRow[];
  profiles: ProfileSummary[];
  onChangeMatch: (pageNumber: number, half: 'top' | 'bottom', profileId: string | null) => void;
}

const MatchBadge = ({ row }: { row: MatchedRow }) => {
  if (!row.profileId) {
    return <Badge variant="outline" className="text-muted-foreground">รอระบุ</Badge>;
  }
  if (row.matchType === 'id') {
    return <Badge className="bg-blue-500 text-white">จับคู่ด้วยรหัส</Badge>;
  }
  if (row.matchType === 'name_exact') {
    return <Badge className="bg-green-600 text-white">จับคู่แล้ว</Badge>;
  }
  return (
    <Badge
      className="bg-amber-500 text-white cursor-help"
      title={`ความเหมือน ${Math.round(row.matchScore * 100)}% — กรุณาตรวจสอบ`}
    >
      ⚠ {Math.round(row.matchScore * 100)}%
    </Badge>
  );
};

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PayslipMatchTable = ({ rows, profiles, onChangeMatch }: Props) => {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted text-muted-foreground text-xs font-semibold uppercase tracking-wide">
            <th className="px-3 py-2 text-left">หน้า</th>
            <th className="px-3 py-2 text-left">ชื่อจาก OCR</th>
            <th className="px-3 py-2 text-right">เงินสุทธิ</th>
            <th className="px-3 py-2 text-left w-52">จับคู่พนักงาน</th>
            <th className="px-3 py-2 text-center">สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(row => {
            const key = `${row.pageNumber}-${row.half}`;
            const matched = !!row.profileId;
            return (
              <tr key={key} className="hover:bg-muted/40 transition-colors">
                <td className="px-3 py-2 text-muted-foreground">
                  {row.pageNumber}/{row.half === 'top' ? '↑' : '↓'}
                </td>
                <td className="px-3 py-2 font-medium">
                  {row.data.name || <span className="text-amber-500 italic text-xs">OCR ไม่ได้ชื่อ</span>}
                  {row.data.position && (
                    <div className="text-xs text-muted-foreground">{row.data.position}</div>
                  )}
                  {row.profileId && (() => {
                    const p = profiles.find(x => x.id === row.profileId);
                    return p ? <div className="text-xs text-blue-400 font-mono">({p.employee_id})</div> : null;
                  })()}
                  {!row.data.name && row.rawText && (
                    <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate" title={row.rawText}>
                      raw: {row.rawText.slice(0, 60)}…
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  ฿{fmt(row.data.net_pay)}
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={row.profileId || 'unmatched'}
                    onValueChange={val =>
                      onChangeMatch(row.pageNumber, row.half, val === 'unmatched' ? null : val)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder="เลือกพนักงาน" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmatched">
                        <span className="text-muted-foreground">— ไม่ระบุ —</span>
                      </SelectItem>
                      {profiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                          <span className="text-muted-foreground ml-1 text-xs">({p.employee_id})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2 text-center">
                  <MatchBadge row={row} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PayslipMatchTable;
