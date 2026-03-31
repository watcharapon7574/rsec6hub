import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import { useGoogleCalendar, type CalendarEvent } from '@/hooks/useGoogleCalendar';

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const THAI_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

function getMonthString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatThaiDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()].slice(0, 3)}.`;
}

interface DayEventsMap {
  [day: number]: CalendarEvent[];
}

const CalendarWidget: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());

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

      // For multi-day events, mark each day
      const eventStart = new Date(startDate);
      // For all-day events, end date is exclusive in iCal
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
    setSelectedDay(new Date().getDate());
  };

  const selectedEvents = selectedDay ? (dayEventsMap[selectedDay] || []) : [];

  // Upcoming events (from today onwards, sorted ascending)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return events
      .filter(e => new Date(e.start) >= now)
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 5);
  }, [events]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            ปฏิทินงาน
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="text-sm text-destructive mb-3 p-2 rounded bg-destructive/10">
            ไม่สามารถโหลดปฏิทินได้: {error}
          </div>
        )}

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button onClick={goToToday} className="text-sm font-semibold hover:text-primary transition-colors">
            {THAI_MONTHS[month]} {year + 543}
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5 mb-3">
          {THAI_DAYS_SHORT.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}

          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="h-9" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const hasEvents = !!dayEventsMap[day]?.length;
            const isToday = isCurrentMonth && day === today.getDate();
            const isSelected = day === selectedDay;
            const eventCount = dayEventsMap[day]?.length || 0;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`
                  h-9 relative rounded-md text-sm transition-colors
                  ${isToday ? 'bg-primary text-primary-foreground font-bold' : ''}
                  ${isSelected && !isToday ? 'bg-primary/20 font-semibold' : ''}
                  ${!isToday && !isSelected ? 'hover:bg-muted' : ''}
                `}
              >
                {day}
                {hasEvents && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5`}>
                    {Array.from({ length: Math.min(eventCount, 3) }).map((_, j) => (
                      <span
                        key={j}
                        className={`w-1 h-1 rounded-full ${isToday ? 'bg-primary-foreground' : 'bg-orange-500'}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day events or upcoming events */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : selectedDay && selectedEvents.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              {selectedDay} {THAI_MONTHS[month]} — {selectedEvents.length} กิจกรรม
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedEvents.map((event) => (
                <EventItem key={event.id} event={event} />
              ))}
            </div>
          </div>
        ) : selectedDay ? (
          <p className="text-sm text-muted-foreground text-center py-3">ไม่มีกิจกรรมในวันนี้</p>
        ) : upcomingEvents.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">กิจกรรมที่กำลังจะมาถึง</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {upcomingEvents.map((event) => (
                <EventItem key={event.id} event={event} showDate />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-3">ไม่มีกิจกรรมในเดือนนี้</p>
        )}
      </CardContent>
    </Card>
  );
};

const EventItem: React.FC<{ event: CalendarEvent; showDate?: boolean }> = ({ event, showDate }) => (
  <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-100 dark:border-orange-900">
    <div className="flex items-start gap-2">
      <div className="w-1 h-full min-h-[20px] bg-orange-500 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">
          {event.summary}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {showDate && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {formatThaiDate(event.start)}
            </Badge>
          )}
          {event.allDay ? (
            <span className="text-[10px] text-muted-foreground">ทั้งวัน</span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              {new Date(event.start).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {event.location && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {event.location}
            </span>
          )}
        </div>
      </div>
    </div>
  </div>
);

export default CalendarWidget;
