import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Newspaper, Heart, MessageCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface Props {
  displayName: string;
  userInfo: string;
  stats: {
    totalPosts: number;
    totalReactions: number;
    totalComments: number;
    acknowledgedPosts: number;
    postsThisMonth: any[];
  };
  onRefresh: () => void;
}

const NewsfeedHeader = ({ displayName, userInfo, stats, onRefresh }: Props) => {
  const now = new Date();
  const thaiMonth = format(now, 'LLLL', { locale: th });

  // Daily post counts for sparkline
  const dailyCounts = useMemo(() => {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const byDay = Array(daysInMonth).fill(0);
    stats.postsThisMonth.forEach((p: any) => {
      const d = new Date(p.created_at);
      if (d.getMonth() === month && d.getFullYear() === year) {
        byDay[d.getDate() - 1]++;
      }
    });
    return byDay;
  }, [stats.postsThisMonth]);

  const renderLineChart = () => {
    const width = 220;
    const height = 60;
    const maxY = 55;
    const minY = 5;
    const days = dailyCounts.length;
    const max = Math.max(...dailyCounts, 1);
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
    <>
      {/* Blue gradient header */}
      <Card className="mb-4 overflow-hidden">
        <CardContent className="bg-blue-600 rounded-lg py-5 px-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/15">
                <Newspaper className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">นิวส์ฟีด</h1>
                <p className="text-sm text-blue-100 mt-0.5">ติดตามข่าวสารและกิจกรรมของโรงเรียน</p>
                <p className="text-xs text-blue-200 mt-0.5">{displayName} · {userInfo}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white gap-1.5 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">รีเฟรช</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats cards */}
      <div className="flex gap-3 items-stretch mb-4 sm:flex-row flex-col">
        {/* Large card — total posts */}
        <Card className="flex-[2.5] min-w-0 overflow-hidden flex flex-col relative" style={{ minHeight: 170 }}>
          <div className="absolute left-[70px] right-[100px] top-[50px] z-0 pointer-events-none flex justify-end">
            {renderLineChart()}
          </div>
          <CardContent className="pt-5 flex-1 flex flex-col justify-between relative z-10">
            <div className="flex items-start justify-between">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900">
                <Newspaper className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-5xl font-extrabold text-blue-600 dark:text-blue-400 leading-none tracking-tight">
                {stats.totalPosts}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="font-bold text-lg text-foreground">โพสต์ทั้งหมด</h3>
              <p className="text-sm text-muted-foreground">
                เดือน<span className="font-bold">{thaiMonth}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Small cards group */}
        <div className="flex-[1.5] flex flex-row gap-2 w-full overflow-x-auto sm:overflow-visible scrollbar-hide">
          {/* Reactions */}
          <Card className="flex-1 min-w-[120px] flex flex-col">
            <CardContent className="pt-3 pb-2 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <div className="p-1.5 rounded-lg bg-pink-100 dark:bg-pink-900">
                  <Heart className="h-4 w-4 text-pink-600 dark:text-pink-400" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold text-pink-600 dark:text-pink-400">
                  {stats.totalReactions}
                </span>
              </div>
              <div className="mt-1">
                <h3 className="font-semibold text-foreground text-xs sm:text-sm">รีแอคชัน</h3>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  เดือน<span className="font-bold">{thaiMonth}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="flex-1 min-w-[120px] flex flex-col">
            <CardContent className="pt-3 pb-2 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900">
                  <MessageCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.totalComments}
                </span>
              </div>
              <div className="mt-1">
                <h3 className="font-semibold text-foreground text-xs sm:text-sm">ความเห็น</h3>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  เดือน<span className="font-bold">{thaiMonth}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Acknowledged */}
          <Card className="flex-1 min-w-[120px] flex flex-col">
            <CardContent className="pt-3 pb-2 flex-1 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-3xl sm:text-4xl font-bold text-green-600 dark:text-green-400">
                  {stats.acknowledgedPosts}
                </span>
              </div>
              <div className="mt-1">
                <h3 className="font-semibold text-foreground text-xs sm:text-sm">รับทราบ</h3>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  เดือน<span className="font-bold">{thaiMonth}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default NewsfeedHeader;
