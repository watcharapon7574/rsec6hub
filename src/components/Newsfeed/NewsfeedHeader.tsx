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
      <div className="space-y-3 mb-4">
        {/* Total posts card with sparkline */}
        <Card className="overflow-hidden relative">
          <div className="absolute right-4 top-3 z-0 pointer-events-none opacity-60">
            {renderLineChart()}
          </div>
          <CardContent className="pt-4 pb-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900">
                <Newspaper className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400 leading-none">
                    {stats.totalPosts}
                  </span>
                  <span className="font-semibold text-foreground text-sm">โพสต์</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  เดือน{thaiMonth}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Small stat cards in a row */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="pt-3 pb-2 px-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <div className="p-1.5 rounded-lg bg-pink-100 dark:bg-pink-900">
                  <Heart className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                </div>
              </div>
              <span className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                {stats.totalReactions}
              </span>
              <h3 className="font-medium text-foreground text-xs mt-0.5">รีแอคชัน</h3>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2 px-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900">
                  <MessageCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.totalComments}
              </span>
              <h3 className="font-medium text-foreground text-xs mt-0.5">ความเห็น</h3>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-2 px-3 text-center">
              <div className="flex items-center justify-center mb-1">
                <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {stats.acknowledgedPosts}
              </span>
              <h3 className="font-medium text-foreground text-xs mt-0.5">รับทราบ</h3>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default NewsfeedHeader;
