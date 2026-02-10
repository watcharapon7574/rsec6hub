
import React from 'react';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useMemo } from 'react';

interface StatisticsCardsProps {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  inProgressCount: number;
  memosThisMonth: any[];
}

const StatisticsCards: React.FC<StatisticsCardsProps> = ({
  totalCount,
  pendingCount,
  approvedCount,
  inProgressCount,
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

  // ฟังก์ชันวาดกราฟเส้น SVG (รายวัน)
  const renderLineChart = () => {
    const width = 220;
    const height = 60;
    const maxY = 55; // padding bottom
    const minY = 5; // padding top
    const days = dailyCounts.length;
    const max = Math.max(...dailyCounts, 1);
    // จุดเท่ากับจำนวนวันในเดือน กระจายเต็ม width
    const points = dailyCounts.map((c, i) => {
      const x = i * (width - 1) / (days - 1);
      const y = max === 0 ? maxY : maxY - ((c / max) * (maxY - minY));
      return `${x},${y}`;
    }).join(' ');
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <polyline
          fill="none"
          stroke="#2563eb"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div className="flex gap-4 items-stretch mb-6 sm:flex-row flex-col">
      {/* การ์ดใหญ่ - เอกสารทั้งหมด */}
      <Card className="flex-[2.5] min-w-[300px] overflow-hidden flex flex-col relative w-full mb-3 sm:mb-0" style={{minHeight: 200}}>
        <div className="absolute left-[80px] right-[140px] top-[60px] z-0 pointer-events-none flex justify-end">{renderLineChart()}</div>
        <CardContent className="pt-6 flex-1 flex flex-col justify-between relative z-10">
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-blue-100">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <span className="text-6xl font-extrabold text-blue-600 leading-none tracking-tight">{totalCount}</span>
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
                <div className="p-2 rounded-lg bg-purple-100">
                  <AlertCircle className="h-4 w-4 text-purple-600" />
                </div>
                <span className="text-3xl sm:text-5xl font-bold text-purple-600">{inProgressCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">รอตรวจทาน</h3>
                {renderMonthSummary(inProgressCount)}
                {renderMonthSummaryMobile(inProgressCount)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[160px] flex flex-col w-full">
          <CardContent className="pt-4 pb-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-amber-100">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <span className="text-3xl sm:text-5xl font-bold text-amber-600">{pendingCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">รอลงนาม</h3>
                {renderMonthSummary(pendingCount)}
                {renderMonthSummaryMobile(pendingCount)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[160px] flex flex-col w-full">
          <CardContent className="pt-4 pb-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-green-100">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-3xl sm:text-5xl font-bold text-green-600">{approvedCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base">เสร็จสิ้น</h3>
                {renderMonthSummary(approvedCount)}
                {renderMonthSummaryMobile(approvedCount)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StatisticsCards;
