
import React from 'react';
import { FileText, Inbox, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useMemo } from 'react';

interface StatisticsCardsProps {
  totalCount: number;
  internalCount: number;
  externalCount: number;
  memosThisMonth: any[];
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({
  totalCount,
  internalCount,
  externalCount,
  memosThisMonth
}) => {
  // แปลงเดือนปัจจุบันเป็นภาษาไทย
  const now = new Date();
  const thaiMonth = format(now, 'LLLL', { locale: th });

  // คำนวณจำนวนเอกสารแต่ละวันในเดือนนี้ (รายวัน)
  const dailyCounts = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const memosByDay = Array(daysInMonth).fill(0);
    memosThisMonth.forEach(memo => {
      const d = new Date(memo.created_at);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        memosByDay[day - 1]++;
      }
    });
    return memosByDay;
  }, [memosThisMonth]);

  // ฟังก์ชันช่วยสร้างข้อความบรรทัดล่างสุด (responsive)
  const renderMonthSummary = (count: number) => (
    <p className="text-sm text-muted-foreground sm:block hidden">
      เดือน<span className="font-bold">{thaiMonth}</span>
    </p>
  );
  const renderMonthSummaryMobile = (count: number) => (
    <p className="text-xs text-muted-foreground sm:hidden block mt-1">
      <span className="font-bold">{thaiMonth}</span> {count} ฉบับ
    </p>
  );

  // คำนวณ path ของกราฟเส้น (smooth curve + area fill)
  const chart = useMemo(() => {
    const width = 240;
    const height = 68;
    const padX = 2;
    const padTop = 6;
    const padBottom = 4;
    const days = dailyCounts.length;
    if (days === 0) return null;
    const max = Math.max(...dailyCounts, 1);
    const plotH = height - padTop - padBottom;
    const plotW = width - padX * 2;

    const pts = dailyCounts.map((c, i) => {
      const x = days === 1 ? width / 2 : padX + (i * plotW) / (days - 1);
      const y = padTop + plotH - (c / max) * plotH;
      return { x, y };
    });

    // สร้าง smooth curve ด้วย cubic bezier (จุดควบคุมอยู่กึ่งกลางแนวนอน)
    const linePath = pts.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const prev = arr[i - 1];
      const cpX = ((prev.x + p.x) / 2).toFixed(1);
      return `${acc} C ${cpX} ${prev.y.toFixed(1)}, ${cpX} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }, '');

    const last = pts[pts.length - 1];
    const first = pts[0];
    const areaPath = `${linePath} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;

    const todayIdx = Math.min(new Date().getDate() - 1, pts.length - 1);
    const today = pts[todayIdx];

    return { width, height, linePath, areaPath, today };
  }, [dailyCounts]);

  const renderLineChart = () => {
    if (!chart) return null;
    return (
      <svg
        width={chart.width}
        height={chart.height}
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="doc-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="doc-chart-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <path d={chart.areaPath} fill="url(#doc-chart-fill)" />
        <path
          d={chart.linePath}
          fill="none"
          stroke="url(#doc-chart-stroke)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={chart.today.x.toFixed(1)} cy={chart.today.y.toFixed(1)} r="6" fill="#2563eb" opacity="0.15" />
        <circle cx={chart.today.x.toFixed(1)} cy={chart.today.y.toFixed(1)} r="3" fill="#ffffff" stroke="#2563eb" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <div className="flex gap-4 items-stretch mb-6 sm:flex-row flex-col">
      {/* การ์ดใหญ่ - เอกสารทั้งหมด */}
      <Card className="flex-[2.5] min-w-[300px] overflow-hidden flex flex-col relative w-full mb-3 sm:mb-0" style={{minHeight: 200}}>
        <div className="absolute left-[80px] right-[120px] top-[56px] z-0 pointer-events-none flex justify-end">{renderLineChart()}</div>
        <CardContent className="pt-6 flex-1 flex flex-col justify-between relative z-10">
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900">
              <FileText className="h-8 w-8 text-blue-600 dark:text-blue-400 dark:text-blue-600" />
            </div>
            <span className="text-6xl font-extrabold text-blue-600 dark:text-blue-400 dark:text-blue-600 leading-none tracking-tight">{totalCount}</span>
          </div>
          <div className="mt-4">
            <h3 className="font-bold text-xl text-foreground mb-1">เอกสารทั้งหมด</h3>
            {renderMonthSummary(totalCount)}
            {renderMonthSummaryMobile(totalCount)}
          </div>
        </CardContent>
      </Card>

      {/* กลุ่มการ์ดเล็ก */}
      <div className="flex-[1.5] flex flex-row gap-3 w-full overflow-x-auto sm:overflow-visible sm:mb-0 mb-3 scrollbar-hide">
        <Card className="flex-1 min-w-[160px] flex flex-col w-full">
          <CardContent className="pt-4 pb-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                  <Inbox className="h-4 w-4 text-orange-600 dark:text-orange-400 dark:text-orange-600" />
                </div>
                <span className="text-3xl sm:text-5xl font-bold text-orange-600 dark:text-orange-400 dark:text-orange-600">{internalCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">หนังสือรับภายใน</h3>
                {renderMonthSummary(internalCount)}
                {renderMonthSummaryMobile(internalCount)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[160px] flex flex-col w-full">
          <CardContent className="pt-4 pb-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                  <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400 dark:text-purple-600" />
                </div>
                <span className="text-3xl sm:text-5xl font-bold text-purple-600 dark:text-purple-400 dark:text-purple-600">{externalCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">หนังสือรับภายนอก</h3>
                {renderMonthSummary(externalCount)}
                {renderMonthSummaryMobile(externalCount)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatisticsCards;
