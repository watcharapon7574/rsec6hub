
import React from 'react';
import { FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
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
    <p className="text-sm text-gray-600 sm:block hidden">
      เดือน<span className="font-bold">{thaiMonth}</span>
    </p>
  );
  const renderMonthSummaryMobile = (count: number) => (
    <p className="text-xs text-gray-500 sm:hidden block mt-1">
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
    <div className="flex gap-4 items-stretch mb-8 sm:flex-row flex-col">
      <div className="flex-[2.5] min-w-[300px] bg-white rounded-2xl shadow-2xl border border-blue-100/40 overflow-hidden flex flex-col relative w-full mb-3 sm:mb-0" style={{minHeight: 240}}>
        {/* Gradient Bar */}
        <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-2xl" />
        {/* กราฟเส้นเล็ก ยาวจากใต้ 'ด' ถึงเลข 4 */}
        <div className="absolute left-[140px] right-[100px] top-[80px] z-0 pointer-events-none flex justify-end">{renderLineChart()}</div>
        <div className="p-8 flex-1 flex flex-col justify-between relative z-10">
          <div className="flex items-start justify-between">
            {/* Icon with bg circle */}
            <div className="flex items-center justify-center bg-blue-50 rounded-full h-16 w-16 shadow-inner">
              <FileText className="h-10 w-10 text-blue-500" />
            </div>
            {/* Big number */}
            <span className="text-[5rem] font-extrabold text-blue-600 leading-none tracking-tight">{totalCount}</span>
          </div>
          <div className="mt-6">
            <h3 className="font-extrabold text-2xl text-gray-900 tracking-wide mb-1">เอกสารทั้งหมด</h3>
            {renderMonthSummary(totalCount)}
            {renderMonthSummaryMobile(totalCount)}
          </div>
        </div>
      </div>
      {/* กลุ่มการ์ดเล็ก (desktop: flex-row, mobile: scroll ได้) */}
      <div className="flex-[1.5] flex flex-row gap-4 w-full overflow-x-auto sm:overflow-visible sm:mb-0 mb-3 scrollbar-hide">
        <div className="flex-1 min-w-[220px] bg-white rounded-2xl shadow-xl shadow-orange-500/5 border border-orange-100/30 overflow-hidden hover:shadow-2xl hover:shadow-orange-500/10 transition-all duration-300 group flex flex-col w-full">
          <div className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 w-full"></div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between pb-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-orange-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-4xl sm:text-7xl font-bold text-orange-600">{pendingCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-bold text-gray-800 mb-1 text-base sm:text-lg">รอพิจารณา</h3>
                {renderMonthSummary(pendingCount)}
                {renderMonthSummaryMobile(pendingCount)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[220px] bg-white rounded-2xl shadow-xl shadow-green-500/5 border border-green-100/30 overflow-hidden hover:shadow-2xl hover:shadow-green-500/10 transition-all duration-300 group flex flex-col w-full">
          <div className="bg-gradient-to-r from-green-400 to-green-600 h-3 w-full"></div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between pb-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-green-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-4xl sm:text-7xl font-bold text-green-600">{approvedCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-bold text-gray-800 mb-1 text-base sm:text-lg">อนุมัติแล้ว</h3>
                {renderMonthSummary(approvedCount)}
                {renderMonthSummaryMobile(approvedCount)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-[220px] bg-white rounded-2xl shadow-xl shadow-purple-500/5 border border-purple-100/30 overflow-hidden hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 group flex flex-col w-full">
          <div className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 w-full"></div>
          <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between pb-2">
            <div>
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 text-purple-600 group-hover:scale-110 transition-transform duration-200" />
                <span className="text-4xl sm:text-7xl font-bold text-purple-600">{inProgressCount}</span>
              </div>
              <div className="mt-2">
                <h3 className="font-bold text-gray-800 mb-1 text-base sm:text-lg">กำลังดำเนินการ</h3>
                {renderMonthSummary(inProgressCount)}
                {renderMonthSummaryMobile(inProgressCount)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsCards;
