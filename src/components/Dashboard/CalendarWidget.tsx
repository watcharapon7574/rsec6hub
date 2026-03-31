import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, MapPin, RefreshCw } from 'lucide-react';
import { useGoogleCalendar, type CalendarEvent } from '@/hooks/useGoogleCalendar';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// Color palette for events (rotate per event index in a day)
const EVENT_COLORS = [
  { bg: 'bg-blue-100 dark:bg-blue-900/50', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-200', dot: 'bg-blue-500' },
  { bg: 'bg-orange-100 dark:bg-orange-900/50', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-800 dark:text-orange-200', dot: 'bg-orange-500' },
  { bg: 'bg-green-100 dark:bg-green-900/50', border: 'border-green-200 dark:border-green-800', text: 'text-green-800 dark:text-green-200', dot: 'bg-green-500' },
  { bg: 'bg-purple-100 dark:bg-purple-900/50', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-800 dark:text-purple-200', dot: 'bg-purple-500' },
  { bg: 'bg-rose-100 dark:bg-rose-900/50', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-800 dark:text-rose-200', dot: 'bg-rose-500' },
];

function getMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

interface DayEventsMap {
  [day: number]: CalendarEvent[];
}

const CalendarWidget: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = getMonthString(currentDate);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const { events, loading, error, refetch } = useGoogleCalendar({ month: monthStr });

  // Group events by day
  const dayEventsMap = useMemo<DayEventsMap>(() => {
    const map: DayEventsMap = {};
    for (const event of events) {
      const startDate = new Date(event.start);
      const endDate = event.end ? new Date(event.end) : startDate;

      const eventStart = new Date(startDate);
      const eventEnd = event.allDay ? new Date(endDate.getTime() - 86400000) : endDate;

      const d = new Date(eventStart);
      while (d <= eventEnd) {
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          if (!map[day].find(e => e.id === event.id)) {
            map[day].push(event);
          }
        }
        d.setDate(d.getDate() + 1);
      }
    }
    return map;
  }, [events, year, month]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(null);
  };

  const selectedEvents = selectedDay ? (dayEventsMap[selectedDay] || []) : [];

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            ปฏิทินงาน
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => window.open('https://calendar.google.com/calendar/u/0/r?cid=maplopburi6@gmail.com', '_blank')}
            >
              <ExternalLink className="h-3 w-3" />
              จัดการปฏิทิน
            </Button>
            {!isCurrentMonth && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={goToToday}>
                วันนี้
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refetch} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-destructive mb-3 p-2 rounded bg-destructive/10">
            ไม่สามารถโหลดปฏิทินได้: {error}
          </div>
        )}

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h3 className="text-base font-semibold">
            {THAI_MONTHS[month]} {year + 543}
          </h3>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {/* Calendar grid - large view with event content */}
            <div className="grid grid-cols-7 border-t border-l border-border">
              {/* Day headers */}
              {THAI_DAYS_SHORT.map((day, i) => (
                <div
                  key={day}
                  className={`text-center text-xs font-semibold py-2 border-b border-r border-border ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-muted-foreground'
                  }`}
                >
                  {day}
                </div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[80px] md:min-h-[100px] border-b border-r border-border bg-muted/30" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = dayEventsMap[day] || [];
                const isToday = isCurrentMonth && day === today.getDate();
                const isSelected = day === selectedDay;
                const dayOfWeek = (firstDay + i) % 7;
                const isSunday = dayOfWeek === 0;
                const isSaturday = dayOfWeek === 6;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`
                      min-h-[80px] md:min-h-[100px] p-1 border-b border-r border-border text-left
                      transition-colors relative flex flex-col
                      ${isSelected ? 'bg-primary/5 ring-2 ring-primary ring-inset' : 'hover:bg-muted/50'}
                      ${isToday ? 'bg-blue-50/50 dark:bg-blue-950/30' : ''}
                    `}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-0.5 px-0.5">
                      <span
                        className={`
                          text-xs font-medium leading-none
                          ${isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center' : ''}
                          ${isSunday && !isToday ? 'text-red-500' : ''}
                          ${isSaturday && !isToday ? 'text-blue-500' : ''}
                        `}
                      >
                        {day}
                      </span>
                      {dayEvents.length > 2 && (
                        <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 2}</span>
                      )}
                    </div>

                    {/* Event previews (show max 2 on mobile, 3 on desktop) */}
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {dayEvents.slice(0, 2).map((event, idx) => {
                        const color = EVENT_COLORS[idx % EVENT_COLORS.length];
                        return (
                          <div
                            key={event.id}
                            className={`${color.bg} ${color.border} border rounded px-1 py-0.5 truncate`}
                          >
                            <span className={`text-[10px] md:text-[11px] leading-tight ${color.text} font-medium`}>
                              {event.summary}
                            </span>
                          </div>
                        );
                      })}
                      {/* 3rd event only on desktop */}
                      {dayEvents[2] && (
                        <div
                          className={`hidden md:block ${EVENT_COLORS[2].bg} ${EVENT_COLORS[2].border} border rounded px-1 py-0.5 truncate`}
                        >
                          <span className={`text-[11px] leading-tight ${EVENT_COLORS[2].text} font-medium`}>
                            {dayEvents[2].summary}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Fill remaining cells to complete the last row */}
              {Array.from({ length: (7 - ((firstDay + daysInMonth) % 7)) % 7 }).map((_, i) => (
                <div key={`trailing-${i}`} className="min-h-[80px] md:min-h-[100px] border-b border-r border-border bg-muted/30" />
              ))}
            </div>

            {/* Selected day detail panel */}
            {selectedDay !== null && (
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">
                    {selectedDay} {THAI_MONTHS[month]} {year + 543}
                    {selectedEvents.length > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {selectedEvents.length} กิจกรรม
                      </Badge>
                    )}
                  </h4>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDay(null)}>
                    ปิด
                  </Button>
                </div>
                {selectedEvents.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedEvents.map((event, idx) => (
                      <EventDetailItem key={event.id} event={event} colorIdx={idx} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">ไม่มีกิจกรรมในวันนี้</p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const EventDetailItem: React.FC<{ event: CalendarEvent; colorIdx: number }> = ({ event, colorIdx }) => {
  const color = EVENT_COLORS[colorIdx % EVENT_COLORS.length];

  return (
    <div className={`p-3 rounded-lg ${color.bg} border ${color.border}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-1.5 rounded-full ${color.dot} flex-shrink-0 mt-1 self-stretch min-h-[24px]`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${color.text} leading-snug`}>
            {event.summary}
          </p>
          {event.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-3 whitespace-pre-line">
              {event.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {event.allDay ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">ทั้งวัน</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {new Date(event.start).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                {event.end && ` - ${new Date(event.end).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`}
              </Badge>
            )}
            {event.location && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarWidget;
